/* ─── Enclave Takedown Service ───
 * Auto-generates and sends DMCA / Cease & Desist / TAKE IT DOWN Act notices.
 * Tracks takedown lifecycle: sent → acknowledged → removed / escalated.
 * 48-hour follow-up escalation per TAKE IT DOWN Act requirement.
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');
const { table } = require('../db/query');
const notifications = require('./notifications');
const evidenceChain = require('./evidence-chain');

const { UPLOAD_DIR } = require('../utils/upload-dir');
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

/* Verification re-crawl schedule (hours after sent) */
const VERIFICATION_SCHEDULE_HOURS = [24, 48, 24 * 7, 24 * 14, 24 * 30];
const COUNTER_NOTICE_WINDOW_DAYS = 14;

/* ─── Platform Abuse Contact Discovery ─── */

const KNOWN_ABUSE_EMAILS = {
  'facebook.com': 'abuse@facebook.com',
  'fb.com': 'abuse@facebook.com',
  'instagram.com': 'abuse@instagram.com',
  'twitter.com': 'legal@twitter.com',
  'x.com': 'legal@twitter.com',
  'tiktok.com': 'legal@tiktok.com',
  'youtube.com': 'copyright@youtube.com',
  'reddit.com': 'copyright@reddit.com',
  'linkedin.com': 'copyright@linkedin.com',
  'tinder.com': 'abuse@tinder.com',
  'bumble.com': 'abuse@bumble.com',
  'onlyfans.com': 'dmca@onlyfans.com',
  'pornhub.com': 'dmca@pornhub.com',
  'xvideos.com': 'abuse@xvideos.com',
  'chaturbate.com': 'dmca@chaturbate.com',
  'google.com': 'legal-removals@google.com',
  'bing.com': 'bingops@microsoft.com',
  'yahoo.com': 'legal-removals@yahoo.com',
  'telegram.org': 'abuse@telegram.org',
  'discord.com': 'abuse@discord.com',
  '4chan.org': 'abuse@4chan.org',
};

function getAbuseEmail(sourceUrl) {
  try {
    const hostname = new URL(sourceUrl).hostname.replace('www.', '');
    for (const [domain, email] of Object.entries(KNOWN_ABUSE_EMAILS)) {
      if (hostname === domain || hostname.endsWith('.' + domain)) {
        return email;
      }
    }
    // Try common patterns
    return `abuse@${hostname}`;
  } catch {
    return null;
  }
}

function getPlatformName(sourceUrl) {
  try {
    const hostname = new URL(sourceUrl).hostname.replace('www.', '');
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      return parts[parts.length - 2].charAt(0).toUpperCase() + parts[parts.length - 2].slice(1);
    }
    return hostname;
  } catch {
    return 'Unknown Platform';
  }
}

/* ─── Evidence Preservation ─── */

async function preserveEvidence(alertId, sourceUrl) {
  const evidenceDir = path.join(UPLOAD_DIR, 'evidence', alertId);
  if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });

  const evidence = {
    alertId,
    sourceUrl,
    capturedAt: new Date().toISOString(),
    metadata: {},
    screenshots: [],
    hashChain: null,
    chainHead: null,
    phash: null,
  };

  // Capture page metadata
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(sourceUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeout);

    evidence.metadata.httpStatus = res.status;
    evidence.metadata.contentType = res.headers.get('content-type');
    evidence.metadata.lastModified = res.headers.get('last-modified');
    evidence.metadata.server = res.headers.get('server');

    const html = await res.text().catch(() => '');
    if (html) {
      // Extract title and meta
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
      const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);

      evidence.metadata.pageTitle = titleMatch ? titleMatch[1].trim() : '';
      evidence.metadata.description = descMatch ? descMatch[1].trim() : '';
      evidence.metadata.ogImage = ogImage ? ogImage[1] : '';

      // Save HTML snapshot
      fs.writeFileSync(path.join(evidenceDir, 'page-snapshot.html'), html);
    }
  } catch (e) {
    evidence.metadata.fetchError = e.message;
  }

  // Download og:image for perceptual fingerprinting
  if (evidence.metadata.ogImage) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const imgRes = await fetch(evidence.metadata.ogImage, { signal: controller.signal });
      clearTimeout(timeout);
      if (imgRes.ok) {
        const buf = Buffer.from(await imgRes.arrayBuffer());
        fs.writeFileSync(path.join(evidenceDir, 'og-image.bin'), buf);
        const phash = evidenceChain.dHash(buf);
        if (phash) {
          evidence.phash = phash;
          fs.writeFileSync(path.join(evidenceDir, 'image-phash.txt'), phash);
        }
      }
    } catch (_) {}
  }

  // Build tamper-evident SHA-256 hash chain over all preserved artifacts
  const artifacts = fs.existsSync(evidenceDir)
    ? fs.readdirSync(evidenceDir).filter((f) => f !== 'evidence.json' && !f.startsWith('.'))
    : [];
  const built = evidenceChain.buildHashChain(evidenceDir, artifacts);
  evidence.hashChain = built.chain;
  evidence.chainHead = built.head;
  evidence.verifiedAt = new Date().toISOString();

  // Save evidence manifest (manifest itself is excluded from the chain it describes)
  fs.writeFileSync(
    path.join(evidenceDir, 'evidence.json'),
    JSON.stringify(evidence, null, 2)
  );

  return evidence;
}

