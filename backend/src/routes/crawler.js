const express = require('express');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');
const crawler = require('../services/crawler');

const router = express.Router();
router.use(authenticate);

router.get('/status', (req, res) => {
  try {
    const status = crawler.getSessionStatus(req.user.userId);
    return success(res, status);
  } catch (e) {
    return error(res, e.message);
  }
});

router.post('/start', async (req, res) => {
  try {
    const session = await crawler.startSession(req.user.userId);
    return success(res, { sessionId: session.sessionId, active: true }, 'Crawler started');
  } catch (e) {
    return error(res, e.message);
  }
});

router.post('/stop', async (req, res) => {
  try {
    const stopped = await crawler.stopSession(req.user.userId);
    return success(res, { stopped }, stopped ? 'Crawler stopped' : 'No active crawler session');
  } catch (e) {
    return error(res, e.message);
  }
});

module.exports = router;
