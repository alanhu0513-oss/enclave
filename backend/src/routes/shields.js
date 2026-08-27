const express = require('express');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');

const router = express.Router();
router.use(authenticate);

// Per-user shield stats (in-memory, resets on restart)
const userShieldStats = new Map();

function getShieldStats(userId) {
  if (!userShieldStats.has(userId)) {
    userShieldStats.set(userId, {
      imagesScanned: 0,
      deepfakesDetected: 0,
      deepfakesFound: 0,
      watermarksEmbedded: 0,
      c2paCredentialsEmbedded: 0,
      voiceEnrollments: 0,
      voiceVerifications: 0,
      voiceMatches: 0,
      voiceRejections: 0,
      takedownsInitiated: 0,
      takedownsCompleted: 0,
      alertsGenerated: 0,
      threatsBlocked: 0,
      crawlerRuns: 0,
      urlsScanned: 0,
      faceMatches: 0,
      sessionsProtected: 0,
      shieldActivations: 0,
      firstActivatedAt: null,
      lastScanAt: null,
      lastDetectionAt: null,
      lastTakedownAt: null,
      recentActivity: []
    });
  }
  return userShieldStats.get(userId);
}

function addActivity(stats, type, detail, status) {
  stats.recentActivity.unshift({
    type,
    detail: detail || '',
    status: status || 'success',
    timestamp: new Date().toISOString()
  });
  if (stats.recentActivity.length > 100) {
    stats.recentActivity = stats.recentActivity.slice(0, 100);
  }
}

// GET /api/shields/stats
router.get('/stats', (req, res) => {
  const stats = getShieldStats(req.user.userId);
  return success(res, {
    ...stats,
    recentActivity: stats.recentActivity.slice(0, 20)
  });
});

// GET /api/shields/summary
router.get('/summary', (req, res) => {
  const stats = getShieldStats(req.user.userId);
  return success(res, {
    imagesScanned: stats.imagesScanned,
    deepfakesFound: stats.deepfakesFound,
    watermarksEmbedded: stats.watermarksEmbedded,
    c2paCredentialsEmbedded: stats.c2paCredentialsEmbedded,
    threatsBlocked: stats.threatsBlocked,
    takedownsCompleted: stats.takedownsCompleted,
    voiceEnrollments: stats.voiceEnrollments,
    sessionsProtected: stats.sessionsProtected,
    firstActivatedAt: stats.firstActivatedAt,
    lastScanAt: stats.lastScanAt,
    lastDetectionAt: stats.lastDetectionAt,
    lastTakedownAt: stats.lastTakedownAt,
    recentActivity: stats.recentActivity.slice(0, 10)
  });
});

// POST /api/shields/record — Generic event recorder
router.post('/record', (req, res) => {
  const { type, detail, status: statusVal } = req.body;
  if (!type) return error(res, 'Event type required', 400);
  const stats = getShieldStats(req.user.userId);

  switch (type) {
    case 'scan':
      stats.imagesScanned++;
      stats.lastScanAt = new Date().toISOString();
      addActivity(stats, 'scan', detail, statusVal);
      break;
    case 'detection':
      stats.deepfakesDetected++;
      if (statusVal === 'threat' || statusVal === 'blocked') {
        stats.deepfakesFound++;
        stats.threatsBlocked++;
        stats.lastDetectionAt = new Date().toISOString();
      }
      addActivity(stats, 'detection', detail, statusVal);
      break;
    case 'watermark':
      stats.watermarksEmbedded++;
      addActivity(stats, 'watermark', detail, 'success');
      break;
    case 'c2pa':
      stats.c2paCredentialsEmbedded++;
      addActivity(stats, 'c2pa', detail, 'success');
      break;
    case 'voice_enroll':
      stats.voiceEnrollments++;
      addActivity(stats, 'voice', detail || 'enrolled', 'success');
      break;
    case 'voice_verify':
      stats.voiceVerifications++;
      if (statusVal === 'match') stats.voiceMatches++;
      else if (statusVal === 'reject') { stats.voiceRejections++; stats.threatsBlocked++; }
      addActivity(stats, 'voice', detail, statusVal);
      break;
    case 'takedown':
      stats.takedownsInitiated++;
      stats.lastTakedownAt = new Date().toISOString();
      if (statusVal === 'completed') stats.takedownsCompleted++;
      addActivity(stats, 'takedown', detail, statusVal);
      break;
    case 'alert':
      stats.alertsGenerated++;
      addActivity(stats, 'alert', detail, statusVal || 'info');
      break;
    case 'shield_activate':
      stats.shieldActivations++;
      addActivity(stats, 'shield', detail || 'activated', 'success');
      break;
    case 'session':
      stats.sessionsProtected++;
      addActivity(stats, 'session', detail || 'protected', 'success');
      break;
    default:
      return error(res, `Unknown event type: ${type}`, 400);
  }

  if (!stats.firstActivatedAt) stats.firstActivatedAt = new Date().toISOString();

  return success(res, { recorded: true });
});

// POST /api/shields/reset
router.post('/reset', (req, res) => {
  userShieldStats.delete(req.user.userId);
  return success(res, { reset: true });
});

module.exports = router;
