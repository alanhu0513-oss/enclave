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

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

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

  // Save evidence manifest
  fs.writeFileSync(
    path.join(evidenceDir, 'evidence.json'),
    JSON.stringify(evidence, null, 2)
  );

  return evidence;
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

async function sendTakedownEmail(toEmail, pdfPath, type, alert, user) {
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
      subject: `[${typeName}] Identity Misuse Report — ${platform} — Case ${alert.id.slice(0, 8).toUpperCase()}`,
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

  return { id: takedownId, status, updatedAt: now };
}

async function checkFollowUps() {
  const takedowns = await table('takedowns');
  const now = new Date().toISOString();
  const all = await takedowns.filter({ status: 'sent' });

  let escalated = 0;
  for (const td of all) {
    if (td.follow_up_at && new Date(td.follow_up_at) <= new Date() && !td.escalated_at) {
      await takedowns.update({ id: td.id }, {
        status: 'follow_up_sent',
        escalated_at: now,
      });
      escalated++;
    }
  }
  return { checked: all.length, escalated };
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

module.exports = {
  initiateTakedown,
  updateTakedownStatus,
  checkFollowUps,
  getUserTakedowns,
  getAbuseEmail,
  getPlatformName,
  generateTakedownPDF,
};
