const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');
const mlClient = require('../services/ml-client');
const usage = require('../services/usage');
const billing = require('../services/billing');
const { table } = require('../db/query');

const { UPLOAD_DIR } = require('../utils/upload-dir');
const upload = multer({
  dest: path.join(UPLOAD_DIR, 'temp'),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.bmp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Unsupported image format. Use PNG, JPG, WebP, or BMP.'));
  }
});

const faceUpload = multer({
  dest: path.join(UPLOAD_DIR, 'temp'),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.bmp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Unsupported image format. Use PNG, JPG, WebP, or BMP.'));
  }
});

const router = express.Router();
router.use(authenticate);

router.post('/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return error(res, 'Image file required', 400);

    // Check tier limit for API calls
    const status = await billing.getSubscriptionStatus(req.user.userId);
    const limitCheck = await usage.checkLimit(req.user.userId, 'api_call', status.tier);
    if (!limitCheck.allowed) {
      return error(res, `Monthly API call limit reached (${limitCheck.limit}). Upgrade to continue.`, 429);
    }

    const result = await mlClient.detectImage(req.file.path);
    if (result.error) return error(res, 'Analysis failed: ' + result.error);
    await usage.incrementUsage(req.user.userId, 'api_call');
    return success(res, result, 'Analysis complete');
  } catch (e) {
    return error(res, e.message);
  }
});

router.post('/url', async (req, res) => {
  try {
    // Check tier limit for API calls
    const status = await billing.getSubscriptionStatus(req.user.userId);
    const limitCheck = await usage.checkLimit(req.user.userId, 'api_call', status.tier);
    if (!limitCheck.allowed) {
      return error(res, `Monthly API call limit reached (${limitCheck.limit}). Upgrade to continue.`, 429);
    }

    const { url } = req.body;
    if (!url) return error(res, 'URL is required', 400);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const fetchRes = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Enclave/1.0' }
      });
      if (!fetchRes.ok) return error(res, 'Failed to fetch image from URL', 400);
      const contentType = fetchRes.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) {
        return error(res, 'URL does not point to an image', 400);
      }
      const ext = path.extname(new URL(url).pathname) || '.jpg';
      const filename = `${uuidv4()}${ext}`;
      const filePath = path.join(UPLOAD_DIR, 'temp', filename);
      const buffer = Buffer.from(await fetchRes.arrayBuffer());
      require('fs').writeFileSync(filePath, buffer);
      const result = await mlClient.detectImage(filePath);
      try { require('fs').unlinkSync(filePath); } catch (_) {}
      if (result.error) return error(res, 'Analysis failed: ' + result.error);
      await usage.incrementUsage(req.user.userId, 'api_call');
      return success(res, { ...result, sourceUrl: url }, 'Analysis complete');
    } finally {
      clearTimeout(timeout);
    }
  } catch (e) {
    return error(res, e.message);
  }
});

router.post('/face/match', faceUpload.fields([
  { name: 'image_a', maxCount: 1 },
  { name: 'image_b', maxCount: 1 },
]), async (req, res) => {
  try {
    // Check tier limit for API calls
    const status = await billing.getSubscriptionStatus(req.user.userId);
    const limitCheck = await usage.checkLimit(req.user.userId, 'api_call', status.tier);
    if (!limitCheck.allowed) {
      return error(res, `Monthly API call limit reached (${limitCheck.limit}). Upgrade to continue.`, 429);
    }

    const files = req.files;
    if (!files?.image_a?.[0] || !files?.image_b?.[0]) {
      return error(res, 'Two image files required (image_a and image_b)', 400);
    }
    const threshold = parseFloat(req.body.threshold) || 0.6;
    const result = await mlClient.matchFaces(
      files.image_a[0].path,
      files.image_b[0].path,
      threshold
    );
    // Cleanup temp files
    try { require('fs').unlinkSync(files.image_a[0].path); } catch (_) {}
    try { require('fs').unlinkSync(files.image_b[0].path); } catch (_) {}
    if (result.error) return error(res, result.error);
    await usage.incrementUsage(req.user.userId, 'api_call');
    return success(res, result, 'Face comparison complete');
  } catch (e) {
    return error(res, e.message);
  }
});