/** Re-verify the integrity of a preserved evidence package. */
async function verifyEvidenceIntegrity(alertId) {
  const dir = path.join(UPLOAD_DIR, 'evidence', alertId);
  const manifestPath = path.join(dir, 'evidence.json');
  if (!fs.existsSync(manifestPath)) return { exists: false };
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!manifest.hashChain) return { exists: true, hasChain: false };

  const result = evidenceChain.verifyHashChain(dir, manifest.hashChain);
  return {
    exists: true,
    hasChain: true,
    valid: result.valid,
    brokenAtIndex: result.brokenAtIndex,
    reason: result.reason || null,
    chainHead: manifest.chainHead,
    artifacts: manifest.hashChain.length,
    phash: manifest.phash || null,
  };
}

/* ─── PDF Generation ─── */

function generateTakedownPDF(type, user, alert, evidence, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'letter' });
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const platform = getPlatformName(alert.source_url);

    // Header
    doc.fontSize(18).font('Helvetica-Bold');
    if (type === 'dmca') {
      doc.text('DMCA Takedown Notice', { align: 'center' });
      doc.fontSize(10).font('Helvetica').text('17 U.S.C. § 512(c) — Digital Millennium Copyright Act', { align: 'center' });
    } else if (type === 'take_it_down') {
      doc.text('TAKE IT DOWN Act Takedown Request', { align: 'center' });
      doc.fontSize(10).font('Helvetica').text('18 U.S.C. § 2252B — Removing Identifying Information Violations', { align: 'center' });
    } else {
      doc.text('Cease and Desist Demand', { align: 'center' });
      doc.fontSize(10).font('Helvetica').text('Right of Publicity / Privacy Violation', { align: 'center' });
    }

    doc.moveDown(1.5);
    doc.fontSize(10).font('Helvetica-Bold').text('Date: ' + date);
    doc.text('Case Reference: ' + alert.id.slice(0, 8).toUpperCase());
    doc.moveDown(0.5);

    // To / From
    doc.font('Helvetica-Bold').text('To: ' + platform + ' Trust & Safety / Legal Team');
    doc.text('      ' + getAbuseEmail(alert.source_url));
    doc.moveDown(0.3);
    doc.font('Helvetica').text(`From: ${user?.full_name || 'Rights Holder'}`);
    doc.text(`Email: ${user?.email || 'N/A'}`);
    doc.moveDown(0.8);

    // Re line
    doc.font('Helvetica-Bold').text('RE: Unauthorized Use of Identity — Immediate Removal Required');
    doc.moveDown(0.5);

    doc.font('Helvetica');

    if (type === 'dmca') {
      doc.text(`Dear Trust & Safety Team,

This is a formal DMCA takedown notice pursuant to Section 512(c) of the Digital Millennium Copyright Act, 17 U.S.C. § 512(c).

IDENTITY OF RIGHTS HOLDER
The undersigned, ${user?.full_name || 'Rights Holder'}, is the owner of the identity, likeness, and associated intellectual property depicted in the infringing material.

INFRINGING MATERIAL
The unauthorized material is located at:
${alert.source_url}

${evidence?.metadata?.pageTitle ? `Page Title: "${evidence.metadata.pageTitle}"\n` : ''}${evidence?.capturedAt ? `Evidence captured: ${evidence.capturedAt}\n` : ''}DESCRIPTION OF INFRINGEMENT
This material depicts the unauthorized use of ${user?.full_name || 'my'} identity through deepfake/synthetic media technology. The material was created and/or distributed without the authorization, license, or consent of the rights owner. This constitutes infringement of the rights owner's copyright, right of publicity, and privacy rights.

LEGAL BASIS
Pursuant to 17 U.S.C. § 512(c)(3), I hereby certify under penalty of perjury:
1. I am the rights owner or authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.
2. The use of the material described above is not authorized by the rights owner, its agent, or the law.
3. The information in this notice is accurate.
4. I have a good faith belief that use of the material in the manner complained of is not authorized by the rights owner, its agent, or the law.

REQUESTED ACTION
I request that you immediately:
1. Remove or disable access to the infringing material.
2. Notify the uploader of the removal.
3. Provide confirmation of removal within 48 hours.

DEADLINE
Under the TAKE IT DOWN Act (18 U.S.C. § 2252B), non-consensual intimate imagery must be removed within 48 hours of notification. Failure to comply may result in legal action.

Sincerely,
${user?.full_name || 'Rights Holder'}
${user?.email || ''}
Generated by Enclave — Digital Identity Protection Vault (${APP_URL})`);
    } else if (type === 'take_it_down') {
      doc.text(`Dear Trust & Safety Team,

This is a formal takedown request under the TAKE IT DOWN Act (18 U.S.C. § 2252B), enacted in 2025.

IDENTITY OF VICTIM
The undersigned, ${user?.full_name || 'Rights Holder'}, is the individual whose identity and likeness has been depicted without consent.

MATERIAL TO BE REMOVED
Location: ${alert.source_url}
${evidence?.metadata?.pageTitle ? `Page Title: "${evidence.metadata.title}"\n` : ''}${evidence?.capturedAt ? `Evidence captured: ${evidence.capturedAt}\n` : ''}DESCRIPTION
This material depicts intimate or sexually explicit imagery of the undersigned that was created or distributed without consent. The material depicts a real individual and was either:
(a) Digitally altered to appear as the undersigned (deepfake), or
(b) Originally created without the undersigned's knowledge or consent.

LEGAL OBLIGATIONS
Under the TAKE IT DOWN Act:
• Platforms must remove reported intimate images within 48 hours of notification.
• Failure to remove within 48 hours exposes the platform to civil liability.
• This Act applies to any "covered platform" that hosts user-generated content.

DEADLINE
This notice is served on ${date}. Under 18 U.S.C. § 2252B, you are required to remove this material within 48 hours — by ${new Date(Date.now() + 48 * 60 * 60 * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}.

REQUESTED ACTION
1. Immediately remove or disable access to the material at the URL above.
2. Notify the account holder/uploader of the removal action.
3. Preserve any evidence related to this takedown for potential legal proceedings.
4. Provide written confirmation of compliance.

WARNING
Failure to comply within 48 hours may result in:
• Civil action against the platform under 18 U.S.C. § 2252B.
• Reports to the FBI and state attorneys general.
• Public disclosure of non-compliance in legal proceedings.

Sincerely,
${user?.full_name || 'Rights Holder'}
${user?.email || ''}
Generated by Enclave — Digital Identity Protection Vault (${APP_URL})`);
    } else {
      // Cease and Desist
      doc.text(`To Whom It May Concern,

This letter serves as a formal cease and desist demand regarding the unauthorized use of the identity and likeness of ${user?.full_name || 'Rights Holder'}.

IDENTITY OF THE aggrieved PARTY
${user?.full_name || 'Rights Holder'} is an individual whose identity, name, image, and likeness are protected under applicable state Right of Publicity laws, privacy statutes, and federal law.

INFRINGING MATERIAL
The infringing material is located at:
${alert.source_url}
${evidence?.metadata?.pageTitle ? `Page Title: "${evidence.metadata.title}"\n` : ''}${evidence?.capturedAt ? `Evidence captured: ${evidence.capturedAt}\n` : ''}DESCRIPTION OF VIOLATIONS
The unauthorized reproduction, distribution, and public display of ${user?.full_name || 'this individual'}'s identity constitutes violations of:
• Right of Publicity (state common law and statutory)
• Right to Privacy (intrusion upon seclusion / false light)
• The TAKE IT DOWN Act (18 U.S.C. § 2252B) for non-consensual intimate imagery
• The DEFIANCE Act (for deepfake intimate imagery)
• Applicable state NCII laws (46 states + DC)

DEMANDED ACTIONS
You are hereby demanded to:
1. Immediately remove all infringing material from your platforms and services.
2. Cease and desist from any further unauthorized use of ${user?.full_name || 'this individual'}'s identity.
3. Provide written confirmation of compliance within 48 hours of receipt of this notice.
4. Preserve all evidence and metadata related to the posting of this material.

CONSEQUENCES OF NON-COMPLIANCE
Failure to comply may result in:
• Civil action for damages, injunctive relief, and attorneys' fees
• Criminal referrals to the FBI and state attorneys general
• Public disclosure in legal proceedings
• Reporting to the FTC for unfair and deceptive practices

This notice is sent in good faith and with the intent to resolve this matter without litigation.

Sincerely,
${user?.full_name || 'Rights Holder'}
${user?.email || ''}
Generated by Enclave — Digital Identity Protection Vault (${APP_URL})`);
    }

    doc.end();
    writeStream.on('finish', () => resolve(outputPath));
    writeStream.on('error', reject);
  });
}

