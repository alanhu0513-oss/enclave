const express = require('express');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');
const { table } = require('../db/query');

const router = express.Router();
router.use(authenticate);

const DEFAULT_STATS = {
  images_scanned: 0,
  deepfakes_detected: 0,
  deepfakes_found: 0,
  watermarks_embedded: 0,
  c2pa_credentials_embedded: 0,
  voice_enrollments: 0,
  voice_verifications: 0,
  voice_matches: 0,
  voice_rejections: 0,
  takedowns_initiated: 0,
  takedowns_completed: 0,
  alerts_generated: 0,
  threats_blocked: 0,
  crawler_runs: 0,
  urls_scanned: 0,
  face_matches: 0,
  sessions_protected: 0,
  shield_activations: 0,
  first_activated_at: null,
  last_scan_at: null,
  last_detection_at: null,
  last_takedown_at: null,
  recent_activity: '[]',
};

async function getShieldStats(userId) {
  const tbl = await table('shield_stats');
  let stats = await tbl.find({ user_id: userId });
  if (!stats) {
    stats = { user_id: userId, ...DEFAULT_STATS };
    await tbl.insert(stats);
  }
  return stats;
}

async function addActivity(tbl, stats, type, detail, status) {
  const activity = typeof stats.recent_activity === 'string' ? JSON.parse(stats.recent_activity) : (stats.recent_activity || []);
  activity.unshift({ type, detail: detail || '', status: status || 'success', timestamp: new Date().toISOString() });
  if (activity.length > 100) activity.length = 100;
  await tbl.update({ user_id: stats.user_id }, { recent_activity: JSON.stringify(activity) });
}

// GET /api/shields/stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await getShieldStats(req.user.userId);
    const activity = typeof stats.recent_activity === 'string' ? JSON.parse(stats.recent_activity) : (stats.recent_activity || []);
    return success(res, { ...stats, recent_activity: undefined, recentActivity: activity.slice(0, 20) });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

// GET /api/shields/summary
router.get('/summary', async (req, res) => {
  try {
    const stats = await getShieldStats(req.user.userId);
    const activity = typeof stats.recent_activity === 'string' ? JSON.parse(stats.recent_activity) : (stats.recent_activity || []);
    return success(res, {
      imagesScanned: stats.images_scanned,
      deepfakesFound: stats.deepfakes_found,
      watermarksEmbedded: stats.watermarks_embedded,
      c2paCredentialsEmbedded: stats.c2pa_credentials_embedded,
      threatsBlocked: stats.threats_blocked,
      takedownsCompleted: stats.takedowns_completed,
      voiceEnrollments: stats.voice_enrollments,
      sessionsProtected: stats.sessions_protected,
      firstActivatedAt: stats.first_activated_at,
      lastScanAt: stats.last_scan_at,
      lastDetectionAt: stats.last_detection_at,
      lastTakedownAt: stats.last_takedown_at,
      recentActivity: activity.slice(0, 10),
    });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

// POST /api/shields/record
router.post('/record', async (req, res) => {
  try {
    const { type, detail, status: statusVal } = req.body;
    if (!type) return error(res, 'Event type required', 400);

    const userId = req.user.userId;
    const tbl = await table('shield_stats');
    const stats = await getShieldStats(userId);

    const updates = {};
    switch (type) {
      case 'scan':
        updates.images_scanned = (stats.images_scanned || 0) + 1;
        updates.last_scan_at = new Date().toISOString();
        break;
      case 'detection':
        updates.deepfakes_detected = (stats.deepfakes_detected || 0) + 1;
        if (statusVal === 'threat' || statusVal === 'blocked') {
          updates.deepfakes_found = (stats.deepfakes_found || 0) + 1;
          updates.threats_blocked = (stats.threats_blocked || 0) + 1;
          updates.last_detection_at = new Date().toISOString();
        }
        break;
      case 'watermark':
        updates.watermarks_embedded = (stats.watermarks_embedded || 0) + 1;
        break;
      case 'c2pa':
        updates.c2pa_credentials_embedded = (stats.c2pa_credentials_embedded || 0) + 1;
        break;
      case 'voice_enroll':
        updates.voice_enrollments = (stats.voice_enrollments || 0) + 1;
        break;
      case 'voice_verify':
        updates.voice_verifications = (stats.voice_verifications || 0) + 1;
        if (statusVal === 'match') updates.voice_matches = (stats.voice_matches || 0) + 1;
        else if (statusVal === 'reject') {
          updates.voice_rejections = (stats.voice_rejections || 0) + 1;
          updates.threats_blocked = (stats.threats_blocked || 0) + 1;
        }
        break;
      case 'takedown':
        updates.takedowns_initiated = (stats.takedowns_initiated || 0) + 1;
        updates.last_takedown_at = new Date().toISOString();
        if (statusVal === 'completed') updates.takedowns_completed = (stats.takedowns_completed || 0) + 1;
        break;
      case 'alert':
        updates.alerts_generated = (stats.alerts_generated || 0) + 1;
        break;
      case 'shield_activate':
        updates.shield_activations = (stats.shield_activations || 0) + 1;
        break;
      case 'session':
        updates.sessions_protected = (stats.sessions_protected || 0) + 1;
        break;
      default:
        return error(res, `Unknown event type: ${type}`, 400);
    }

    if (!stats.first_activated_at) updates.first_activated_at = new Date().toISOString();

    await tbl.update({ user_id: userId }, updates);
    await addActivity(tbl, stats, type, detail, statusVal);

    return success(res, { recorded: true });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

// POST /api/shields/reset
router.post('/reset', async (req, res) => {
  try {
    const tbl = await table('shield_stats');
    await tbl.remove({ user_id: req.user.userId });
    return success(res, { reset: true });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

module.exports = router;