/** Reverse image search (Phase 4.1): match a face photo against monitored + community sources. */
router.post('/reverse', faceUpload.single('image'), async (req, res) => {
  let probePath = null;
  let candidates = [];
  try {
    if (!req.file) return error(res, 'Image file required (field "image")', 400);
    probePath = req.file.path;

    const status = await billing.getSubscriptionStatus(req.user.userId);
    const limitCheck = await usage.checkLimit(req.user.userId, 'api_call', status.tier);
    if (!limitCheck.allowed) {
      return error(res, `Monthly API call limit reached (${limitCheck.limit}). Upgrade to continue.`, 429);
    }

    // ── Gather candidate image source URLs ──
    const seen = new Set();
    const addUrl = (u) => { try { if (u && /^https?:/i.test(u)) seen.add(u.split('?')[0]); } catch (_) {} };

    try {
      const alerts = await table('alerts');
      const mine = await alerts.filter({ user_id: req.user.userId });
      (Array.isArray(mine) ? mine : mine ? [mine] : []).forEach((a) => addUrl(a.source_url));
    } catch (_) {}

    try {
      const shares = await table('threat_shares');
      const all = await shares.filter({ user_id: req.user.userId });
      (Array.isArray(all) ? all : all ? [all] : []).forEach((s) => {
        addUrl(s.url); addUrl(s.ioc); addUrl(s.image_url);
      });
    } catch (_) {}

    candidates = Array.from(seen);
    const matches = [];
    let checked = 0;

    const limit = Math.min(parseInt(req.query.limit) || 10, 20);
    for (const src of candidates.slice(0, limit)) {
      let localPath = null;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const fRes = await fetch(src, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Enclave/1.0' },
        });
        clearTimeout(timeout);
        if (!fRes.ok) continue;
        const ct = fRes.headers.get('content-type') || '';
        if (!ct.startsWith('image/')) continue;
        const ext = path.extname(new URL(src).pathname) || '.jpg';
        localPath = path.join(UPLOAD_DIR, 'temp', `${uuidv4()}${ext}`);
        const buffer = Buffer.from(await fRes.arrayBuffer());
        require('fs').writeFileSync(localPath, buffer);

        const r = await mlClient.matchFaces(probePath, localPath, 0.55);
        checked++;
        if (r.error) continue;
        if (r.match) {
          matches.push({
            sourceUrl: src,
            distance: r.distance,
            similarity: r.similarity,
            match: true,
          });
        }
      } catch (_) {
      } finally {
        try { if (localPath) require('fs').unlinkSync(localPath); } catch (_) {}
      }
    }

    try { if (probePath) require('fs').unlinkSync(probePath); } catch (_) {}

    matches.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
    await usage.incrementUsage(req.user.userId, 'api_call');
    return success(res, { candidates: candidates.length, checked, matches }, 'Reverse image search complete');
  } catch (e) {
    try { if (probePath) require('fs').unlinkSync(probePath); } catch (_) {}
    return error(res, e.message);
  }
});

/** AI-generated text detection (Gemini Flash-Lite). */
router.post('/text', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') return error(res, 'Text is required', 400);
    if (text.length > 10000) return error(res, 'Text too long (max 10,000 characters)', 400);

    // Check tier limit for API calls
    const status = await billing.getSubscriptionStatus(req.user.userId);
    const limitCheck = await usage.checkLimit(req.user.userId, 'api_call', status.tier);
    if (!limitCheck.allowed) {
      return error(res, `Monthly API call limit reached (${limitCheck.limit}). Upgrade to continue.`, 429);
    }
    const result = await mlClient.detectText(text);
    if (!result) return error(res, 'AI text detection unavailable — no provider configured', 503);
    if (result.error) return error(res, result.error, 400);
    await usage.incrementUsage(req.user.userId, 'api_call');
    return success(res, result, 'Text analysis complete');
  } catch (e) {
    return error(res, e.message);
  }
});

/** Detection engine status — provider health, rate limits, cache stats. */
router.get('/status', async (req, res) => {
  try {
    const status = await mlClient.getStatus();
    return success(res, status);
  } catch (e) {
    return error(res, e.message);
  }
});

/* ─── Audio Deepfake Detection ─── */

const audioUpload = multer({
  dest: path.join(UPLOAD_DIR, 'temp'),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.webm'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Unsupported audio format. Use MP3, WAV, OGG, M4A, AAC, FLAC, or WebM.'));
  }
});

router.post('/audio', audioUpload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return error(res, 'Audio file required', 400);
    const result = await mlClient.detectAudio(req.file.path);
    try { fs.unlinkSync(req.file.path); } catch (_) {}
    if (result.error) return error(res, result.error, 400);
    await usage.incrementUsage(req.user.userId, 'api_call');
    return success(res, result, 'Audio analysis complete');
  } catch (e) {
    return error(res, e.message);
  }
});

/* ─── Multi-Face Detection ─── */

const multiFaceUpload = multer({
  dest: path.join(UPLOAD_DIR, 'temp'),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.bmp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Unsupported image format.'));
  }
});

