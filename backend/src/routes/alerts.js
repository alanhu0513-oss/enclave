const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');
const { table } = require('../db/query');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');
const crawler = require('../services/crawler');
const mlClient = require('../services/ml-client');
const usage = require('../services/usage');
const billing = require('../services/billing');
const notifications = require('../services/notifications');

// Notify user when a manual scan surfaces a likely identity threat (Phase 2.1)
async function notifyOnThreat(userId, alert, confidence) {
  if (confidence < 50) return;
  try {
    const users = await table('users');
    const user = await users.find({ id: userId });
    if (!user) return;
    notifications.notifyNewAlert(user, alert).catch(() => {});
  } catch (_) {}
}

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const upload = multer({ dest: path.join(UPLOAD_DIR, 'temp'), limits: { fileSize: 10 * 1024 * 1024 } });

const router = express.Router();
router.use(authenticate);

function toJson(a) {
  return {
    id: a.id, sourceUrl: a.source_url, confidence: a.confidence,
    status: a.status, mediaType: a.media_type, matchedOn: a.matched_on,
    notes: a.notes, timestamp: a.timestamp
  };
}

router.get('/', async (req, res) => {
  try {
    const alerts = await table('alerts');
    const rows = await alerts.filter({ user_id: req.user.userId });
    rows.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return success(res, rows.map(toJson));
  } catch (e) {
    return error(res, e.message);
  }
});

router.post('/scan/url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return error(res, 'URL is required', 400);

    // Check tier limit for scans
    const status = await billing.getSubscriptionStatus(req.user.userId);
    const limitCheck = await usage.checkLimit(req.user.userId, 'scan', status.tier);
    if (!limitCheck.allowed) {
      return error(res, `Monthly scan limit reached (${limitCheck.limit}). Upgrade to continue.`, 429);
    }

    let confidence = 0;
    let matchedOn = 'url submitted for review';
    let mediaType = 'link';
    let notes = 'Scanned from manual URL submission';
    let detection = null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const fetchRes = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Enclave/1.0' }
      });
      clearTimeout(timeout);

      if (fetchRes.ok) {
        const contentType = fetchRes.headers.get('content-type') || '';
        if (contentType.startsWith('image/')) {
          const ext = path.extname(new URL(url).pathname) || '.jpg';
          const filename = `${uuidv4()}${ext}`;
          const filePath = path.join(UPLOAD_DIR, 'temp', filename);
          const buffer = Buffer.from(await fetchRes.arrayBuffer());
          fs.writeFileSync(filePath, buffer);

          const result = await mlClient.detectImage(filePath);
          if (!result.error) {
            detection = result;
            confidence = result.confidence;
            matchedOn = result.verdict;
            if (result.provider) matchedOn += ` — engine:${result.provider}`;
            if (result.latency_ms) matchedOn += ` ${result.latency_ms}ms`;
            if (result.cached) matchedOn += ' (cached)';
            mediaType = 'image';
            notes = `ML detected: ${result.verdict} (confidence ${result.confidence}%)`;
            if (result.explanation) notes += ` — ${String(result.explanation).slice(0, 200)}`;
          }

          try { fs.unlinkSync(filePath); } catch (_) {}
        } else {
          notes = 'URL fetched — not an image, queued for manual review';
        }
      }
    } catch (e) {
      notes = 'URL fetch failed — queued for review: ' + e.message;
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const alerts = await table('alerts');
    await alerts.insert({
      id, user_id: req.user.userId, source_url: url,
      confidence: parseFloat(confidence.toFixed(1)),
      status: confidence > 0 ? 'PENDING_REVIEW' : 'UNRESOLVED',
      media_type: mediaType,
      matched_on: matchedOn,
      notes,
      timestamp: now, created_at: now
    });
    const alert = await alerts.find({ id });
    await usage.incrementUsage(req.user.userId, 'scan');
    notifyOnThreat(req.user.userId, alert, confidence);
    return success(res, { ...toJson(alert), detection }, 'URL scanned');
  } catch (e) {
    return error(res, e.message);
  }
});

