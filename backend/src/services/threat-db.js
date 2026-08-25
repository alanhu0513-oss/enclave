/**
 * Open Threat Database Service
 * Public API for threat indicators — allows external tools to query and submit.
 * Supports STIX-like format for interoperability.
 * Rate-limited by API key.
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { table } = require('../db/query');

const RATE_LIMITS = {
  free: { requests: 100, window: 86400 },       // 100/day
  pro: { requests: 1000, window: 86400 },       // 1000/day
  shield: { requests: 10000, window: 86400 },   // 10k/day
  business: { requests: 100000, window: 86400 } // 100k/day
};

function generateApiKey(userId) {
  const raw = `enclave_otdb_${userId}_${Date.now()}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

async function getOrCreateApiKey(userId) {
  try {
    const keys = await table('otdb_api_keys');
    const existing = await keys.find({ user_id: userId });
    if (existing) return existing.api_key;

    const apiKey = generateApiKey(userId);
    await keys.insert({
      id: uuidv4(),
      user_id: userId,
      api_key: apiKey,
      tier: 'free',
      requests_today: 0,
      last_reset: new Date().toISOString(),
      created_at: new Date().toISOString()
    });
    return apiKey;
  } catch (e) {
    return generateApiKey(userId);
  }
}

async function validateApiKey(apiKey) {
  if (!apiKey) return { valid: false };
  try {
    const keys = await table('otdb_api_keys');
    const key = await keys.find({ api_key: apiKey });
    if (!key) return { valid: false };

    // Check rate limit
    const lastReset = new Date(key.last_reset || key.created_at);
    const now = new Date();
    const elapsed = (now - lastReset) / 1000;
    const limits = RATE_LIMITS[key.tier] || RATE_LIMITS.free;

    if (elapsed > limits.window) {
      // Reset counter
      await keys.update({ id: key.id }, {
        requests_today: 0,
        last_reset: now.toISOString()
      });
      key.requests_today = 0;
    }

    if ((key.requests_today || 0) >= limits.requests) {
      return { valid: false, rateLimited: true, tier: key.tier };
    }

    // Increment
    await keys.update({ id: key.id }, {
      requests_today: (key.requests_today || 0) + 1
    });

    return { valid: true, userId: key.user_id, tier: key.tier };
  } catch (e) {
    return { valid: false };
  }
}

/**
 * Convert internal IoC to STIX-like bundle format.
 */
function toSTIX(indicator) {
  return {
    type: 'bundle',
    id: `bundle--${indicator.id}`,
    spec_version: '2.1',
    objects: [
      {
        type: 'indicator',
        spec_version: '2.1',
        id: `indicator--${indicator.id}`,
        created: indicator.created_at,
        modified: indicator.updated_at || indicator.created_at,
        name: `${indicator.ioc_type}: ${indicator.ioc_value.slice(0, 80)}`,
        description: indicator.description || '',
        pattern: `[${indicator.ioc_type}:value = '${indicator.ioc_value.replace(/'/g, "\\'")}']`,
        pattern_type: 'stix',
        valid_from: indicator.created_at,
        confidence: Math.round((indicator.confidence || 0.5) * 100),
        labels: [
          `severity:${indicator.severity}`,
          `type:${indicator.ioc_type}`,
          ...((typeof indicator.tags === 'string' ? JSON.parse(indicator.tags || '[]') : indicator.tags) || [])
        ],
        extensions: {
          'x-enclave-vault': {
            community_votes: indicator.community_votes || 0,
            verified: indicator.verified || false,
            source: 'community'
          }
        }
      }
    ]
  };
}

/**
 * Submit an IoC to the public threat database.
 */
async function submitIndicator(apiKey, data) {
  const auth = await validateApiKey(apiKey);
  if (!auth.valid) return { success: false, reason: auth.rateLimited ? 'rate_limited' : 'invalid_api_key' };

  const { iocType, iocValue, severity, description, tags } = data;
  if (!iocType || !iocValue) return { success: false, reason: 'missing_fields' };

  // Use the shared threat-intel service
  const threatIntel = require('./threat-intel');
  const result = await threatIntel.shareIndicator(auth.userId, {
    iocType, iocValue, severity, description, tags
  });

  return { ...result, apiKey: { tier: auth.tier } };
}

/**
 * Query the threat database (public API).
 */
async function queryIndicators(apiKey, filters) {
  const auth = await validateApiKey(apiKey);
  if (!auth.valid) return { success: false, reason: auth.rateLimited ? 'rate_limited' : 'invalid_api_key' };

  const threatIntel = require('./threat-intel');
  const results = await threatIntel.getIndicators(filters);

  return {
    success: true,
    ...results,
    apiKey: { tier: auth.tier },
    format: 'stix'
  };
}

/**
 * Bulk query — check multiple values against threat DB.
 */
async function bulkCheck(apiKey, values) {
  const auth = await validateApiKey(apiKey);
  if (!auth.valid) return { success: false, reason: auth.rateLimited ? 'rate_limited' : 'invalid_api_key' };

  const threatIntel = require('./threat-intel');
  const results = [];

  for (const item of (values || []).slice(0, 100)) {
    const check = await threatIntel.checkAgainstThreatDB(item.value, item.type);
    results.push({ value: item.value, type: item.type, ...check });
  }

  return {
    success: true,
    results,
    checked: results.length,
    threats: results.filter(r => r.known && r.highConfidence).length,
    apiKey: { tier: auth.tier }
  };
}

/**
 * Get API usage stats.
 */
async function getApiKeyStats(userId) {
  try {
    const keys = await table('otdb_api_keys');
    const key = await keys.find({ user_id: userId });
    if (!key) return null;

    const limits = RATE_LIMITS[key.tier] || RATE_LIMITS.free;
    return {
      tier: key.tier,
      requestsToday: key.requests_today || 0,
      requestsLimit: limits.requests,
      remaining: Math.max(0, limits.requests - (key.requests_today || 0)),
      windowHours: limits.window / 3600
    };
  } catch (e) {
    return null;
  }
}

module.exports = {
  RATE_LIMITS,
  generateApiKey,
  getOrCreateApiKey,
  validateApiKey,
  submitIndicator,
  queryIndicators,
  bulkCheck,
  getApiKeyStats,
  toSTIX
};
