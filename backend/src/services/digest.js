/**
 * Email Digest Service
 * Generates and sends weekly/monthly usage and threat reports.
 * Uses Nodemailer from the notifications service.
 */

const nodemailer = require('nodemailer');
const { table } = require('../db/query');
const { getUsageSummary } = require('./usage');

let transporter = null;

function initTransporter() {
  if (transporter) return;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

function generateUsageHTML(userName, usage, stats, period) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
body{font-family:-apple-system,Helvetica,Arial,sans-serif;background:#0a0a0a;color:#e0e0e0;margin:0;padding:0}
.container{max-width:600px;margin:0 auto;padding:20px}
h1{color:#00ff88;font-size:24px;border-bottom:1px solid #333;padding-bottom:10px}
h2{color:#00ccff;font-size:18px;margin-top:20px}
.stat-grid{display:flex;flex-wrap:wrap;gap:10px}
.stat{background:#111;border:1px solid #333;border-radius:8px;padding:15px;flex:1;min-width:120px}
.stat-value{font-size:28px;font-weight:bold;color:#00ff88}
.stat-label{font-size:12px;color:#888;text-transform:uppercase;margin-top:4px}
.alert{background:#1a0000;border-left:3px solid #ff4444;padding:10px;margin:5px 0;border-radius:0 4px 4px 0}
.safe{background:#001a00;border-left:3px solid #00ff88;padding:10px;margin:5px 0;border-radius:0 4px 4px 0}
.footer{margin-top:30px;padding-top:10px;border-top:1px solid #333;color:#666;font-size:12px}
a{color:#00ccff;text-decoration:none}
</style></head>
<body>
<div class="container">
  <h1>ENCLAVE // ${period} Report</h1>
  <p>Hi ${userName},</p>
  <p>Here's your ${period.toLowerCase()} digital identity protection report.</p>

  <h2>Usage This Month</h2>
  <div class="stat-grid">
    <div class="stat">
      <div class="stat-value">${usage.scans.used}</div>
      <div class="stat-label">Scans / ${usage.scans.limit === -1 ? '∞' : usage.scans.limit}</div>
    </div>
    <div class="stat">
      <div class="stat-value">${usage.alerts.used}</div>
      <div class="stat-label">Alerts / ${usage.alerts.limit === -1 ? '∞' : usage.alerts.limit}</div>
    </div>
    <div class="stat">
      <div class="stat-value">${usage.takedowns.used}</div>
      <div class="stat-label">Takedowns / ${usage.takedowns.limit === -1 ? '∞' : usage.takedowns.limit}</div>
    </div>
    <div class="stat">
      <div class="stat-value">${usage.deepScans.used}</div>
      <div class="stat-label">Deep Scans / ${usage.deepScans.limit === -1 ? '∞' : usage.deepScans.limit}</div>
    </div>
  </div>

  ${stats && stats.recentActivity && stats.recentActivity.length > 0 ? `
  <h2>Recent Activity</h2>
  ${stats.recentActivity.slice(0, 10).map(a => `
    <div class="${a.status === 'blocked' || a.status === 'threat' ? 'alert' : 'safe'}">
      <strong>${a.type}</strong> — ${a.detail} <span style="color:#888">(${new Date(a.timestamp).toLocaleDateString()})</span>
    </div>
  `).join('')}
  ` : ''}

  <div class="footer">
    <p>Enclave Digital Identity Protection Vault — <a href="${process.env.APP_URL || 'http://localhost:4000'}">Open Dashboard</a></p>
    <p>To change email preferences, visit your account settings.</p>
  </div>
</div>
</body>
</html>`;
}

function generateThreatSummaryHTML(userName, threats, period) {
  if (!threats || threats.length === 0) return null;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
body{font-family:-apple-system,Helvetica,Arial,sans-serif;background:#0a0a0a;color:#e0e0e0;margin:0;padding:0}
.container{max-width:600px;margin:0 auto;padding:20px}
h1{color:#ff4444;font-size:24px;border-bottom:1px solid #333;padding-bottom:10px}
h2{color:#00ccff;font-size:18px;margin-top:20px}
.threat{background:#1a0000;border:1px solid #333;border-radius:8px;padding:15px;margin:10px 0}
.threat-type{color:#ff4444;font-weight:bold;text-transform:uppercase}
.threat-url{color:#00ccff;font-size:14px;margin:5px 0}
.threat-score{color:#ffaa00;font-size:13px}
.threat-date{color:#888;font-size:12px}
.action{background:#001a00;border-radius:4px;padding:8px;margin-top:8px;font-size:13px}
.footer{margin-top:30px;padding-top:10px;border-top:1px solid #333;color:#666;font-size:12px}
a{color:#00ccff;text-decoration:none}
</style></head>
<body>
<div class="container">
  <h1>ENCLAVE // Threat Alert</h1>
  <p>Hi ${userName},</p>
  <p>We detected ${threats.length} potential threat${threats.length > 1 ? 's' : ''} on the internet this ${period.toLowerCase()}.</p>

  ${threats.map(t => `
  <div class="threat">
    <div class="threat-type">⚠ Deepfake Detected</div>
    <div class="threat-url">${t.source_url || 'Unknown source'}</div>
    <div class="threat-score">Confidence: ${Math.round((t.confidence || 0) * 100)}% — ${t.media_type || 'image'}</div>
    <div class="threat-date">${new Date(t.timestamp || t.created_at).toLocaleDateString()}</div>
    <div class="action">🛡️ Recommended: <a href="${process.env.APP_URL || 'http://localhost:4000'}/alerts/${t.id}">Review & Take Action</a></div>
  </div>
  `).join('')}

  <div class="footer">
    <p>Enclave Digital Identity Protection Vault — <a href="${process.env.APP_URL || 'http://localhost:4000'}/alerts">View All Alerts</a></p>
  </div>
</div>
</body>
</html>`;
}

async function sendDigest(userId, period) {
  period = period || 'weekly';
  try {
    const users = await table('users');
    const user = await users.find({ id: userId });
    if (!user) return { sent: false, reason: 'user_not_found' };
    if (user.email_notifications === 0 || user.email_notifications === false) {
      return { sent: false, reason: 'notifications_disabled' };
    }

    const usage = await getUsageSummary(userId, user.subscription_tier || 'free');
    const alerts = await table('alerts');
    const userAlerts = await alerts.find({ user_id: userId });
    const recentAlerts = Array.isArray(userAlerts)
      ? userAlerts.slice(-10)
      : userAlerts ? [userAlerts] : [];

    const threats = recentAlerts.filter(a =>
      a.confidence && a.confidence > 0.6 && a.status !== 'SAFE'
    );

    initTransporter();
    if (!transporter) return { sent: false, reason: 'smtp_not_configured' };

    const subject = `Enclave ${period === 'weekly' ? 'Weekly' : 'Monthly'} Report — ${usage.scans.used} scans, ${threats.length} threats`;
    const html = generateUsageHTML(user.full_name, usage, { recentActivity: [] }, period === 'weekly' ? 'Weekly' : 'Monthly');

    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Enclave Vault" <alerts@enclavevault.io>',
      to: user.email,
      subject,
      html
    });

    // Send threat summary if there are threats
    if (threats.length > 0) {
      const threatHtml = generateThreatSummaryHTML(user.full_name, threats, period);
      if (threatHtml) {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || '"Enclave Vault" <alerts@enclavevault.io>',
          to: user.email,
          subject: `⚠️ ${threats.length} Threat${threats.length > 1 ? 's' : ''} Detected — Action Required`,
          html: threatHtml
        });
      }
    }

    // Log the digest
    try {
      const digests = await table('email_digests');
      await digests.insert({
        id: require('uuid').v4(),
        user_id: userId,
        period,
        threats_included: threats.length,
        sent_at: new Date().toISOString()
      });
    } catch (_) {}

    return { sent: true, threats: threats.length, to: user.email };
  } catch (e) {
    console.warn('[DIGEST] Send failed:', e.message);
    return { sent: false, reason: e.message };
  }
}

async function sendDigestToAllUsers(period) {
  try {
    const users = await table('users');
    const allUsers = await users.all();
    const userList = Array.isArray(allUsers) ? allUsers : allUsers ? [allUsers] : [];
    let sent = 0, failed = 0;

    for (const u of userList) {
      const result = await sendDigest(u.id, period);
      if (result.sent) sent++;
      else failed++;
    }

    return { sent, failed, total: userList.length };
  } catch (e) {
    return { sent: 0, failed: 0, error: e.message };
  }
}

module.exports = {
  sendDigest,
  sendDigestToAllUsers,
  generateUsageHTML,
  generateThreatSummaryHTML
};