/* ─── Email Delivery ─── */

async function sendTakedownEmail(toEmail, pdfPath, type, alert, user, subjectPrefix = '') {
  const nodemailer = require('nodemailer');
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return { sent: false, reason: 'SMTP not configured', toEmail };
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || '587'),
    secure: (SMTP_PORT === '465'),
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const platform = getPlatformName(alert.source_url);
  const typeName = type === 'dmca' ? 'DMCA Takedown' :
    type === 'take_it_down' ? 'TAKE IT DOWN Act' : 'Cease and Desist';

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Enclave Legal" <${SMTP_USER}>`,
      to: toEmail,
      subject: `${subjectPrefix} [${typeName}] Identity Misuse Report — ${platform} — Case ${String(alert.id).slice(0, 8).toUpperCase()}`,
      text: `Formal ${typeName} notice attached.\n\nSource: ${alert.source_url}\nCase: ${alert.id.slice(0, 8).toUpperCase()}\n\nThis is an automated legal notice generated by Enclave Digital Identity Protection.`,
      attachments: [{
        filename: `${typeName.replace(/\s+/g, '_')}_${alert.id.slice(0, 8)}.pdf`,
        path: pdfPath,
        contentType: 'application/pdf',
      }],
    });
    return { sent: true, messageId: info.messageId, toEmail };
  } catch (e) {
    return { sent: false, reason: e.message, toEmail };
  }
}

