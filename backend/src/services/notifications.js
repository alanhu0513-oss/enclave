/* ─── Enclave Notification Service ───
 * Email alerts (Nodemailer + Gmail SMTP), push (Firebase Cloud Messaging),
 * and in-app notification persistence.
 */

const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const { table } = require('../db/query');

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn('[Notify] SMTP not configured — email alerts disabled');
    return null;
  }
  _transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || '587'),
    secure: (SMTP_PORT === '465'),
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return _transporter;
}

async function sendEmail(to, subject, html) {
  const transporter = getTransporter();
  if (!transporter) return { sent: false, reason: 'SMTP not configured' };
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Enclave" <${process.env.SMTP_USER}>`,
      to, subject, html,
    });
    console.log(`[Notify] Email sent to ${to}: ${info.messageId}`);
    return { sent: true, messageId: info.messageId };
  } catch (e) {
    console.error(`[Notify] Email failed to ${to}:`, e.message);
    return { sent: false, reason: e.message };
  }
}

async function notifyNewAlert(user, alert) {
  const results = { email: null, push: null, inApp: null };

  // In-app notification
  try {
    const notifications = await table('notifications');
    const notifId = uuidv4();
    await notifications.insert({
      id: notifId,
      user_id: user.id,
      type: 'new_alert',
      title: 'New threat detected',
      body: `A potential deepfake was found on ${new URL(alert.source_url).hostname || 'an unknown site'}. Confidence: ${alert.confidence}%`,
      data: JSON.stringify({ alertId: alert.id, sourceUrl: alert.source_url }),
      read: false,
      created_at: new Date().toISOString(),
    });
    results.inApp = notifId;
  } catch (e) {
    console.warn('[Notify] In-app notification failed:', e.message);
  }

  // Email notification
  if (user.email && user.email_notifications !== false) {
    const subject = `🚨 Enclave Alert: Potential identity threat detected (${alert.confidence}%)`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1a1a2e; color: #fff; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; color: #e94560;">Enclave — Identity Threat Detected</h2>
        </div>
        <div style="background: #f8f9fa; padding: 20px; border: 1px solid #e9ecef; border-top: none;">
          <p>Hello ${user.full_name || 'there'},</p>
          <p>Our monitoring system has detected a potential unauthorized use of your identity.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; font-weight: bold; color: #495057;">Source:</td><td style="padding: 8px;"><a href="${alert.source_url}">${alert.source_url}</a></td></tr>
            <tr><td style="padding: 8px; font-weight: bold; color: #495057;">Confidence:</td><td style="padding: 8px;">${alert.confidence}%</td></tr>
            <tr><td style="padding: 8px; font-weight: bold; color: #495057;">Type:</td><td style="padding: 8px;">${alert.media_type || 'Unknown'}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold; color: #495057;">Detection:</td><td style="padding: 8px;">${alert.matched_on || 'N/A'}</td></tr>
          </table>
          <p style="margin: 16px 0;">
            <a href="${process.env.APP_URL || 'http://localhost:3000'}/alerts" style="background: #e94560; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Alert</a>
          </p>
          <p style="color: #6c757d; font-size: 13px;">This is an automated alert from Enclave Digital Identity Protection.</p>
        </div>
      </div>
    `;
    results.email = await sendEmail(user.email, subject, html);
  }

  // FCM push notification
  if (user.fcm_token) {
    results.push = await sendPush(user.fcm_token, {
      title: 'Enclave Alert',
      body: `Potential identity threat detected (${alert.confidence}% confidence)`,
      data: { alertId: alert.id, url: alert.source_url },
    });
  }

  return results;
}

async function sendPush(fcmToken, { title, body, data }) {
  const { FCM_SERVER_KEY } = process.env;
  if (!FCM_SERVER_KEY) return { sent: false, reason: 'FCM not configured' };

  try {
    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Authorization': `key=${FCM_SERVER_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: fcmToken,
        notification: { title, body, click_action: process.env.APP_URL || 'http://localhost:3000' },
        data: data || {},
      }),
    });
    const result = await res.json();
    if (result.success === 1) {
      return { sent: true };
    }
    return { sent: false, reason: JSON.stringify(result) };
  } catch (e) {
    return { sent: false, reason: e.message };
  }
}

async function getNotifications(userId, { unreadOnly = false, limit = 20 } = {}) {
  try {
    const notifications = await table('notifications');
    let filter = { user_id: userId };
    let rows = await notifications.filter(filter);
    if (unreadOnly) rows = rows.filter(r => !r.read);
    rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return rows.slice(0, limit).map(r => ({
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      data: r.data ? JSON.parse(r.data) : null,
      read: !!r.read,
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}

async function markRead(userId, notificationId) {
  try {
    const notifications = await table('notifications');
    await notifications.update(
      { id: notificationId, user_id: userId },
      { read: true }
    );
    return true;
  } catch {
    return false;
  }
}

async function markAllRead(userId) {
  try {
    const notifications = await table('notifications');
    const rows = await notifications.filter({ user_id: userId });
    for (const r of rows) {
      if (!r.read) await notifications.update({ id: r.id }, { read: true });
    }
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  sendEmail,
  notifyNewAlert,
  sendPush,
  getNotifications,
  markRead,
  markAllRead,
};
