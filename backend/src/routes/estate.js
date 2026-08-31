const express = require("express");
const { success, error } = require("../utils/response");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

function getEstates(db, userId) {
  return db.get("estate_profiles").filter({ ownerUserId: userId }).value() || [];
}

router.get("/", (req, res) => {
  const userId = req.user.userId;
  const db = req.app.get("db");
  const estates = getEstates(db, userId);
  return success(res, { estates });
});

router.post("/enroll", (req, res) => {
  const userId = req.user.userId;
  const { deceasedName, relationship, dateOfDeath, email, notes } = req.body;
  const db = req.app.get("db");

  if (!deceasedName || !relationship) {
    return error(res, "deceasedName and relationship required", 400);
  }

  const estate = {
    id: "est_" + Date.now(),
    ownerUserId: userId,
    deceasedName,
    relationship,
    dateOfDeath: dateOfDeath || null,
    email: email || null,
    notes: notes || "",
    status: "active",
    monitoringEnabled: true,
    takedownsAuthorized: true,
    createdAt: new Date().toISOString(),
  };

  db.get("estate_profiles").push(estate).write();
  return success(res, { message: "Estate enrolled", estate }, "OK", 201);
});

router.post("/:estateId/takedown", (req, res) => {
  const userId = req.user.userId;
  const { estateId } = req.params;
  const { url, description, type } = req.body;
  const db = req.app.get("db");

  const estate = db.get("estate_profiles").find({ id: estateId, ownerUserId: userId }).value();
  if (!estate) {
    return error(res, "Estate not found", 404);
  }

  if (!estate.takedownsAuthorized) {
    return error(res, "Takedowns not authorized for this estate", 403);
  }

  const takedown = {
    id: "td_" + Date.now(),
    estateId,
    ownerUserId: userId,
    deceasedName: estate.deceasedName,
    url: url || "",
    description: description || "",
    type: type || "dmca",
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  db.get("estate_takedowns").push(takedown).write();
  return success(res, { message: "Takedown initiated", takedown }, "OK", 201);
});

router.get("/:estateId/takedowns", (req, res) => {
  const userId = req.user.userId;
  const { estateId } = req.params;
  const db = req.app.get("db");

  const takedowns = db.get("estate_takedowns")
    .filter({ estateId, ownerUserId: userId })
    .value() || [];

  return success(res, { takedowns });
});

router.post("/:estateId/memorialize", (req, res) => {
  const userId = req.user.userId;
  const { estateId } = req.params;
  const { platform, profileUrl } = req.body;
  const db = req.app.get("db");

  const estate = db.get("estate_profiles").find({ id: estateId, ownerUserId: userId }).value();
  if (!estate) {
    return error(res, "Estate not found", 404);
  }

  const request = {
    id: "mem_" + Date.now(),
    estateId,
    platform: platform || "facebook",
    profileUrl: profileUrl || "",
    status: "submitted",
    createdAt: new Date().toISOString(),
  };

  db.get("memorial_requests").push(request).write();
  return success(res, { message: "Memorialization request submitted", request }, "OK", 201);
});

router.delete("/:estateId", (req, res) => {
  const userId = req.user.userId;
  const { estateId } = req.params;
  const db = req.app.get("db");

  const estate = db.get("estate_profiles").find({ id: estateId, ownerUserId: userId }).value();
  if (!estate) {
    return error(res, "Estate not found", 404);
  }

  db.get("estate_profiles").remove({ id: estateId }).write();
  return success(res, { message: "Estate removed" });
});

module.exports = router;