/* ─── Takedown Lifecycle ─── */

async function initiateTakedown(alertId, userId, { type = 'dmca', sendEmail: shouldSend = true } = {}) {
  const alerts = await table('alerts');
  const alert = await alerts.find({ id: alertId, user_id: userId });
  if (!alert) throw new Error('Alert not found');

  const users = await table('users');
  const user = await users.find({ id: userId });

  // 1. Preserve evidence
  const evidence = await preserveEvidence(alertId, alert.source_url);

  // 2. Generate PDF
  const takedownId = uuidv4();
  const pdfDir = path.join(UPLOAD_DIR, 'takedowns');
  if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
  const pdfPath = path.join(pdfDir, `${takedownId}.pdf`);
  await generateTakedownPDF(type, user, alert, evidence, pdfPath);

  // 3. Determine abuse email
  const abuseEmail = getAbuseEmail(alert.source_url);
  const platform = getPlatformName(alert.source_url);

  // 4. Create takedown record
  const takedowns = await table('takedowns');
  const now = new Date().toISOString();
  const followUpAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const takedownData = {
    id: takedownId,
    alert_id: alertId,
    user_id: userId,
    type,
    platform,
    abuse_email: abuseEmail,
    pdf_path: pdfPath,
    status: 'pending',
    sent_at: null,
    acknowledged_at: null,
    removed_at: null,
    escalated_at: null,
    follow_up_at: followUpAt,
    evidence_path: path.join(UPLOAD_DIR, 'evidence', alertId),
    phash: evidence.phash || null,
    chain_head: evidence.chainHead || null,
    verification_log: [],
    verification_step: 0,
    counter_notice: null,
    counter_deadline_at: null,
    created_at: now,
  };
  await takedowns.insert(takedownData);

  // 5. Update alert status
  await alerts.update({ id: alertId }, { status: 'TAKEDOWN_INITIATED' });

  // 6. Send email if configured
  let emailResult = null;
  if (shouldSend && abuseEmail) {
    emailResult = await sendTakedownEmail(abuseEmail, pdfPath, type, alert, user);
    if (emailResult.sent) {
      await takedowns.update(
        { id: takedownId },
        { status: 'sent', sent_at: new Date().toISOString() }
      );
      await alerts.update({ id: alertId }, { status: 'TAKEDOWN_SENT' });
    }
  }

  // 7. Notify user
  try {
    await notifications.notifyNewAlert(user, {
      ...alert,
      id: takedownId,
      source_url: alert.source_url,
      confidence: alert.confidence,
      matched_on: `Takedown ${type} ${emailResult?.sent ? 'sent' : 'prepared'} to ${platform}`,
    });
  } catch {}

  return {
    takedownId,
    type,
    platform,
    abuseEmail,
    emailSent: emailResult?.sent || false,
    pdfPath,
    followUpAt,
    evidence: {
      preserved: true,
      path: path.join(UPLOAD_DIR, 'evidence', alertId),
    },
  };
}

