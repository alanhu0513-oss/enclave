/* ─── Third-Party Integrations ───
 * Slack and Discord webhook integrations for alerts and notifications.
 */

const crypto = require('crypto');

class IntegrationService {
  constructor() {
    this.integrations = new Map();
  }

  /**
   * Send alert to Slack webhook
   */
  async sendSlack(webhookUrl, alert) {
    const payload = {
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `🚨 ${alert.title || 'Enclave Alert'}`, emoji: true },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Type:*\n${alert.type || 'unknown'}` },
            { type: 'mrkdwn', text: `*Severity:*\n${alert.severity || 'medium'}` },
            { type: 'mrkdwn', text: `*Confidence:*\n${alert.confidence || 0}%` },
            { type: 'mrkdwn', text: `*Time:*\n${alert.created_at || new Date().toISOString()}` },
          ],
        },
        ...(alert.description ? [{ type: 'section', text: { type: 'mrkdwn', text: alert.description } }] : []),
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View in Dashboard' },
              url: `${process.env.FRONTEND_URL || 'https://enclave-react.vercel.app'}/alerts`,
            },
          ],
        },
      ],
    };

    return this._postWebhook(webhookUrl, payload, 'Slack');
  }

  /**
   * Send alert to Discord webhook
   */
  async sendDiscord(webhookUrl, alert) {
    const embed = {
      title: alert.title || 'Enclave Alert',
      description: alert.description || 'No description',
      color: alert.severity === 'critical' ? 0xff0000 : alert.severity === 'high' ? 0xff8800 : 0x00ff88,
      fields: [
        { name: 'Type', value: alert.type || 'unknown', inline: true },
        { name: 'Severity', value: alert.severity || 'medium', inline: true },
        { name: 'Confidence', value: `${alert.confidence || 0}%`, inline: true },
      ],
      timestamp: alert.created_at || new Date().toISOString(),
      footer: { text: 'Enclave Identity Protection' },
      url: `${process.env.FRONTEND_URL || 'https://enclave-react.vercel.app'}/alerts`,
    };

    const payload = {
      embeds: [embed],
      username: 'Enclave Alerts',
      avatar_url: 'https://enclave-react.vercel.app/favicon.svg',
    };

    return this._postWebhook(webhookUrl, payload, 'Discord');
  }

  /**
   * Send alert to Zapier webhook
   */
  async sendZapier(webhookUrl, alert) {
    const payload = {
      event: alert.type || 'alert',
      title: alert.title || 'Enclave Alert',
      severity: alert.severity || 'medium',
      confidence: alert.confidence || 0,
      description: alert.description || '',
      timestamp: alert.created_at || new Date().toISOString(),
      dashboard_url: `${process.env.FRONTEND_URL || 'https://enclave-react.vercel.app'}/alerts`,
    };

    return this._postWebhook(webhookUrl, payload, 'Zapier');
  }

  /**
   * Send alert via email forwarding
   */
  async sendEmail(toEmail, alert) {
    try {
      const { table } = require('../db/query');
      const notifications = await table('notifications');
      await notifications.create({
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        user_id: alert.user_id,
        type: 'integration_email',
        title: alert.title || 'Enclave Alert',
        message: alert.description || `Alert: ${alert.type} (${alert.confidence}% confidence)`,
        read: false,
        created_at: new Date().toISOString(),
      });

      // Also try to send actual email if notifications service is available
      try {
        const notify = require('./notifications');
        if (notify.sendEmail) {
          await notify.sendEmail(toEmail, alert.title || 'Enclave Alert', alert.description || 'New alert from Enclave');
        }
      } catch (_) {}

      return { success: true, provider: 'email' };
    } catch (e) {
      return { success: false, provider: 'email', error: e.message };
    }
  }
  async _postWebhook(url, payload, provider) {
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          return { success: true, provider, attempt };
        }

        lastError = `HTTP ${res.status}`;
        if (res.status === 429) {
          const retryAfter = res.headers.get('retry-after');
          const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 5000 * attempt;
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        if (res.status >= 400 && res.status < 500) {
          return { success: false, provider, error: lastError, attempt };
        }
      } catch (e) {
        lastError = e.message;
      }

      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }

    return { success: false, provider, error: lastError, attempt: maxRetries };
  }

  /**
   * Generate webhook signature for verification
   */
  generateSignature(payload, secret) {
    return crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
  }

  /**
   * Verify incoming webhook signature
   */
  verifySignature(payload, signature, secret) {
    const expected = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }
}

module.exports = new IntegrationService();
