const express = require('express');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');
const notifications = require('../services/notifications');
const { table } = require('../db/query');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const unreadOnly = req.query.unread === 'true';
    const limit = parseInt(req.query.limit) || 20;
    const items = await notifications.getNotifications(req.user.userId, { unreadOnly, limit });
    return success(res, items);
  } catch (e) {
    return error(res, e.message);
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    const items = await notifications.getNotifications(req.user.userId, { unreadOnly: true, limit: 100 });
    return success(res, { count: items.length });
  } catch (e) {
    return error(res, e.message);
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    await notifications.markRead(req.user.userId, req.params.id);
    return success(res, { id: req.params.id, read: true });
  } catch (e) {
    return error(res, e.message);
  }
});

router.post('/read-all', async (req, res) => {
  try {
    await notifications.markAllRead(req.user.userId);
    return success(res, { success: true }, 'All notifications marked as read');
  } catch (e) {
    return error(res, e.message);
  }
});

router.post('/fcm-token', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return error(res, 'FCM token required', 400);
    const users = await table('users');
    await users.update({ id: req.user.userId }, { fcm_token: token });
    return success(res, { registered: true });
  } catch (e) {
    return error(res, e.message);
  }
});

router.patch('/preferences', async (req, res) => {
  try {
    const { emailNotifications } = req.body;
    const users = await table('users');
    const updates = {};
    if (typeof emailNotifications === 'boolean') {
      updates.email_notifications = emailNotifications ? 1 : 0;
    }
    if (Object.keys(updates).length > 0) {
      await users.update({ id: req.user.userId }, updates);
    }
    return success(res, { updated: true });
  } catch (e) {
    return error(res, e.message);
  }
});

module.exports = router;