router.post('/scan/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return error(res, 'Image file required', 400);

    // Check tier limit for scans
    const status = await billing.getSubscriptionStatus(req.user.userId);
    const limitCheck = await usage.checkLimit(req.user.userId, 'scan', status.tier);
    if (!limitCheck.allowed) {
      return error(res, `Monthly scan limit reached (${limitCheck.limit}). Upgrade to continue.`, 429);
    }

    const filePath = req.file.path;
    const result = await mlClient.detectImage(filePath);

    let confidence = 0;
    let matchedOn = 'analysis pending';
    let notes = 'Scanned from manual image upload';

    if (!result.error) {
      confidence = result.confidence;
      matchedOn = result.verdict;
      if (result.provider) matchedOn += ` — engine:${result.provider}`;
      if (result.latency_ms) matchedOn += ` ${result.latency_ms}ms`;
      if (result.cached) matchedOn += ' (cached)';
      if (result.face_count) {
        matchedOn += ` — ${result.face_count} face(s) detected`;
      }
      notes = `File: ${req.file.originalname}, Size: ${req.file.size} bytes, Verdict: ${result.verdict}, Confidence: ${result.confidence}%`;
      if (result.explanation) notes += ` — ${String(result.explanation).slice(0, 200)}`;
    } else {
      notes = 'Analysis failed: ' + result.error;
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const sourceUrl = `/uploads/temp/${req.file.filename}`;
    const alerts = await table('alerts');
    await alerts.insert({
      id, user_id: req.user.userId, source_url: sourceUrl,
      confidence: parseFloat(confidence.toFixed(1)),
      status: confidence > 0 ? 'PENDING_REVIEW' : 'UNRESOLVED',
      media_type: 'image',
      matched_on: matchedOn,
      notes,
      timestamp: now, created_at: now
    });
    const alert = await alerts.find({ id });
    await usage.incrementUsage(req.user.userId, 'scan');
    notifyOnThreat(req.user.userId, alert, confidence);
    return success(res, { ...toJson(alert), detection: result.error ? null : result }, 'Image analyzed');
  } catch (e) {
    return error(res, e.message);
  }
});

router.post('/deep-scan', async (req, res) => {
  try {
    // Check tier limit for deep scans
    const status = await billing.getSubscriptionStatus(req.user.userId);
    const limitCheck = await usage.checkLimit(req.user.userId, 'deep_scan', status.tier);
    if (!limitCheck.allowed) {
      return error(res, `Monthly deep scan limit reached (${limitCheck.limit}). Upgrade to continue.`, 429);
    }

    const users = await table('users');
    const user = await users.find({ id: req.user.userId });
    const userName = user?.full_name || 'unknown';
    const results = await crawler.scanCycle(req.user.userId, userName);
    await usage.incrementUsage(req.user.userId, 'deep_scan');
    return success(res, { count: results.length, alerts: results }, 'Deep scan completed');
  } catch (e) {
    return error(res, e.message);
  }
});

router.patch('/:id/whitelist', async (req, res) => {
  try {
    const alerts = await table('alerts');
    const updated = await alerts.update(
      { id: req.params.id, user_id: req.user.userId },
      { status: 'RESOLVED_SAFE' }
    );
    if (!updated) return error(res, 'Alert not found', 404);
    return success(res, { id: req.params.id, status: 'RESOLVED_SAFE' }, 'Alert whitelisted');
  } catch (e) {
    return error(res, e.message);
  }
});

