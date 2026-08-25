const express = require('express');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { success, error } = require('../utils/response');
const webhooks = require('../services/webhooks');
const whitelabel = require('../services/whitelabel');
const sso = require('../services/sso');
const reports = require('../services/reports');
const partners = require('../services/partners');

const router = express.Router();

// ─── Webhooks ───

router.get('/webhooks', authenticate, async (req, res) => {
  try {
    const list = await webhooks.listWebhooks(req.user.userId);
    return success(res, { webhooks: list });
  } catch (e) { return error(res, e.message); }
});

router.post('/webhooks', authenticate, async (req, res) => {
  try {
    const result = await webhooks.registerWebhook(req.user.userId, req.body);
    return success(res, result);
  } catch (e) { return error(res, e.message); }
});

router.delete('/webhooks/:id', authenticate, async (req, res) => {
  try {
    const result = await webhooks.deleteWebhook(req.user.userId, req.params.id);
    return success(res, result);
  } catch (e) { return error(res, e.message); }
});

router.patch('/webhooks/:id/toggle', authenticate, async (req, res) => {
  try {
    const { active } = req.body;
    const result = await webhooks.toggleWebhook(req.user.userId, req.params.id, active !== false);
    return success(res, result);
  } catch (e) { return error(res, e.message); }
});

router.get('/webhooks/events', (req, res) => {
  return success(res, { events: webhooks.EVENT_TYPES });
});

router.post('/webhooks/test', authenticate, async (req, res) => {
  try {
    const result = await webhooks.dispatchEvent('test', { message: 'Test webhook', userId: req.user.userId });
    return success(res, result);
  } catch (e) { return error(res, e.message); }
});

// ─── White Label ───

router.get('/branding', authenticate, async (req, res) => {
  try {
    const branding = await whitelabel.getBranding(req.user.userId);
    return success(res, branding);
  } catch (e) { return error(res, e.message); }
});

router.patch('/branding', authenticate, async (req, res) => {
  try {
    const result = await whitelabel.updateBranding(req.user.userId, req.body);
    return success(res, result);
  } catch (e) { return error(res, e.message); }
});

router.get('/branding/css', authenticate, async (req, res) => {
  try {
    const branding = await whitelabel.getBranding(req.user.userId);
    const css = whitelabel.generateCSS(branding);
    res.setHeader('Content-Type', 'text/css');
    return res.send(css);
  } catch (e) { return error(res, e.message); }
});

router.get('/branding/domain/:domain', optionalAuth, async (req, res) => {
  try {
    const branding = await whitelabel.getBrandingForDomain(req.params.domain);
    return success(res, branding || { configured: false });
  } catch (e) { return error(res, e.message); }
});

// ─── SSO ───

router.get('/sso/providers', (req, res) => {
  return success(res, {
    providers: Object.entries(sso.SSO_PROVIDERS).map(([id, p]) => ({ id, ...p }))
  });
});

router.get('/sso', authenticate, async (req, res) => {
  try {
    const configs = await sso.listSSO(req.user.userId);
    return success(res, { configurations: configs });
  } catch (e) { return error(res, e.message); }
});

router.post('/sso', authenticate, async (req, res) => {
  try {
    const result = await sso.configureSSO(req.user.userId, req.body);
    return success(res, result);
  } catch (e) { return error(res, e.message); }
});

router.post('/sso/:id/initiate', optionalAuth, async (req, res) => {
  try {
    const { redirectUri } = req.body;
    const result = await sso.initiateSSO(req.params.id, redirectUri);
    return success(res, result);
  } catch (e) { return error(res, e.message); }
});

router.post('/sso/:id/callback', async (req, res) => {
  try {
    const { code, state } = req.body;
    const result = await sso.handleCallback(req.params.id, code, state);
    return success(res, result);
  } catch (e) { return error(res, e.message); }
});

router.get('/sso/:id/metadata', (req, res) => {
  try {
    const xml = sso.generateSAMLMetadata(req.params.id);
    res.setHeader('Content-Type', 'application/xml');
    return res.send(xml);
  } catch (e) { return error(res, e.message); }
});

// ─── Reports ───

router.get('/reports/types', (req, res) => {
  return success(res, {
    types: Object.entries(reports.REPORT_TYPES).map(([id, r]) => ({ id, ...r }))
  });
});

router.post('/reports/generate', authenticate, async (req, res) => {
  try {
    const result = await reports.generateReport(req.user.userId, req.body);
    return success(res, result);
  } catch (e) { return error(res, e.message); }
});

router.get('/reports', authenticate, async (req, res) => {
  try {
    const list = await reports.listReports(req.user.userId, parseInt(req.query.limit));
    return success(res, { reports: list });
  } catch (e) { return error(res, e.message); }
});

router.get('/reports/:id', authenticate, async (req, res) => {
  try {
    const report = await reports.getReport(req.user.userId, req.params.id);
    if (!report) return error(res, 'Report not found', 404);
    return success(res, report);
  } catch (e) { return error(res, e.message); }
});

router.post('/reports/schedule', authenticate, async (req, res) => {
  try {
    const result = await reports.scheduleReport(req.user.userId, req.body);
    return success(res, result);
  } catch (e) { return error(res, e.message); }
});

router.get('/reports/schedules', authenticate, async (req, res) => {
  try {
    const list = await reports.listSchedules(req.user.userId);
    return success(res, { schedules: list });
  } catch (e) { return error(res, e.message); }
});

// ─── Partners ───

router.get('/partners/status', authenticate, async (req, res) => {
  try {
    const status = await partners.getPartnerStatus(req.user.userId);
    return success(res, status);
  } catch (e) { return error(res, e.message); }
});

router.post('/partners/apply', authenticate, async (req, res) => {
  try {
    const result = await partners.applyPartner(req.user.userId, req.body);
    return success(res, result);
  } catch (e) { return error(res, e.message); }
});

router.get('/partners/earnings', authenticate, async (req, res) => {
  try {
    const earnings = await partners.getEarnings(req.user.userId);
    return success(res, earnings);
  } catch (e) { return error(res, e.message); }
});

router.get('/partners/tiers', (req, res) => {
  return success(res, { tiers: partners.PARTNER_TIERS });
});

router.get('/partner/:code', async (req, res) => {
  try {
    const status = await partners.getPartnerStatus(null);
    return success(res, { partnerCode: req.params.code, referralUrl: `${process.env.APP_URL || 'http://localhost:4000'}/?partner=${req.params.code}` });
  } catch (e) { return error(res, e.message); }
});

router.get('/partners', authenticate, async (req, res) => {
  try {
    const list = await partners.listAllPartners();
    return success(res, { partners: list });
  } catch (e) { return error(res, e.message); }
});

module.exports = router;
