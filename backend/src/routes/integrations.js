const express = require('express');
const { success, error } = require('../utils/response');
const { authenticate } = require('../middleware/auth');
const { table } = require('../db/query');
const integrations = require('../services/integrations');

const router = express.Router();

// List integrations
router.get('/', authenticate, async (req, res) => {
  try {
    const tbl = await table('integrations');
    const all = await tbl.filter({ user_id: req.user.userId });
    const safe = (Array.isArray(all) ? all : []).map(i => ({
      id: i.id,
      type: i.type,
      name: i.name,
      active: i.active,
      created_at: i.created_at,
    }));
    return success(res, { integrations: safe });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

// Create integration
router.post('/', authenticate, async (req, res) => {
  try {
    const { type, name, webhook_url } = req.body;
    if (!type || !webhook_url) return error(res, 'type and webhook_url required', 400);
    if (!['slack', 'discord', 'zapier', 'email'].includes(type)) return error(res, 'type must be slack, discord, zapier, or email', 400);

    const tbl = await table('integrations');
    const id = `int_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await tbl.create({
      id,
      user_id: req.user.userId,
      type,
      name: name || `${type} integration`,
      webhook_url,
      active: true,
      created_at: new Date().toISOString(),
    });

    return success(res, { id, message: 'Integration created' }, 'OK', 201);
  } catch (e) {
    return error(res, e.message, 500);
  }
});

// Test integration
router.post('/:id/test', authenticate, async (req, res) => {
  try {
    const tbl = await table('integrations');
    const integration = await tbl.find({ id: req.params.id, user_id: req.user.userId });
    if (!integration) return error(res, 'Integration not found', 404);

    const testAlert = {
      title: 'Test Alert',
      type: 'test',
      severity: 'low',
      confidence: 85,
      description: 'This is a test alert from Enclave. If you see this, the integration is working!',
      created_at: new Date().toISOString(),
      user_id: req.user.userId,
    };

    let result;
    if (integration.type === 'slack') {
      result = await integrations.sendSlack(integration.webhook_url, testAlert);
    } else if (integration.type === 'discord') {
      result = await integrations.sendDiscord(integration.webhook_url, testAlert);
    } else if (integration.type === 'zapier') {
      result = await integrations.sendZapier(integration.webhook_url, testAlert);
    } else if (integration.type === 'email') {
      result = await integrations.sendEmail(integration.webhook_url, testAlert);
    }

    return success(res, { message: result.success ? 'Test sent successfully' : 'Test failed', ...result });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

// Delete integration
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const tbl = await table('integrations');
    await tbl.remove({ id: req.params.id, user_id: req.user.userId });
    return success(res, { message: 'Integration deleted' });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

module.exports = router;
