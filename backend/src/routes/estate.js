const express = require("express");
const { success, error } = require("../utils/response");
const { authenticate } = require("../middleware/auth");
const { table } = require("../db/query");

const router = express.Router();
router.use(authenticate);

router.get("/", async (req, res) => {
  try {
    const userId = req.user.userId;
    const tbl = await table("estate_profiles");
    const estates = await tbl.filter({ owner_user_id: userId });
    return success(res, { estates });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.post("/enroll", async (req, res) => {
  try {
    const userId = req.user.userId;
    const { deceasedName, relationship, dateOfDeath, email, notes } = req.body;
    if (!deceasedName || !relationship) return error(res, "deceasedName and relationship required", 400);

    const tbl = await table("estate_profiles");
    const estate = {
      id: "est_" + Date.now(),
      owner_user_id: userId,
      deceased_name: deceasedName,
      relationship,
      date_of_death: dateOfDeath || null,
      email: email || null,
      notes: notes || "",
      status: "active",
      monitoring_enabled: true,
      takedowns_authorized: true,
    };
    await tbl.insert(estate);
    return success(res, { message: "Estate enrolled", estate }, "OK", 201);
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.post("/:estateId/takedown", async (req, res) => {
  try {
    const userId = req.user.userId;
    const { estateId } = req.params;
    const { url, description, type } = req.body;

    const tbl = await table("estate_profiles");
    const estate = await tbl.find({ id: estateId, owner_user_id: userId });
    if (!estate) return error(res, "Estate not found", 404);
    if (!estate.takedowns_authorized) return error(res, "Takedowns not authorized for this estate", 403);

    const tdTbl = await table("estate_takedowns");
    const takedown = {
      id: "td_" + Date.now(),
      estate_id: estateId,
      owner_user_id: userId,
      deceased_name: estate.deceased_name,
      url: url || "",
      description: description || "",
      type: type || "dmca",
      status: "pending",
    };
    await tdTbl.insert(takedown);
    return success(res, { message: "Takedown initiated", takedown }, "OK", 201);
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.get("/:estateId/takedowns", async (req, res) => {
  try {
    const userId = req.user.userId;
    const tbl = await table("estate_takedowns");
    const takedowns = await tbl.filter({ estate_id: req.params.estateId, owner_user_id: userId });
    return success(res, { takedowns });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.post("/:estateId/memorialize", async (req, res) => {
  try {
    const userId = req.user.userId;
    const { estateId } = req.params;
    const { platform, profileUrl } = req.body;

    const tbl = await table("estate_profiles");
    const estate = await tbl.find({ id: estateId, owner_user_id: userId });
    if (!estate) return error(res, "Estate not found", 404);

    const memTbl = await table("memorial_requests");
    const request = {
      id: "mem_" + Date.now(),
      estate_id: estateId,
      platform: platform || "facebook",
      profile_url: profileUrl || "",
      status: "submitted",
    };
    await memTbl.insert(request);
    return success(res, { message: "Memorialization request submitted", request }, "OK", 201);
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.delete("/:estateId", async (req, res) => {
  try {
    const userId = req.user.userId;
    const tbl = await table("estate_profiles");
    const estate = await tbl.find({ id: req.params.estateId, owner_user_id: userId });
    if (!estate) return error(res, "Estate not found", 404);
    await tbl.remove({ id: req.params.estateId });
    return success(res, { message: "Estate removed" });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

module.exports = router;