router.post('/:id/document', async (req, res) => {
  try {
    const { type = 'dmca' } = req.body;
    if (!['dmca', 'cease_and_desist', 'take_it_down'].includes(type)) {
      return error(res, 'Document type must be dmca, cease_and_desist, or take_it_down', 400);
    }
    const alerts = await table('alerts');
    const alert = await alerts.find({ id: req.params.id, user_id: req.user.userId });
    if (!alert) return error(res, 'Alert not found', 404);
    const users = await table('users');
    const user = await users.find({ id: req.user.userId });
    const docId = uuidv4();
    const docPath = path.join(UPLOAD_DIR, 'pdfs', `${docId}.pdf`);

    const pdfDir = path.dirname(docPath);
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

    const doc = new PDFDocument({ margin: 50 });
    const writeStream = fs.createWriteStream(docPath);
    doc.pipe(writeStream);

    doc.fontSize(18).font('Helvetica-Bold');
    if (type === 'dmca') {
      doc.text('DMCA Takedown Notice', { align: 'center' });
      doc.fontSize(12).font('Helvetica').text('Section 512(c) of the Digital Millennium Copyright Act', { align: 'center' });
    } else if (type === 'take_it_down') {
      doc.text('TAKE IT DOWN Act Takedown Request', { align: 'center' });
      doc.fontSize(12).font('Helvetica').text('18 U.S.C. § 2252B — Removing Identifying Information Violations', { align: 'center' });
    } else {
      doc.text('Cease and Desist Demand', { align: 'center' });
      doc.fontSize(12).font('Helvetica').text('Right of Publicity Violation', { align: 'center' });
    }

    doc.moveDown(2);
    doc.fontSize(11).font('Helvetica-Bold').text('Date: ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').text('Re: Unauthorized Use of Identity');
    doc.moveDown(0.5);

    doc.font('Helvetica');
    if (type === 'dmca') {
      doc.text(`To Whom It May Concern,\n\nThis is a formal notice of copyright infringement served under the Digital Millennium Copyright Act, 17 U.S.C. § 512(c).\n\nThe undersigned, ${user?.full_name || 'Rights Holder'}, is the owner of the identity and likeness depicted in the material found at the following location:\n\n${alert.source_url}\n\nThis material was published without the authorization, license, or consent of the rights owner. The unauthorized use of this identity constitutes infringement of the rights owner's copyright and publicity rights.\n\nPursuant to 17 U.S.C. § 512(c)(3), I hereby certify that:\n\n• I am the rights owner or authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.\n• The use of the material described above is not authorized by the rights owner, its agent, or the law.\n• The information in this notice is accurate.\n• Under penalty of perjury, I have a good faith belief that use of the material in the manner complained of is not authorized by the rights owner, its agent, or the law.\n\nI request that you immediately remove or disable access to the infringing material.\n\nSincerely,\n${user?.full_name || 'Rights Holder'}\nGenerated by Enclave — Digital Identity Protection Vault`);
    } else if (type === 'take_it_down') {
      doc.text(`Dear Trust & Safety Team,\n\nThis is a formal takedown request under the TAKE IT DOWN Act (18 U.S.C. § 2252B), enacted in 2025.\n\nThe undersigned, ${user?.full_name || 'Rights Holder'}, is the individual whose identity and likeness has been depicted without consent.\n\nMATERIAL TO BE REMOVED\nLocation: ${alert.source_url}\n\nDESCRIPTION\nThis material depicts intimate or sexually explicit imagery of the undersigned that was created or distributed without consent. The material depicts a real individual and was either:\n(a) Digitally altered to appear as the undersigned (deepfake), or\n(b) Originally created without the undersigned's knowledge or consent.\n\nLEGAL OBLIGATIONS\nUnder the TAKE IT DOWN Act:\n• Platforms must remove reported intimate images within 48 hours of notification.\n• Failure to remove within 48 hours exposes the platform to civil liability.\n• This Act applies to any "covered platform" that hosts user-generated content.\n\nDEADLINE\nYou are required to remove this material within 48 hours of receipt of this notice.\n\nREQUESTED ACTION\n1. Immediately remove or disable access to the material at the URL above.\n2. Notify the account holder/uploader of the removal action.\n3. Preserve any evidence related to this takedown for potential legal proceedings.\n4. Provide written confirmation of compliance.\n\nWARNING\nFailure to comply within 48 hours may result in civil action against the platform under 18 U.S.C. § 2252B.\n\nSincerely,\n${user?.full_name || 'Rights Holder'}\nGenerated by Enclave — Digital Identity Protection Vault`);
    } else {
      doc.text(`To Whom It May Concern,\n\nThis letter serves as a formal demand to immediately cease and desist from all unauthorized use of the identity and likeness of ${user?.full_name || 'Rights Holder'}.\n\nThe infringing material is located at:\n\n${alert.source_url}\n\nThe unauthorized reproduction, distribution, and public display of ${user?.full_name || 'this individual'}'s identity violates their Right of Publicity, privacy rights, and applicable laws.\n\nYou are hereby demanded to:\n\n1. Immediately remove all infringing material from your platforms and services.\n2. Cease and desist from any further unauthorized use of ${user?.full_name || 'this individual'}'s identity.\n3. Provide written confirmation of compliance within 30 days of receipt of this notice.\n\nFailure to comply may result in legal action, including but not limited to claims for injunctive relief, damages, and attorneys' fees.\n\nSincerely,\n${user?.full_name || 'Rights Holder'}\nGenerated by Enclave — Digital Identity Protection Vault`);
    }

    doc.end();

    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    const documents = await table('documents');
    await documents.insert({
      id: docId, user_id: req.user.userId, alert_id: req.params.id,
      document_type: type, file_path: docPath,
      created_at: new Date().toISOString()
    });

    await alerts.update({ id: req.params.id }, { status: 'NOTICE_GENERATED' });

    return success(res, { documentId: docId, documentType: type, filePath: docPath },
      `${type === 'dmca' ? 'DMCA' : type === 'take_it_down' ? 'TAKE IT DOWN Act' : 'C&D'} notice generated`);
  } catch (e) {
    return error(res, e.message);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const alerts = await table('alerts');
    const removed = await alerts.remove({ id: req.params.id, user_id: req.user.userId });
    if (!removed) return error(res, 'Alert not found', 404);
    return success(res, null, 'Alert deleted');
  } catch (e) {
    return error(res, e.message);
  }
});

