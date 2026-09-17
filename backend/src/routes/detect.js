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

/**
 * Merge enrolled-identity match info into a detect result WITHOUT altering the
 * synthesis verdict. A synthetic verdict must never be suppressed by an identity
 * match (a cloned face still matches the enrolled identity — that IS the threat).
 * Best-effort: returns an identity block; matching engine may be unavailable.
 */
async function _attachIdentity(userId, probePath, result) {
  const identity = { enrolled: false, match: null, available: false };
  try {
    const faceprints = await table('faceprints');
    const list = await faceprints.filter({ user_id: userId });
    const enrolled = (Array.isArray(list) ? list : list ? [list] : []).filter((fp) => fp && fp.file_path);
    if (!enrolled.length) {
      // No enrolled faceprint — identity check N/A but reported for transparency
      return { ...result, identity: { ...identity, reason: 'no_enrolled_faceprint' } };
    }
    identity.enrolled = true;

    if (!(result.face_count > 0)) {
      // No face detected in media — still surface enrolled status honestly
      return { ...result, identity: { ...identity, reason: 'no_face_in_media' } };
    }

    let best = null;
    for (const fp of enrolled) {
      try {
        const r = await mlClient.matchFaces(probePath, fp.file_path, 0.6);
        if (r && !r.error && r.similarity != null) {
          if (!best || r.similarity > best.similarity) {
            best = { faceprintId: fp.id, similarity: r.similarity, distance: r.distance };
          }
        }
      } catch (_) {}
    }

    if (best) {
      identity.match = best.similarity >= 0.65;
      identity.verdict = best.similarity >= 0.65 ? 'IDENTITY_MATCH' : (best.similarity >= 0.4 ? 'IDENTITY_AMBIGUOUS' : 'IDENTITY_MISMATCH');
      identity.similarity = Math.round(best.similarity * 1000) / 1000;
      identity.distance = best.distance != null ? Math.round(best.distance * 1000) / 1000 : null;
      identity.faceprintId = best.faceprintId;
      identity.available = true;
    } else {
      identity.reason = 'matching_unavailable';
    }
  } catch (e) {
    console.warn('[DETECT] identity merge failed:', e.message);
    identity.reason = 'matching_unavailable';
  }
  return { ...result, identity };
}

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
    const withIdentity = await _attachIdentity(req.user.userId, req.file.path, result);
    try { require('fs').unlinkSync(req.file.path); } catch (_) {}
    await usage.incrementUsage(req.user.userId, 'api_call');
    return success(res, withIdentity, 'Analysis complete');
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
      if (result.error) { try { require('fs').unlinkSync(filePath); } catch (_) {} return error(res, 'Analysis failed: ' + result.error); }
      const withIdentity = await _attachIdentity(req.user.userId, filePath, result);
      try { require('fs').unlinkSync(filePath); } catch (_) {}
      await usage.incrementUsage(req.user.userId, 'api_call');
      return success(res, { ...withIdentity, sourceUrl: url }, 'Analysis complete');
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
    const MAX_FRAMES = 20;

    try {
      fs.mkdirSync(tempDir, { recursive: true });

      const { execFileSync } = require('child_process');
      const videoPath = req.file.path;
      let duration = 10;
      try {
        const durOut = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', videoPath], { timeout: 10000 }).toString().trim();
        duration = parseInt(durOut) || 10;
      } catch (_) {}

      const frameCount = Math.max(2, Math.min(MAX_FRAMES, duration));
      const timestamps = [];
      for (let i = 0; i < frameCount; i++) {
        const t = Math.floor((duration * (i + 0.5)) / frameCount);
        timestamps.push(Math.max(0, Math.min(duration - 1, t)));
      }

      for (let i = 0; i < timestamps.length; i++) {
        const framePath = path.join(tempDir, `frame-${i}.jpg`);
        try {
          execFileSync('ffmpeg', ['-y', '-ss', String(timestamps[i]), '-i', videoPath, '-frames:v', '1', '-q:v', '2', framePath], { timeout: 15000, stdio: 'ignore' });
          const frameBuffer = fs.readFileSync(framePath);
          const detectResult = await mlClient.detectImageBuffer(frameBuffer, 'image/jpeg', `video-frame-${i}`);
          frames.push({
            frame: i + 1,
            timestamp: timestamps[i],
            confidence: detectResult.confidence || 0,
            verdict: detectResult.verdict || 'UNKNOWN',
            final_verdict: detectResult.final_verdict || detectResult.verdict || 'UNKNOWN',
            ml_avg_score: detectResult.ml_avg_score != null ? detectResult.ml_avg_score : null,
            low_confidence: !!detectResult.low_confidence,
            isManipulated: (detectResult.confidence || 0) >= 50,
          });
        } catch (e) {
          console.error(`[Video] frame ${i} extraction failed:`, e.message?.split('\n')[0], e.stderr?.toString().split('\n')[0]);
          try { fs.rmSync(framePath, { force: true }); } catch (_) {}
        }
      }
    } catch (_) {
      // ffmpeg not available — return analysis of the file itself
      const fileBuffer = fs.readFileSync(req.file.path);
      const detectResult = await mlClient.detectImageBuffer(fileBuffer.slice(0, 1024 * 1024), 'image/jpeg', 'video-header');
      frames.push({
        frame: 1,
        timestamp: 0,
        confidence: detectResult.confidence || 0,
        verdict: detectResult.verdict || 'PARSE_FAILED',
        final_verdict: detectResult.final_verdict || detectResult.verdict || 'PARSE_FAILED',
        ml_avg_score: detectResult.ml_avg_score != null ? detectResult.ml_avg_score : null,
        low_confidence: !!detectResult.low_confidence,
        isManipulated: false,
        note: 'Full frame extraction requires ffmpeg',
      });
    }

    // Cleanup
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
    try { fs.unlinkSync(req.file.path); } catch (_) {}