async function updateTakedownStatus(takedownId, userId, status, notes = '') {
  const takedowns = await table('takedowns');
  const takedown = await takedowns.find({ id: takedownId, user_id: userId });
  if (!takedown) throw new Error('Takedown not found');

  const updates = { status };
  const now = new Date().toISOString();

  if (status === 'acknowledged') updates.acknowledged_at = now;
  if (status === 'removed') updates.removed_at = now;
  if (status === 'escalated') {
    updates.escalated_at = now;
    updates.escalated_notes = notes;
  }

  await takedowns.update({ id: takedownId }, updates);

  // Update parent alert if removed
  if (status === 'removed' && takedown.alert_id) {
    const alerts = await table('alerts');
    await alerts.update({ id: takedown.alert_id }, { status: 'RESOLVED_REMOVED' });
  }

  // Notify user of takedown status change
  try {
    const users = await table('users');
    const user = await users.find({ id: userId });
    if (user) {
      const statusLabels = {
        sent: 'Takedown notice sent',
        acknowledged: 'Platform acknowledged your takedown',
        removed: 'Content removed successfully',
        escalated: 'Takedown escalated',
      };
      const title = statusLabels[status] || `Takedown ${status}`;
      const body = status === 'removed'
        ? `The content has been removed from the platform.`
        : status === 'escalated'
        ? `Your takedown has been escalated. ${notes || ''}`
        : `Takedown notice has been ${status}.`;

      // In-app notification
      const notifications = await table('notifications');
      const takedownNotif = {
        id: uuidv4(),
        user_id: userId,
        type: 'takedown_update',
        title,
        body,
        data: JSON.stringify({ takedownId, status, alertId: takedown.alert_id }),
        read: false,
        created_at: new Date().toISOString(),
      };
      await notifications.insert(takedownNotif);
      try {
        const { emitNotificationCreated } = require('./event-bus');
        emitNotificationCreated(userId, takedownNotif);
      } catch (_) {}

      // Email notification
      if (user.email && user.email_notifications !== false) {
        await notifications.sendEmail(
          user.email,
          `Enclave: ${title}`,
          `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#1a1a2e;">${title}</h2>
            <p>${body}</p>
            <p><a href="${APP_URL}/alerts" style="background:#e94560;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">View in Enclave</a></p>
          </div>`
        );
      }

      // FCM push
      if (user.fcm_token) {
        await notifications.sendPush(user.fcm_token, { title, body, data: { takedownId, status } });
      }
    }
  } catch (e) {
    console.warn('[Takedown] Notification failed:', e.message);
  }

  return { id: takedownId, status, updatedAt: now };
}

/* ─── DMCA Counter-Notification Workflow ─── */

/**
 * Platform (or uploader) filed a DMCA counter-notification.
 * Starts a 14-day clock; content must NOT be restored before it expires.
 */