// ─── Watermark (Phase 4.3) ───
const watermark = require('../services/watermark');

/** Embed invisible watermark into a PNG photo. */
router.post('/watermark/embed', upload.single('image'), async (req, res) => {
  let filePath = null;
  try {
    if (!req.file) return error(res, 'Image file required', 400);
    filePath = req.file.path;
    const payload = {
      userId: req.user.userId,
      ts: Date.now(),
      copyright: req.body.copyright || 'Enclave Vault',
    };
    const input = fs.readFileSync(filePath);
    let outBuffer;
    try {
      outBuffer = watermark.embedWatermark(input, payload);
    } catch (we) {
      return error(res, we.message, 400);
    }
    const outName = `wm-${uuidv4()}.png`;
    const outPath = path.join(UPLOAD_DIR, 'temp', outName);
    fs.writeFileSync(outPath, outBuffer);
    const id = uuidv4();
    const documents = await table('documents');
    await documents.insert({
      id, user_id: req.user.userId, alert_id: null,
      document_type: 'watermark', file_path: outPath,
      created_at: new Date().toISOString()
    });
    const verified = watermark.verifyWatermark(outBuffer);
    return success(res, {
      filePath: outPath,
      url: `/uploads/temp/${outName}`,
      payload: verified,
      verified: !!verified,
    }, 'Watermark embedded');
  } catch (e) {
    return error(res, e.message);
  } finally {
    try { if (filePath) fs.unlinkSync(filePath); } catch (_) {}
  }
});
/** Verify an invisible watermark on an uploaded PNG photo. */
router.post('/watermark/verify', upload.single('image'), async (req, res) => {
  let filePath = null;
  try {
    if (!req.file) return error(res, 'Image file required', 400);
    filePath = req.file.path;
    const input = fs.readFileSync(filePath);
    const payload = watermark.verifyWatermark(input);
    if (!payload) return success(res, { watermarked: false, payload: null }, 'No watermark detected');
    return success(res, { watermarked: true, payload }, 'Valid watermark detected');
  } catch (e) {
    return error(res, e.message);
  } finally {
    try { if (filePath) fs.unlinkSync(filePath); } catch (_) {}
  }
});

module.exports = router;
