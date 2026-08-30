const express = require("express");
const { success, error } = require("../utils/response");
const passport = require("../services/passport");

const router = express.Router();

router.get("/", (req, res) => {
  const userId = req.userId;
  const db = req.app.get("db");
  const p = passport.getPassport(db, userId);

  if (!p) {
    return success(res, { passport: null, enrolled: false });
  }

  return success(res, {
    passport: {
      id: p.id,
      holderName: p.holderName,
      verificationLevel: p.verificationLevel,
      enrolledAt: p.enrolledAt,
      expiresAt: p.expiresAt,
      status: p.status
    },
    enrolled: true
  });
});

router.post("/enroll", (req, res) => {
  const userId = req.userId;
  const db = req.app.get("db");

  const existing = passport.getPassport(db, userId);
  if (existing && existing.status === "active") {
    return error(res, "Passport already active", 400);
  }

  const p = passport.generatePassport(db, userId);
  if (!p) {
    return error(res, "Failed to generate passport", 500);
  }

  return success(res, {
    message: "Identity Passport created",
    passport: {
      id: p.id,
      holderName: p.holderName,
      verificationLevel: p.verificationLevel,
      expiresAt: p.expiresAt
    }
  }, 201);
});

router.get("/verify/:passportId", (req, res) => {
  const db = req.app.get("db");
  const result = passport.verifyPassport(db, req.params.passportId);
  return success(res, result);
});

router.post("/qr", (req, res) => {
  const userId = req.userId;
  const db = req.app.get("db");
  const p = passport.getPassport(db, userId);

  if (!p || p.status !== "active") {
    return error(res, "No active passport", 400);
  }

  const qrData = passport.generateQRData(p);
  return success(res, { qrData, expiresIn: 300 });
});

router.post("/qr/verify", (req, res) => {
  const { qrData } = req.body;
  const db = req.app.get("db");

  if (!qrData) {
    return error(res, "qrData required", 400);
  }

  const result = passport.verifyQRData(db, qrData);
  return success(res, result);
});

router.post("/revoke", (req, res) => {
  const userId = req.userId;
  const db = req.app.get("db");
  const p = passport.revokePassport(db, userId);

  if (!p) {
    return error(res, "No passport to revoke", 404);
  }

  return success(res, { message: "Passport revoked" });
});

module.exports = router;
