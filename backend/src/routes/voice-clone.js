const express = require("express");
const multer = require("multer");
const { success, error } = require("../utils/response");
const { authenticate } = require("../middleware/auth");
const voiceAnalyzer = require("../services/voice-analyzer");
const { table } = require("../db/query");

const router = express.Router();
router.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/flac", "audio/webm"];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported audio format"));
    }
  },
});

// Analyze audio for voice clone detection
router.post("/analyze", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) return error(res, "Audio file required", 400);

    const format = req.file.originalname.split(".").pop() || "mp3";
    const result = await voiceAnalyzer.analyzeClone(req.file.buffer, format);

    // Persist analysis result
    const tbl = await table("voice_analyses");
    await tbl.insert({
      id: "va_" + Date.now(),
      user_id: req.user.userId,
      file_name: req.file.originalname,
      file_size: req.file.size,
      format,
      is_clone: result.isClone || false,
      clone_score: result.cloneScore || 0,
      breathing_score: result.breathingScore || 0,
      spectral_score: result.spectralScore || 0,
      result_json: JSON.stringify(result),
    });

    return success(res, {
      analysis: result,
      file: { name: req.file.originalname, size: req.file.size, format },
    });
  } catch (e) {
    return error(res, e.message || "Analysis failed", 500);
  }
});

// Batch analyze multiple audio files
router.post("/batch", upload.array("audio", 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return error(res, "At least one audio file required", 400);

    const results = [];
    const tbl = await table("voice_analyses");

    for (const file of req.files) {
      const format = file.originalname.split(".").pop() || "mp3";
      const analysis = await voiceAnalyzer.analyzeClone(file.buffer, format);

      await tbl.insert({
        id: "va_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        user_id: req.user.userId,
        file_name: file.originalname,
        file_size: file.size,
        format,
        is_clone: analysis.isClone || false,
        clone_score: analysis.cloneScore || 0,
        breathing_score: analysis.breathingScore || 0,
        spectral_score: analysis.spectralScore || 0,
        result_json: JSON.stringify(analysis),
      });

      results.push({ fileName: file.originalname, analysis });
    }

    const threatsFound = results.filter(r => r.analysis.isClone).length;
    return success(res, {
      results,
      summary: { total: results.length, threatsFound, clean: results.length - threatsFound },
    });
  } catch (e) {
    return error(res, e.message || "Batch analysis failed", 500);
  }
});

// Get voice clone detection stats
router.get("/stats", async (req, res) => {
  try {
    const userId = req.user.userId;
    const tbl = await table("voice_analyses");
    const analyses = await tbl.filter({ user_id: userId });

    return success(res, {
      totalAnalyzed: analyses.length,
      threatsDetected: analyses.filter(a => a.is_clone).length,
      lastAnalysis: analyses.length > 0 ? analyses[analyses.length - 1].created_at : null,
    });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

module.exports = router;
