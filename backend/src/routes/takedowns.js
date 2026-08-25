const express = require('express');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');
const takedownService = require('../services/takedown');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const rows = await takedownService.getUserTakedowns(req.user.userId);
    return success(res, rows);
  } catch (e) {
    return error(res, e.message);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { table } = require('../db/query');
    const takedowns = await table('takedowns');
    const td = await takedowns.find({ id: req.params.id, user_id: req.user.userId });
    if (!td) return error(res, 'Takedown not found', 404);
    return success(res, {
      id: td.id,
      alertId: td.alert_id,
      type: td.type,
      platform: td.platform,
      abuseEmail: td.abuse_email,
      status: td.status,
      sentAt: td.sent_at,
      acknowledgedAt: td.acknowledged_at,
      removedAt: td.removed_at,
      escalatedAt: td.escalated_at,
      escalatedNotes: td.escalated_notes,
      followUpAt: td.follow_up_at,
      evidencePath: td.evidence_path,
      createdAt: td.created_at,
    });
  } catch (e) {
    return error(res, e.message);
  }
});

router.post('/:alertId/initiate', async (req, res) => {
  try {
    const { type = 'dmca', sendEmail = true } = req.body;
    if (!['dmca', 'cease_and_desist', 'take_it_down'].includes(type)) {
      return error(res, 'Type must be dmca, cease_and_desist, or take_it_down', 400);
    }
    const result = await takedownService.initiateTakedown(
      req.params.alertId,
      req.user.userId,
      { type, sendEmail }
    );
    return success(res, result, `Takedown ${result.emailSent ? 'sent' : 'prepared'}`);
  } catch (e) {
    return error(res, e.message);
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { status, notes = '' } = req.body;
    const validStatuses = ['acknowledged', 'removed', 'escalated', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return error(res, `Status must be one of: ${validStatuses.join(', ')}`, 400);
    }
    const result = await takedownService.updateTakedownStatus(
      req.params.id,
      req.user.userId,
      status,
      notes
    );
    return success(res, result, `Takedown ${status}`);
  } catch (e) {
    return error(res, e.message);
  }
});

router.get('/:id/pdf', async (req, res) => {
  try {
    const { table } = require('../db/query');
    const takedowns = await table('takedowns');
    const td = await takedowns.find({ id: req.params.id, user_id: req.user.userId });
    if (!td) return error(res, 'Takedown not found', 404);
    if (!fs.existsSync(td.pdf_path)) return error(res, 'PDF not found', 404);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="takedown-${td.id.slice(0, 8)}.pdf"`);
    fs.createReadStream(td.pdf_path).pipe(res);
  } catch (e) {
    return error(res, e.message);
  }
});

router.get('/:id/evidence', async (req, res) => {
  try {
    const { table } = require('../db/query');
    const takedowns = await table('takedowns');
    const td = await takedowns.find({ id: req.params.id, user_id: req.user.userId });
    if (!td) return error(res, 'Takedown not found', 404);
    const evidenceDir = td.evidence_path;
    if (!evidenceDir || !fs.existsSync(evidenceDir)) {
      return error(res, 'Evidence not found', 404);
    }
    const manifestPath = path.join(evidenceDir, 'evidence.json');
    if (!fs.existsSync(manifestPath)) return error(res, 'Evidence manifest not found', 404);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return success(res, manifest);
  } catch (e) {
    return error(res, e.message);
  }
});

router.post('/check-follow-ups', async (req, res) => {
  try {
    const result = await takedownService.checkFollowUps();
    return success(res, result, `Checked ${result.checked} pending takedowns, escalated ${result.escalated}`);
  } catch (e) {
    return error(res, e.message);
  }
});

router.get('/stats/summary', async (req, res) => {
  try {
    const { table } = require('../db/query');
    const takedowns = await table('takedowns');
    const rows = await takedowns.filter({ user_id: req.user.userId });
    const stats = {
      total: rows.length,
      pending: rows.filter(r => r.status === 'pending').length,
      sent: rows.filter(r => r.status === 'sent').length,
      acknowledged: rows.filter(r => r.status === 'acknowledged').length,
      removed: rows.filter(r => r.status === 'removed').length,
      escalated: rows.filter(r => r.status === 'escalated' || r.status === 'follow_up_sent').length,
    };
    return success(res, stats);
  } catch (e) {
    return error(res, e.message);
  }
});

module.exports = router;
