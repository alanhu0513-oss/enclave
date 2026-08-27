const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');
const mlClient = require('../services/ml-client');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
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
    const result = await mlClient.detectImage(req.file.path);
    if (result.error) return error(res, 'Analysis failed: ' + result.error);
    return success(res, result, 'Analysis complete');
  } catch (e) {
    return error(res, e.message);
  }
});

router.post('/url', async (req, res) => {
  try {
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
    return success(res, result, 'Face comparison complete');
  } catch (e) {
    return error(res, e.message);
  }
});

/** AI-generated text detection (Gemini Flash-Lite). */
router.post('/text', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') return error(res, 'Text is required', 400);
    if (text.length > 10000) return error(res, 'Text too long (max 10,000 characters)', 400);
    const result = await mlClient.detectText(text);
    if (!result) return error(res, 'AI text detection unavailable — no provider configured', 503);
    if (result.error) return error(res, result.error, 400);
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
