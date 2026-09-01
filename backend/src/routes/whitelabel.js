/* ─── White-Label Routes ─── */

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');
const whitelabel = require('../services/whitelabel');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get branding for current user
router.get('/branding', async (req, res) => {
  try {
    const branding = await whitelabel.getBranding(req.user.userId);
    return success(res, branding);
  } catch (e) {
    return error(res, e.message || 'Failed to get branding');
  }
});

// Update branding
router.put('/branding', async (req, res) => {
  try {
    const result = await whitelabel.updateBranding(req.user.userId, req.body);
    if (!result.success) return error(res, result.reason || 'Update failed', 400);
    return success(res, result.branding, 'Branding updated');
  } catch (e) {
    return error(res, e.message || 'Failed to update branding');
  }
});

// Get branding for a custom domain (public, no auth)
router.get('/domain/:domain', async (req, res) => {
  try {
    const branding = await whitelabel.getBrandingForDomain(req.params.domain);
    if (!branding) return error(res, 'Domain not found', 404);
    return success(res, branding);
  } catch (e) {
    return error(res, e.message || 'Failed to get domain branding');
  }
});

// Generate CSS for current user's branding
router.get('/css', async (req, res) => {
  try {
    const branding = await whitelabel.getBranding(req.user.userId);
    const css = whitelabel.generateCSS(branding);
    res.setHeader('Content-Type', 'text/css');
    return res.send(css);
  } catch (e) {
    return error(res, e.message || 'Failed to generate CSS');
  }
});

module.exports = router;
