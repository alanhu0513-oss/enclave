const express = require('express');
const multer = require('multer');
const path = require('path');
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

module.exports = router;