async function recordCounterNotice(takedownId, userId, { details = '', receivedAt = null } = {}) {
  const takedowns = await table('takedowns');
  const takedown = await takedowns.find({ id: takedownId, user_id: userId });
  if (!takedown) throw new Error('Takedown not found');

  const now = receivedAt || new Date().toISOString();
  const deadline = new Date(new Date(now).getTime() + COUNTER_NOTICE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await takedowns.update({ id: takedownId }, {
    status: 'counter_notice',
    counter_notice: {
      receivedAt: now,
      details: String(details).slice(0, 2000),
      recordedAt: new Date().toISOString(),
    },
    counter_deadline_at: deadline,
    verification_log: [
      ...(takedown.verification_log || []),
      { at: now, step: 'counter_notice', action: 'Counter-notification received', result: `14-day restore clock started (until ${deadline})` },
    ],
  });

  return { id: takedownId, status: 'counter_notice', counterDeadlineAt: deadline };
}

/* ─── URL liveness check for verification re-crawls ─── */

async function isUrlLive(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      method: 'GET',
    });
    clearTimeout(timeout);
    // 404/410 = gone; most other codes (200/403/login walls) treated as still live
    return !(res.status === 404 || res.status === 410);
  } catch (_) {
    return null; // unknown (network error / timeout)
  }
}

/* ─── Full Escalation Matrix ───
 * 24h: verify removal (re-crawl)
 * 48h: reminder re-send + verify          [TAKE IT DOWN Act deadline]
 * 7d:  final notice + verify
 * 14d: mark escalated + notify user with legal referral guidance
 * 30d: close as escalated_no_removal
 */

async function processLifecycle() {
  const takedowns = await table('takedowns');
  const users = await table('users');
  const now = Date.now();
  const stats = { checked: 0, verified_removed: 0, reminders_sent: 0, escalated: 0, closed: 0, counter_expired: 0 };

  let active;
  try {
    active = await takedowns.filter({});
  } catch (_) {
    return stats;
  }

  for (const td of active) {
    if (!['sent', 'follow_up_sent', 'acknowledged', 'pending', 'counter_notice'].includes(td.status)) continue;
    if (!td.sent_at && td.status !== 'counter_notice') continue;
    stats.checked++;

    /* Counter-notice expiry */
    if (td.status === 'counter_notice' && td.counter_deadline_at && new Date(td.counter_deadline_at) <= new Date(now)) {
      await takedowns.update({ id: td.id }, {
        status: 'counter_notice_expired',
        verification_log: [
          ...(td.verification_log || []),
          { at: new Date(now).toISOString(), step: 'counter_expiry', action: 'Counter-notice window elapsed', result: 'Consult counsel before any restoration' },
        ],
      });
      stats.counter_expired++;
      continue;
    }

    const ageHours = (now - new Date(td.sent_at || td.created_at).getTime()) / 3600000;
    const step = td.verification_step || 0;
    if (step >= VERIFICATION_SCHEDULE_HOURS.length) continue;

    const dueHours = VERIFICATION_SCHEDULE_HOURS[step];
    if (ageHours < dueHours) continue;

    /* Time for this verification step */
    const live = await isUrlLive(td.source_url || '');
    let action = '';
    let result = '';
    const updates = { verification_step: step + 1 };

    if (live === false) {
      /* Content gone — auto-resolve */
      updates.status = 'removed';
      updates.removed_at = new Date(now).toISOString();
      result = 'URL no longer live (404/410) — marked removed';
      if (td.alert_id) {
        const alerts = await table('alerts');
        await alerts.update({ id: td.alert_id }, { status: 'RESOLVED_REMOVED' });
      }
      stats.verified_removed++;
      action = `verification ${dueHours}h`;
    } else if (step === 0) {
      action = 'verification 24h';
      result = live === true ? 'content still live' : 'liveness unknown';
    } else if (step === 1) {
      /* 48h — TAKE IT DOWN Act deadline: formal reminder */
      action = 'reminder 48h';
      const user = await users.find({ id: td.user_id });
      const fakeAlert = { ...td, source_url: td.source_url };
      if (td.abuse_email) {
        const emailResult = await sendTakedownEmail(
          td.abuse_email,
          td.pdf_path,
          td.type,
          fakeAlert,
          user,
          `[48-HOUR REMINDER]`
        );
        if (emailResult.sent) {
          updates.status = 'follow_up_sent';
          result = 'reminder email sent; content still live';
          stats.reminders_sent++;
        } else {
          result = 'reminder failed (' + (emailResult.reason || 'no smtp').slice(0, 40) + ')';
        }
      } else {
        result = 'no abuse email on file';
      }
      if (live !== true) result += '; liveness unknown';
    } else if (step === 2) {
      /* 7d — final notice */
      action = 'final notice 7d';
      const user = await users.find({ id: td.user_id });
      if (td.abuse_email) {
        const emailResult = await sendTakedownEmail(
          td.abuse_email, td.pdf_path, td.type,
          { source_url: td.source_url, id: td.id }, user,
          '[FINAL NOTICE — 7 DAYS]'
        );
        result = emailResult.sent ? 'final notice sent; content still live' : 'final notice failed';
        if (emailResult.sent) stats.reminders_sent++;
      } else {
        result = 'no abuse email on file';
      }
    } else if (step === 3) {
      /* 14d — escalate + legal referral guidance to user */
      action = 'escalation 14d';
      updates.status = 'escalated';
      updates.escalated_at = new Date(now).toISOString();
      updates.escalated_notes = 'Content still live after 14 days and two notices.';
      result = 'marked escalated; legal referral recommended';

      const user = await users.find({ id: td.user_id });
      if (user) {
        try {
          await notifications.notifyNewAlert(user, {
            id: td.id,
            source_url: td.source_url,
            confidence: td.confidence || 80,
            matched_on: 'ESCALATED: platform non-responsive after 14 days',
            notes: 'Consider NCII helplines (Cyber Civil Rights Initiative: 844-878-2274), FBI IC3 report, or an attorney. Evidence package is preserved and hash-chained.',
          });
        } catch (_) {}
      }
      stats.escalated++;
    } else if (step === 4) {
      /* 30d — close out */
      action = 'close 30d';
      updates.status = 'escalated_no_removal';
      result = 'case closed — unresolved after 30 days; evidence retained 2 years';
      stats.closed++;
    }

    updates.verification_log = [
      ...(td.verification_log || []),
      { at: new Date(now).toISOString(), step: action, urlLive: live, result },
    ];

    await takedowns.update({ id: td.id }, updates);
  }

  return stats;
}

