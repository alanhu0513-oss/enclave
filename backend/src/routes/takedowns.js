const express = require('express');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');
const takedownService = require('../services/takedown');
const usage = require('../services/usage');
const billing = require('../services/billing');

// Create an in-app notification row (handled gracefully if it fails)
async function createNotification(userId, title, body, data) {
  try {
    const notifications = await require('../db/query').table('notifications');
    await notifications.insert({
      id: require('uuid').v4(),
      user_id: userId,
      type: 'takedown',
      title, body,
      data: JSON.stringify(data || {}),
      read: false,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('[Takedown] Notification insert failed:', e.message);
  }
}

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

/** Manual filing helper — list platform guides. */
router.get('/filing-guides', async (req, res) => {
  try {
    return success(res, takedownService.getFilingGuides());
  } catch (e) {
    return error(res, e.message);
  }
});

/** Manual filing helper — single platform guide. */
router.get('/filing-guides/:platform', async (req, res) => {
  try {
    const guide = takedownService.getFilingGuide(req.params.platform);
    if (!guide) return error(res, 'Unknown platform guide', 404);
    return success(res, guide);
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
      verificationStep: td.verification_step || 0,
      verificationLog: td.verification_log || [],
      phash: td.phash || null,
      chainHead: td.chain_head ? String(td.chain_head).slice(0, 16) + '…' : null,
      counterNotice: td.counter_notice || null,
      counterDeadlineAt: td.counter_deadline_at || null,
      evidencePath: td.evidence_path,
      createdAt: td.created_at,
    });
  } catch (e) {
    return error(res, e.message);
  }
});

/** DMCA counter-notification received from platform/uploader. */
router.post('/:id/counter-notice', async (req, res) => {
  try {
    const { details = '', receivedAt = null } = req.body;
    const result = await takedownService.recordCounterNotice(
      req.params.id,
      req.user.userId,
      { details, receivedAt }
    );
    return success(res, result, `Counter-notice recorded — 14-day clock started`);
  } catch (e) {
    return error(res, e.message);
  }
});

/** Verification schedule + log for a takedown. */
router.get('/:id/verification', async (req, res) => {
  try {
    const { table } = require('../db/query');
    const takedowns = await table('takedowns');
    const td = await takedowns.find({ id: req.params.id, user_id: req.user.userId });
    if (!td) return error(res, 'Takedown not found', 404);
    return success(res, {
      id: td.id,
      status: td.status,
      currentStep: td.verification_step || 0,
      scheduleHours: [24, 48, 168, 336, 720],
      log: td.verification_log || [],
    });
  } catch (e) {
    return error(res, e.message);
  }
});

router.post('/:alertId/initiate', async (req, res) => {
  try {
    // Check tier limit for takedowns
    const status = await billing.getSubscriptionStatus(req.user.userId);
    const limitCheck = await usage.checkLimit(req.user.userId, 'takedown', status.tier);
    if (!limitCheck.allowed) {
      return error(res, `Monthly takedown limit reached (${limitCheck.limit}). Upgrade to continue.`, 429);
    }

    const { type = 'dmca', sendEmail = true } = req.body;
    if (!['dmca', 'cease_and_desist', 'take_it_down'].includes(type)) {
      return error(res, 'Type must be dmca, cease_and_desist, or take_it_down', 400);
    }
    const result = await takedownService.initiateTakedown(
      req.params.alertId,
      req.user.userId,
      { type, sendEmail }
    );
    await usage.incrementUsage(req.user.userId, 'takedown');
    createNotification(
      req.user.userId,
      'Takedown initiated',
      `Your ${(type || 'dmca').replace(/_/g, ' ')} request has been ${result.emailSent ? 'sent' : 'prepared'}.`,
      { alertId: req.params.alertId, takedownId: result.id }
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
    createNotification(
      req.user.userId,
      'Takedown status updated',
      `Your takedown is now marked as '${status}'.`,
      { takedownId: req.params.id, status }
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

    // Live integrity verification of the hash chain on every view
    const integrity = td.alert_id ? await takedownService.verifyEvidenceIntegrity(td.alert_id) : { exists: false };

    return success(res, {
      alertId: manifest.alertId,
      sourceUrl: manifest.sourceUrl,
      capturedAt: manifest.capturedAt,
      metadata: manifest.metadata,
      phash: manifest.phash || null,
      chainHead: manifest.chainHead ? String(manifest.chainHead).slice(0, 16) + '…' : null,
      artifacts: (manifest.hashChain || []).map((c) => ({
        index: c.index, file: c.file, size: c.size, hash: String(c.hash).slice(0, 16) + '…',
      })),
      integrity: {
        valid: integrity.valid === true,
        artifacts: integrity.artifacts || 0,
        reason: integrity.reason || null,
      },
    });
  } catch (e) {
    return error(res, e.message);
  }
});

router.post('/check-follow-ups', async (req, res) => {
  try {
    const result = await takedownService.processLifecycle();
    return success(res, result, `Lifecycle check: ${result.checked} active, ${result.verified_removed} removed, ${result.escalated} escalated`);
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
      sent: rows.filter(r => r.status === 'sent' || r.status === 'follow_up_sent').length,
      acknowledged: rows.filter(r => r.status === 'acknowledged').length,
      removed: rows.filter(r => r.status === 'removed').length,
      escalated: rows.filter(r => r.status === 'escalated' || r.status === 'follow_up_sent').length,
      counterNotices: rows.filter(r => r.status === 'counter_notice' || r.status === 'counter_notice_expired').length,
    };
    return success(res, stats);
  } catch (e) {
    return error(res, e.message);
  }
});

module.exports = router;
