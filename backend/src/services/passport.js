const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const SECRET = process.env.PASSPORT_SECRET || crypto.randomBytes(32).toString("hex");

function encrypt(data) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET, "hex"), iv);
  let encrypted = cipher.update(JSON.stringify(data), "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();
  return { iv: iv.toString("hex"), encrypted, authTag: authTag.toString("hex") };
}

function decrypt(payload) {
  const iv = Buffer.from(payload.iv, "hex");
  const authTag = Buffer.from(payload.authTag, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET, "hex"), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(payload.encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return JSON.parse(decrypted);
}

function generatePassport(db, userId) {
  const user = db.get("users").find({ id: userId }).value();
  if (!user) return null;

  const existing = db.get("identity_passports").find({ userId }).value();
  if (existing) return existing;

  const passport = {
    id: "pass_" + crypto.randomBytes(8).toString("hex"),
    userId,
    holderName: user.full_name || user.fullName || user.email,
    email: user.email,
    enrolledAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    verified: true,
    verificationLevel: user.plan === "business" ? "enterprise" : "standard",
    publicKey: crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" }
    }).publicKey,
    biometricHash: user.face_embedding ? crypto.createHash("sha256").update(JSON.stringify(user.face_embedding)).digest("hex") : null,
    qrCode: null,
    status: "active"
  };

  db.get("identity_passports").push(passport).write();
  return passport;
}

function getPassport(db, userId) {
  return db.get("identity_passports").find({ userId }).value() || null;
}

function verifyPassport(db, passportId) {
  const passport = db.get("identity_passports").find({ id: passportId }).value();
  if (!passport) {
    return { valid: false, reason: "Passport not found" };
  }

  if (passport.status !== "active") {
    return { valid: false, reason: "Passport is " + passport.status, passport };
  }

  if (new Date(passport.expiresAt) < new Date()) {
    return { valid: false, reason: "Passport expired", passport };
  }

  return {
    valid: true,
    passport: {
      id: passport.id,
      holderName: passport.holderName,
      verificationLevel: passport.verificationLevel,
      expiresAt: passport.expiresAt
    }
  };
}

function revokePassport(db, userId) {
  const passport = db.get("identity_passports").find({ userId }).value();
  if (!passport) return null;

  db.get("identity_passports")
    .find({ userId })
    .assign({ status: "revoked", revokedAt: new Date().toISOString() })
    .write();

  return passport;
}

function generateQRData(passport) {
  const payload = {
    passportId: passport.id,
    holderName: passport.holderName,
    verificationLevel: passport.verificationLevel,
    expiresAt: passport.expiresAt,
    timestamp: Date.now()
  };

  const encrypted = encrypt(payload);
  return Buffer.from(JSON.stringify(encrypted)).toString("base64");
}

function verifyQRData(db, qrData) {
  try {
    const payload = JSON.parse(Buffer.from(qrData, "base64").toString("utf8"));
    const decrypted = decrypt(payload);

    if (Date.now() - decrypted.timestamp > 300000) {
      return { valid: false, reason: "QR code expired" };
    }

    return verifyPassport(db, decrypted.passportId);
  } catch {
    return { valid: false, reason: "Invalid QR data" };
  }
}

module.exports = {
  generatePassport,
  getPassport,
  verifyPassport,
  revokePassport,
  generateQRData,
  verifyQRData
};