/* Back-compat alias for existing endpoint */
async function checkFollowUps() {
  return processLifecycle();
}

/* ─── Perceptual Resurface Matching ─── */

/**
 * Download an image found by the monitor and compare its dHash against
 * phashes from the user's active takedowns. Returns match info or null.
 */
async function matchResurfacedContent(userId, imageUrl) {
  try {
    const takedowns = await table('takedowns');
    const mine = (await takedowns.filter({ user_id: userId }))
      .filter((t) => t.phash && !['removed', 'dismissed', 'escalated_no_removal'].includes(t.status));
    if (!mine.length) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(imageUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    const hash = evidenceChain.dHash(buf);
    if (!hash) return null;

    for (const td of mine) {
      if (evidenceChain.isSameVisual(hash, td.phash)) {
        return {
          takedownId: td.id,
          platform: td.platform,
          similarityBits: 64 - evidenceChain.hammingDistance(hash, td.phash),
        };
      }
    }
    return null;
  } catch (_) {
    return null;
  }
}

async function getUserTakedowns(userId) {
  const takedowns = await table('takedowns');
  const rows = await takedowns.filter({ user_id: userId });
  rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return rows.map(r => ({
    id: r.id,
    alertId: r.alert_id,
    type: r.type,
    platform: r.platform,
    abuseEmail: r.abuse_email,
    status: r.status,
    sentAt: r.sent_at,
    acknowledgedAt: r.acknowledged_at,
    removedAt: r.removed_at,
    escalatedAt: r.escalated_at,
    followUpAt: r.follow_up_at,
    createdAt: r.created_at,
  }));
}

/* ─── Manual Filing Helper ───
 * Platforms without abuse-form APIs require manual submission.
 * Step-by-step guides with direct form URLs, prefilled where possible.
 */

const FILING_GUIDES = {
  instagram: {
    platform: 'Instagram',
    formUrl: 'https://www.facebook.com/help/instagram/103840140382193',
    bestType: 'take_it_down',
    steps: [
      'Open the Instagram help center form linked above (works while logged in or out).',
      'Select "Intellectual Property" → "Copyright report" for DMCA, or search "non-consensual intimate images" for TAKE IT DOWN reporting.',
      'Fill in your full legal name exactly as registered in Enclave (Case reference helps if asked).',
      'Paste the infringing URL from this takedown into the "Location of infringing material" field.',
      'Upload the evidence PDF generated by Enclave when prompted for supporting documents.',
      'Submit and record the confirmation/tracking ID in this case\'s notes.',
      'Expect acknowledgment within 24-48h. Enclave will auto-verify removal at 24h and 48h.',
    ],
  },
  tiktok: {
    platform: 'TikTok',
    formUrl: 'https://www.tiktok.com/legal/report/feedback',
    bestType: 'take_it_down',
    steps: [
      'Open TikTok\'s legal reporting form linked above.',
      'Choose "Intellectual property infringement" (DMCA) or "Report adult content involving a minor / non-consensual imagery" as applicable.',
      'Enter the video URL from this takedown case.',
      'Describe: "Synthetic media depicting my likeness created without consent" plus your case reference.',
      'Attach the Enclave evidence PDF.',
      'TikTok prioritizes NCII reports — expect action within 48h under their policy.',
    ],
  },
  youtube: {
    platform: 'YouTube',
    formUrl: 'https://support.google.com/youtube/answer/2807622',
    bestType: 'dmca',
    steps: [
      'Open YouTube\'s copyright complaint webform.',
      'Select "Open a copyright complaint" — sign in with any Google account.',
      'Provide your contact details and the infringing video URL(s) from this case.',
      'Check "I have a good faith belief..." boxes (standard §512(c)(3) certifications).',
      'Upload/sign as required; keep the case ID emailed by Google.',
      'Removals typically process within 1-3 business days.',
    ],
  },
  x_twitter: {
    platform: 'X (Twitter)',
    formUrl: 'https://help.x.com/en/forms/safety-and-sensitive-content/csim',
    bestType: 'take_it_down',
    steps: [
      'Use X\'s dedicated synthetic/manipulated media report form (linked above) — fastest path for deepfakes.',
      'Alternative: file DMCA at https://help.x.com/en/forms/dmca/copyright.',
      'Enter the post URL from this takedown.',
      'State that the media is an AI-generated depiction of you without consent.',
      'Attach the evidence PDF; X accepts PDF attachments on both forms.',
      'X requires the report to come from the depicted person or authorized agent — use your registered name.',
    ],
  },
  facebook: {
    platform: 'Facebook',
    formUrl: 'https://www.facebook.com/legal/copyright',
    bestType: 'dmca',
    steps: [
      'Open Facebook\'s intellectual property report form.',
      'Choose "Copyright" for DMCA filings.',
      'Supply the content URL, your details, and standard certifications.',
      'For NCII, instead use: https://www.facebook.com/help/1814782953326635',
      'Attach evidence PDF where supported; otherwise paste key excerpts into the description field.',
    ],
  },
  reddit: {
    platform: 'Reddit',
    formUrl: 'https://www.reddit.com/report?reason=its-involuntary-pornography',
    bestType: 'take_it_down',
    steps: [
      'While logged in to Reddit, use the report flow link above ("involuntary pornography").',
      'Also message r/reddit.com moderators via https://www.reddit.com/message/compose?to=%2Fr%2Freddit.com for escalations.',
      'Include the post permalink and state you are depicted without consent.',
      'Reddit honors Take It Down Act reports and typically removes within 24-48h.',
    ],
  },
  google_search: {
    platform: 'Google Search',
    formUrl: 'https://support.google.com/legal/troubleshooter/1114905',
    bestType: 'dmca',
    steps: [
      'De-indexing removes results even if the host ignores notices.',
      'Open Google\'s legal troubleshooter → "Remove content from Google".',
      'Select "Image Search results" or "Web Search results".',
      'Submit the URLs from this case; one submission per URL.',
      'Processing takes up to 6 business days; status visible in the troubleshooter.',
    ],
  },
};

function getFilingGuides() {
  return Object.entries(FILING_GUIDES).map(([id, g]) => ({
    id,
    platform: g.platform,
    formUrl: g.formUrl,
    bestType: g.bestType,
    stepCount: g.steps.length,
  }));
}

module.exports = {
  initiateTakedown,
  updateTakedownStatus,
  checkFollowUps,
  processLifecycle,
  recordCounterNotice,
  matchResurfacedContent,
  verifyEvidenceIntegrity,
  getUserTakedowns,
  getAbuseEmail,
  getPlatformName,
  generateTakedownPDF,
  preserveEvidence,
  getFilingGuides,
  getFilingGuide: (id) => FILING_GUIDES[id] || null,
};
