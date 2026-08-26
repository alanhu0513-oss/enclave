const express = require('express');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');
const monitoring = require('../services/monitoring-service');
const billing = require('../services/billing');

const router = express.Router();
router.use(authenticate);

async function _tierOf(userId) {
  try {
    const sub = await billing.getSubscriptionStatus(userId);
    return sub.tier || 'free';
  } catch (_) {
    return 'free';
  }
}

/** Dashboard payload: schedule + per-source health. */
router.get('/status', async (req, res) => {
  try {
    const tier = await _tierOf(req.user.userId);
    const status = await monitoring.getStatusForUser(req.user.userId, tier);
    return success(res, status);
  } catch (e) {
    return error(res, e.message);
  }
});

/** Start scheduled monitoring (tier-aware). */
router.post('/start', async (req, res) => {
  try {
    const tier = await _tierOf(req.user.userId);
    const status = await monitoring.startMonitoring(req.user.userId, tier);
    const full = await monitoring.getStatusForUser(req.user.userId, tier);
    return success(res, { ...status, ...full }, 'Monitoring started');
  } catch (e) {
    return error(res, e.message);
  }
});

/** Stop scheduled monitoring. */
router.post('/stop', async (req, res) => {
  try {
    const stopped = monitoring.stopMonitoring(req.user.userId);
    const tier = await _tierOf(req.user.userId);
    const full = await monitoring.getStatusForUser(req.user.userId, tier);
    return success(res, { stopped, ...full }, stopped ? 'Monitoring stopped' : 'No active monitoring session');
  } catch (e) {
    return error(res, e.message);
  }
});

/** Run all enabled sources once, right now (any tier). */
router.post('/run-once', async (req, res) => {
  try {
    const tier = await _tierOf(req.user.userId);
    const result = await monitoring.monitorCycle(req.user.userId, tier);
    if (result.error) return error(res, result.error, 400);
    return success(res, result, `Scan complete: ${result.findings} finding(s), ${result.newAlerts} new alert(s)`);
  } catch (e) {
    return error(res, e.message);
  }
});

module.exports = router;
