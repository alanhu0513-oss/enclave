const express = require('express');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');

const router = express.Router();
router.use(authenticate);

// In-memory shield stats (per-server session, resets on restart)
let shieldStats = {
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
};

function addActivity(type, detail, status) {
  shieldStats.recentActivity.unshift({
    type,
    detail: detail || '',
    status: status || 'success',
    timestamp: new Date().toISOString()
  });
  if (shieldStats.recentActivity.length > 100) {
    shieldStats.recentActivity = shieldStats.recentActivity.slice(0, 100);
  }
}

// GET /api/shields/stats
router.get('/stats', (req, res) => {
  return success(res, {
    ...shieldStats,
    recentActivity: shieldStats.recentActivity.slice(0, 20)
  });
});

// GET /api/shields/summary
router.get('/summary', (req, res) => {
  return success(res, {
    imagesScanned: shieldStats.imagesScanned,
    deepfakesFound: shieldStats.deepfakesFound,
    watermarksEmbedded: shieldStats.watermarksEmbedded,
    c2paCredentialsEmbedded: shieldStats.c2paCredentialsEmbedded,
    threatsBlocked: shieldStats.threatsBlocked,
    takedownsCompleted: shieldStats.takedownsCompleted,
    voiceEnrollments: shieldStats.voiceEnrollments,
    sessionsProtected: shieldStats.sessionsProtected,
    firstActivatedAt: shieldStats.firstActivatedAt,
    lastScanAt: shieldStats.lastScanAt,
    lastDetectionAt: shieldStats.lastDetectionAt,
    lastTakedownAt: shieldStats.lastTakedownAt,
    recentActivity: shieldStats.recentActivity.slice(0, 10)
  });
});

// POST /api/shields/record — Generic event recorder
router.post('/record', (req, res) => {
  const { type, detail, status: statusVal } = req.body;
  if (!type) return error(res, 'Event type required', 400);

  switch (type) {
    case 'scan':
      shieldStats.imagesScanned++;
      shieldStats.lastScanAt = new Date().toISOString();
      addActivity('scan', detail, statusVal);
      break;
    case 'detection':
      shieldStats.deepfakesDetected++;
      if (statusVal === 'threat' || statusVal === 'blocked') {
        shieldStats.deepfakesFound++;
        shieldStats.threatsBlocked++;
        shieldStats.lastDetectionAt = new Date().toISOString();
      }
      addActivity('detection', detail, statusVal);
      break;
    case 'watermark':
      shieldStats.watermarksEmbedded++;
      addActivity('watermark', detail, 'success');
      break;
    case 'c2pa':
      shieldStats.c2paCredentialsEmbedded++;
      addActivity('c2pa', detail, 'success');
      break;
    case 'voice_enroll':
      shieldStats.voiceEnrollments++;
      addActivity('voice', detail || 'enrolled', 'success');
      break;
    case 'voice_verify':
      shieldStats.voiceVerifications++;
      if (statusVal === 'match') shieldStats.voiceMatches++;
      else if (statusVal === 'reject') { shieldStats.voiceRejections++; shieldStats.threatsBlocked++; }
      addActivity('voice', detail, statusVal);
      break;
    case 'takedown':
      shieldStats.takedownsInitiated++;
      shieldStats.lastTakedownAt = new Date().toISOString();
      if (statusVal === 'completed') shieldStats.takedownsCompleted++;
      addActivity('takedown', detail, statusVal);
      break;
    case 'alert':
      shieldStats.alertsGenerated++;
      addActivity('alert', detail, statusVal || 'info');
      break;
    case 'shield_activate':
      shieldStats.shieldActivations++;
      addActivity('shield', detail || 'activated', 'success');
      break;
    case 'session':
      shieldStats.sessionsProtected++;
      addActivity('session', detail || 'protected', 'success');
      break;
    default:
      return error(res, `Unknown event type: ${type}`, 400);
  }

  if (!shieldStats.firstActivatedAt) shieldStats.firstActivatedAt = new Date().toISOString();

  return success(res, { recorded: true });
});

// POST /api/shields/reset
router.post('/reset', (req, res) => {
  shieldStats = {
    imagesScanned: 0, deepfakesDetected: 0, deepfakesFound: 0,
    watermarksEmbedded: 0, c2paCredentialsEmbedded: 0,
    voiceEnrollments: 0, voiceVerifications: 0, voiceMatches: 0,
    voiceRejections: 0, takedownsInitiated: 0, takedownsCompleted: 0,
    alertsGenerated: 0, threatsBlocked: 0, crawlerRuns: 0, urlsScanned: 0,
    faceMatches: 0, sessionsProtected: 0, shieldActivations: 0,
    firstActivatedAt: null, lastScanAt: null, lastDetectionAt: null,
    lastTakedownAt: null, recentActivity: []
  };
  return success(res, { reset: true });
});

module.exports = router;
