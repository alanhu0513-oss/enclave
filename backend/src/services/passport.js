const crypto = require("crypto");
const { table } = require("../db/query");

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

async function generatePassport(userId) {
  const usersTbl = await table("users");
  const user = await usersTbl.find({ id: userId });
  if (!user) return null;

  const passportsTbl = await table("identity_passports");
  const existing = await passportsTbl.find({ user_id: userId });
  if (existing) return existing;

  const passport = {
    id: "pass_" + crypto.randomBytes(8).toString("hex"),
    user_id: userId,
    holder_name: user.full_name || user.fullName || user.email,
    email: user.email,
    enrolled_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    verified: true,
    verification_level: user.subscription_tier === "business" ? "enterprise" : "standard",
    public_key: crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    }).publicKey,
    biometric_hash: user.face_embedding ? crypto.createHash("sha256").update(JSON.stringify(user.face_embedding)).digest("hex") : null,
    qr_code: null,
    status: "active",
  };

  await passportsTbl.insert(passport);
  return passport;
}

async function getPassport(userId) {
  const tbl = await table("identity_passports");
  return await tbl.find({ user_id: userId }) || null;
}

async function verifyPassport(passportId) {
  const tbl = await table("identity_passports");
  const passport = await tbl.find({ id: passportId });
  if (!passport) return { valid: false, reason: "Passport not found" };
  if (passport.status !== "active") return { valid: false, reason: "Passport is " + passport.status, passport };
  if (new Date(passport.expires_at) < new Date()) return { valid: false, reason: "Passport expired", passport };

  return {
    valid: true,
    passport: {
      id: passport.id,
      holderName: passport.holder_name,
      verificationLevel: passport.verification_level,
      expiresAt: passport.expires_at,
    },
  };
}

async function revokePassport(userId) {
  const tbl = await table("identity_passports");
  const passport = await tbl.find({ user_id: userId });
  if (!passport) return null;
  await tbl.update({ user_id: userId }, { status: "revoked", revoked_at: new Date().toISOString() });
  return passport;
}

function generateQRData(passport) {
  const payload = {
    passportId: passport.id,
    holderName: passport.holder_name,
    verificationLevel: passport.verification_level,
    expiresAt: passport.expires_at,
    timestamp: Date.now(),
  };
  const encrypted = encrypt(payload);
  return Buffer.from(JSON.stringify(encrypted)).toString("base64");
}

async function verifyQRData(qrData) {
  try {
    const payload = JSON.parse(Buffer.from(qrData, "base64").toString("utf8"));
    const decrypted = decrypt(payload);
    if (Date.now() - decrypted.timestamp > 300000) return { valid: false, reason: "QR code expired" };
    return await verifyPassport(decrypted.passportId);
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
  verifyQRData,
};