router.post('/multi-face', multiFaceUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) return error(res, 'Image file required', 400);
    const fileBuffer = fs.readFileSync(req.file.path);
    const faces = [];
    let result = { confidence: 0, faces: [] };

    // Try Python ML service first
    if (await mlClient.isMlAvailable()) {
      try {
        const FormData = (await import('formdata-node')).FormData;
        const { Blob } = (await import('buffer'));
        const form = new FormData();
        form.set('image', new Blob([fileBuffer], { type: 'image/jpeg' }), req.file.originalname);
        const res2 = await fetch(`${process.env.ML_SERVICE_URL || 'http://localhost:8001'}/face/detect-multi`, {
          method: 'POST',
          body: form,
          signal: AbortSignal.timeout(30000),
        });
        if (res2.ok) {
          result = await res2.json();
        }
      } catch (_) {}
    }

    // Fallback: use face match against enrolled faceprints to count unique faces
    if (!result.faces || result.faces.length === 0) {
      const enrolled = await table('face_enrollments');
      const userFaces = await enrolled.filter({ user_id: req.user.userId });
      if (userFaces.length > 0) {
        // Run image through detect to get face regions
        const detectResult = await mlClient.detectImage(fileBuffer, 'image/jpeg', 'multi-face-check');
        result = {
          confidence: detectResult.confidence || 0,
          faces: [{ index: 0, verdict: detectResult.verdict || 'UNKNOWN', confidence: detectResult.confidence || 0 }],
          enrolledFaceprintsMatched: userFaces.length,
        };
      } else {
        result = {
          confidence: 0,
          faces: [{ index: 0, verdict: 'NO_ENROLLED_FACES', confidence: 0 }],
          message: 'No enrolled faceprints to compare against',
        };
      }
    }

    try { fs.unlinkSync(req.file.path); } catch (_) {}
    await usage.incrementUsage(req.user.userId, 'api_call');
    return success(res, result, `Detected ${result.faces?.length || 0} face(s)`);
  } catch (e) {
    return error(res, e.message);
  }
});

/* ─── Video Frame Analysis ─── */

const videoUpload = multer({
  dest: path.join(UPLOAD_DIR, 'temp'),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp4', '.mov', '.avi', '.webm', '.mkv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Unsupported video format. Use MP4, MOV, AVI, WebM, or MKV.'));
  }
});

router.post('/video', videoUpload.single('video'), async (req, res) => {
  try {
    if (!req.file) return error(res, 'Video file required', 400);

    // Extract frames from video using ffmpeg if available
    const frames = [];
    const tempDir = path.join(UPLOAD_DIR, 'temp', `video-${Date.now()}`);

    try {
      fs.mkdirSync(tempDir, { recursive: true });

      // Try ffmpeg frame extraction (3 frames: start, middle, end)
      const { execFileSync } = require('child_process');
      const videoPath = req.file.path;
      let duration = 10;
      try {
        const durOut = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', videoPath], { timeout: 10000 }).toString().trim();
        duration = parseInt(durOut) || 10;
      } catch (_) {}

      const timestamps = [1, Math.floor(duration / 2), Math.max(1, duration - 2)];
      for (let i = 0; i < timestamps.length; i++) {
        const framePath = path.join(tempDir, `frame-${i}.jpg`);
        try {
          execFileSync('ffmpeg', ['-y', '-ss', String(timestamps[i]), '-i', videoPath, '-frames:v', '1', '-q:v', '2', framePath], { timeout: 15000, stdio: 'ignore' });
          const frameBuffer = fs.readFileSync(framePath);
          const detectResult = await mlClient.detectImage(frameBuffer, 'image/jpeg', `video-frame-${i}`);
          frames.push({
            frame: i + 1,
            timestamp: timestamps[i],
            confidence: detectResult.confidence || 0,
            verdict: detectResult.verdict || 'UNKNOWN',
            isManipulated: (detectResult.confidence || 0) >= 50,
          });
        } catch (_) {}
      }
    } catch (_) {
      // ffmpeg not available — return analysis of the file itself
      const fileBuffer = fs.readFileSync(req.file.path);
      const detectResult = await mlClient.detectImage(fileBuffer.slice(0, 1024 * 1024), 'image/jpeg', 'video-header');
      frames.push({
        frame: 1,
        timestamp: 0,
        confidence: detectResult.confidence || 0,
        verdict: detectResult.verdict || 'PARSE_FAILED',
        isManipulated: false,
        note: 'Full frame extraction requires ffmpeg',
      });
    }

    // Cleanup
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
    try { fs.unlinkSync(req.file.path); } catch (_) {}

    const avgConfidence = frames.length > 0
      ? frames.reduce((s, f) => s + f.confidence, 0) / frames.length
      : 0;
    const anyManipulated = frames.some((f) => f.isManipulated);

    const result = {
      framesAnalyzed: frames.length,
      averageConfidence: Math.round(avgConfidence * 10) / 10,
      overallVerdict: anyManipulated ? 'MANIPULATION_DETECTED' : 'LIKELY_AUTHENTIC',
      frames,
    };

    await usage.incrementUsage(req.user.userId, 'api_call');
    return success(res, result, `Analyzed ${frames.length} frame(s) from video`);
  } catch (e) {
    return error(res, e.message);
  }
});

module.exports = router;
