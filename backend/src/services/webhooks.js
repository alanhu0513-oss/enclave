/**
 * Webhook Event System
 * Allows external systems to subscribe to real-time events from Enclave.
 * Supports per-user webhook endpoints with secret signing and retry logic.
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { table } = require('../db/query');

const EVENT_TYPES = [
  'alert.new',
  'alert.resolved',
  'scan.completed',
  'scan.threat_detected',
  'takedown.initiated',
  'takedown.completed',
  'crawler.threat_found',
  'threat.shared',
  'community.post',
  'subscription.changed',
  'usage.limit_reached'
];

function signPayload(payload, secret) {
  return crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
}

/**
 * Register a webhook endpoint for a user.
 */
async function registerWebhook(userId, data) {
  const { url, events, description } = data;
  if (!url) return { success: false, reason: 'url_required' };

  // Validate URL
  try { new URL(url); } catch (e) {
    return { success: false, reason: 'invalid_url' };
  }

  const validEvents = (events || EVENT_TYPES).filter(e => EVENT_TYPES.includes(e));
  if (validEvents.length === 0) return { success: false, reason: 'no_valid_events' };

  const secret = crypto.randomBytes(32).toString('hex');
  const id = uuidv4();
  const webhooks = await table('webhooks');

  await webhooks.insert({
    id,
    user_id: userId,
    url,
    secret,
    events: JSON.stringify(validEvents),
    description: description || '',
    active: true,
    failure_count: 0,
    last_triggered_at: null,
    created_at: new Date().toISOString()
  });

  return { success: true, id, secret, url, events: validEvents };
}

/**
 * List webhooks for a user.
 */
async function listWebhooks(userId) {
  const webhooks = await table('webhooks');
  const all = await webhooks.filter({ user_id: userId });
  return (Array.isArray(all) ? all : all ? [all] : []).map(w => ({
    id: w.id,
    url: w.url,
    events: typeof w.events === 'string' ? JSON.parse(w.events) : w.events,
    description: w.description,
    active: w.active,
    failureCount: w.failure_count,
    lastTriggeredAt: w.last_triggered_at,
    createdAt: w.created_at
  }));
}

/**
 * Delete a webhook.
 */
async function deleteWebhook(userId, webhookId) {
  const webhooks = await table('webhooks');
  const existing = await webhooks.find({ id: webhookId, user_id: userId });
  if (!existing) return { success: false, reason: 'not_found' };
  await webhooks.remove({ id: webhookId });
  return { success: true };
}

/**
 * Toggle webhook active state.
 */
async function toggleWebhook(userId, webhookId, active) {
  const webhooks = await table('webhooks');
  const existing = await webhooks.find({ id: webhookId, user_id: userId });
  if (!existing) return { success: false, reason: 'not_found' };
  await webhooks.update({ id: webhookId }, {
    active: active ? 1 : 0,
    updated_at: new Date().toISOString()
  });
  return { success: true, active };
}

/**
 * Dispatch an event to all matching webhooks.
 */
async function dispatchEvent(eventType, payload) {
  const webhooks = await table('webhooks');
  const all = await webhooks.all();
  const list = Array.isArray(all) ? all : all ? [all] : [];

  const matching = list.filter(w => {
    if (!w.active) return false;
    const events = typeof w.events === 'string' ? JSON.parse(w.events) : w.events;
    return events.includes(eventType) || events.includes('*');
  });

  const results = [];
  for (const wh of matching) {
    const body = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: payload
    };
    const signature = signPayload(body, wh.secret);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const resp = await fetch(wh.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Enclave-Signature': signature,
          'X-Enclave-Event': eventType,
          'User-Agent': 'EnclaveVault-Webhook/1.0'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeout);
      const success = resp.status >= 200 && resp.status < 300;

      await webhooks.update({ id: wh.id }, {
        last_triggered_at: new Date().toISOString(),
        failure_count: success ? 0 : (wh.failure_count || 0) + 1
      });

      results.push({ webhookId: wh.id, success, status: resp.status });

      // Disable after 5 consecutive failures
      if (!success && (wh.failure_count || 0) + 1 >= 5) {
        await webhooks.update({ id: wh.id }, { active: 0 });
      }
    } catch (e) {
      await webhooks.update({ id: wh.id }, {
        last_triggered_at: new Date().toISOString(),
        failure_count: (wh.failure_count || 0) + 1
      });
      results.push({ webhookId: wh.id, success: false, error: e.message });
    }
  }

  return { dispatched: results.length, results };
}

/**
 * Verify a webhook signature.
 */
function verifySignature(payload, signature, secret) {
  const expected = signPayload(payload, secret);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

module.exports = {
  EVENT_TYPES,
  registerWebhook,
  listWebhooks,
  deleteWebhook,
  toggleWebhook,
  dispatchEvent,
  verifySignature,
  signPayload
};
