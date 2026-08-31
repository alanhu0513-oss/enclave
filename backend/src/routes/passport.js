const express = require("express");
const { success, error } = require("../utils/response");
const passport = require("../services/passport");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticate, async (req, res) => {
  try {
    const p = await passport.getPassport(req.user.userId);
    if (!p) return success(res, { passport: null, enrolled: false });
    return success(res, {
      passport: {
        id: p.id,
        holderName: p.holder_name,
        verificationLevel: p.verification_level,
        enrolledAt: p.enrolled_at,
        expiresAt: p.expires_at,
        status: p.status,
      },
      enrolled: true,
    });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.post("/enroll", authenticate, async (req, res) => {
  try {
    const existing = await passport.getPassport(req.user.userId);
    if (existing && existing.status === "active") {
      return error(res, "Passport already active", 400);
    }
    const p = await passport.generatePassport(req.user.userId);
    if (!p) return error(res, "Failed to generate passport", 500);
    return success(res, {
      passport: {
        id: p.id,
        holderName: p.holder_name,
        verificationLevel: p.verification_level,
        expiresAt: p.expires_at,
      },
    }, "Identity Passport created", 201);
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.get("/verify/:passportId", async (req, res) => {
  try {
    const result = await passport.verifyPassport(req.params.passportId);
    return success(res, result);
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.post("/qr", authenticate, async (req, res) => {
  try {
    const p = await passport.getPassport(req.user.userId);
    if (!p) return error(res, "No passport found", 404);
    const qrData = passport.generateQRData(p);
    return success(res, { qrData, expiresIn: 300 });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.post("/qr/verify", async (req, res) => {
  try {
    const { qrData } = req.body;
    if (!qrData) return error(res, "qrData required", 400);
    const result = await passport.verifyQRData(qrData);
    return success(res, result);
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.post("/revoke", authenticate, async (req, res) => {
  try {
    const result = await passport.revokePassport(req.user.userId);
    if (!result) return error(res, "No passport found", 404);
    return success(res, { message: "Passport revoked" });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

module.exports = router;
