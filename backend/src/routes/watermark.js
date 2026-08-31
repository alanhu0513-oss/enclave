const express = require("express");
const { success, error } = require("../utils/response");
const { embedWatermark, verifyWatermark } = require("../services/watermark");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

router.post("/embed", async (req, res) => {
  try {
    const userId = req.user.userId;
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return error(res, "imageBase64 required", 400);
    }

    const imageBuffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ""), "base64");
    const result = await embedWatermark(imageBuffer, userId);

    return success(res, {
      image: `data:image/jpeg;base64,${result.buffer.toString("base64")}`,
      watermark: {
        id: result.watermark.id,
        timestamp: result.watermark.timestamp
      }
    });
  } catch (e) {
    return error(res, "Watermark failed: " + e.message, 500);
  }
});

router.post("/verify", async (req, res) => {
  try {
    const { imageBase64, userId } = req.body;

    if (!imageBase64) {
      return error(res, "imageBase64 required", 400);
    }

    const imageBuffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ""), "base64");
    const result = await verifyWatermark(imageBuffer, userId);

    return success(res, result);
  } catch (e) {
    return error(res, "Verification failed: " + e.message, 500);
  }
});

module.exports = router;