const analyzed = frames.filter((f) => !f.note);
    const avgConfidence = analyzed.length > 0
      ? analyzed.reduce((s, f) => s + f.confidence, 0) / analyzed.length
      : 0;
    const anyManipulated = analyzed.some((f) => f.isManipulated);
    const anyLowConf = analyzed.some((f) => f.low_confidence);

    // Cross-frame consistency: high variance ⇒ unreliable, keep honest low-confidence marker
    let scoreVariance = null;
    const scores = analyzed.map((f) => f.ml_avg_score).filter((s) => s != null);
    if (scores.length >= 2) {
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      scoreVariance = Math.round((scores.reduce((a, b) => a + (b - mean) * (b - mean), 0) / scores.length) * 10000) / 10000;
      if (scoreVariance > 0.12) anyLowConf = true;
    }

    const synthCount = analyzed.filter((f) => f.verdict === 'LIKELY_SYNTHETIC').length;
    const natCount = analyzed.filter((f) => f.verdict === 'LIKELY_NATURAL').length;
    const consistent = analyzed.length > 0 && (synthCount === 0 || natCount === 0);

    const result = {
      framesAnalyzed: analyzed.length,
      totalFrames: frames.length,
      averageConfidence: Math.round(avgConfidence * 10) / 10,
      overallVerdict: anyManipulated ? 'MANIPULATION_DETECTED' : 'LIKELY_AUTHENTIC',
      final_verdict: anyManipulated ? 'MANIPULATION_DETECTED' : 'LIKELY_AUTHENTIC',
      low_confidence: anyLowConf || (analyzed.length > 0 && anyManipulated === consistent && avgConfidence > 35 && avgConfidence < 60),
      score_variance: scoreVariance,
      frames,
    };

    // Identity merge against the best-scoring (most authoritative) face frame.
    // Synthesis verdict is never altered — identity is an independent signal.
    let withIdentity = result;
    try {
      const frameFiles = fs.existsSync(tempDir)
        ? fs.readdirSync(tempDir).filter((f) => /\.jpg$/.test(f))
        : [];
      if (frameFiles.length > 0) {
        const bestFrame = frameFiles[0];
        withIdentity = await _attachIdentity(req.user.userId, path.join(tempDir, bestFrame), result);
      } else {
        withIdentity = await _attachIdentity(req.user.userId, req.file.path, result);
      }
    } catch (e) {
      console.warn('[Video] identity merge failed:', e.message);
    }

    // Cleanup
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
    try { fs.unlinkSync(req.file.path); } catch (_) {}

    await usage.incrementUsage(req.user.userId, 'api_call');
    return success(res, withIdentity, `Analyzed ${analyzed.length} frame(s) from video`);
  } catch (e) {
    return error(res, e.message);
  }
});

module.exports = router;
