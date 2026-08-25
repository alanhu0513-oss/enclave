const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { table } = require('../db/query');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dirs = { face: 'faces', voice: 'voices', signature: 'signatures' };
    cb(null, path.join(UPLOAD_DIR, dirs[file.fieldname] || 'misc'));
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname) || '.png'}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const router = express.Router();
router.use(authenticate);

router.post('/face', upload.single('face'), async (req, res) => {
  try {
    if (!req.file) return error(res, 'Face image required', 400);
    const id = uuidv4();
    const { width = 64, height = 48 } = req.body;
    const faceprints = await table('faceprints');
    await faceprints.insert({
      id, user_id: req.user.userId, file_path: req.file.path,
      width: parseInt(width), height: parseInt(height),
      created_at: new Date().toISOString()
    });
    return success(res, { id, filePath: req.file.path }, 'Faceprint saved');
  } catch (e) {
    return error(res, e.message);
  }
});

router.post('/voice', upload.single('voice'), async (req, res) => {
  try {
    if (!req.file) return error(res, 'Voice recording required', 400);
    const id = uuidv4();
    const { profile, bins = 64, sampleRate = 44100, fftSize = 128, frames = 0, durationMs = 10000 } = req.body;
    const voiceprints = await table('voiceprints');
    await voiceprints.insert({
      id, user_id: req.user.userId,
      profile_json: JSON.stringify(profile || []),
      bins: parseInt(bins), sample_rate: parseInt(sampleRate),
      fft_size: parseInt(fftSize), frames: parseInt(frames),
      duration_ms: parseInt(durationMs),
      created_at: new Date().toISOString()
    });
    return success(res, { id }, 'Voiceprint saved');
  } catch (e) {
    return error(res, e.message);
  }
});

router.post('/signature', upload.single('signature'), async (req, res) => {
  try {
    if (!req.file) return error(res, 'Signature image required', 400);
    const id = uuidv4();
    const signatures = await table('signatures');
    await signatures.insert({
      id, user_id: req.user.userId, file_path: req.file.path,
      created_at: new Date().toISOString()
    });
    return success(res, { id, filePath: req.file.path }, 'Signature saved');
  } catch (e) {
    return error(res, e.message);
  }
});

router.get('/status', async (req, res) => {
  try {
    const uid = req.user.userId;
    const faceprints = await table('faceprints');
    const voiceprints = await table('voiceprints');
    const signatures = await table('signatures');
    const [faceprint, voiceprint, signature] = await Promise.all([
      faceprints.find({ user_id: uid }),
      voiceprints.find({ user_id: uid }),
      signatures.find({ user_id: uid })
    ]);
    return success(res, { faceprint, voiceprint, signature });
  } catch (e) {
    return error(res, e.message);
  }
});

router.post('/voice/enroll', async (req, res) => {
  try {
    const { voiceprint, numFrames, variance } = req.body;
    if (!voiceprint || !Array.isArray(voiceprint)) {
      return error(res, 'Voiceprint array required', 400);
    }
    const id = uuidv4();
    const voiceprints = await table('voiceprints');
    await voiceprints.insert({
      id, user_id: req.user.userId,
      profile_json: JSON.stringify(voiceprint),
      variance_json: JSON.stringify(variance || []),
      bins: voiceprint.length, sample_rate: 16000,
      fft_size: 1024, frames: numFrames || 0,
      duration_ms: 3000,
      created_at: new Date().toISOString()
    });
    return success(res, { id, enrolled: true }, 'Voice enrolled successfully');
  } catch (e) {
    return error(res, e.message);
  }
});

router.post('/voice/verify', async (req, res) => {
  try {
    const { voiceprint, threshold } = req.body;
    if (!voiceprint || !Array.isArray(voiceprint)) {
      return error(res, 'Voiceprint array required', 400);
    }
    const uid = req.user.userId;
    const voiceprints = await table('voiceprints');
    const enrolled = await voiceprints.find({ user_id: uid });
    if (!enrolled || !enrolled.profile_json) {
      return error(res, 'No enrolled voiceprint found', 404);
    }

    const stored = JSON.parse(enrolled.profile_json);
    const dim = Math.min(stored.length, voiceprint.length);
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < dim; i++) {
      dot += stored[i] * voiceprint[i];
      normA += stored[i] * stored[i];
      normB += voiceprint[i] * voiceprint[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    const cosineSimilarity = denom > 0 ? dot / denom : 0;
    const thresh = threshold || 0.85;
    const match = cosineSimilarity >= thresh;

    return success(res, {
      match,
      cosineSimilarity: Math.round(cosineSimilarity * 1000) / 1000,
      threshold: thresh,
      enrolledAt: enrolled.created_at
    });
  } catch (e) {
    return error(res, e.message);
  }
});

module.exports = router;
