/* ─── API Key Authentication Middleware ───
 * Authenticates requests via X-API-Key header.
 * Validates key against api_keys table, logs usage, checks rate limits.
 */

const { table } = require('../db/query');

async function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return next(); // Not an API key request, fall through

  try {
    const keys = await table('api_keys');
    const keyRecord = await keys.find({ key_id: apiKey, status: 'active' });

    if (!keyRecord) {
      return res.status(401).json({ error: 'Invalid or revoked API key' });
    }

    // Check rate limit
    if (keyRecord.rate_limit) {
      const usageLogs = await table('api_usage_logs');
      const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
      const recentLogs = await usageLogs.filter({
        api_key_id: keyRecord.id,
      });
      const recentCount = Array.isArray(recentLogs)
        ? recentLogs.filter(l => l.created_at > oneMinuteAgo).length
        : 0;

      if (recentCount >= keyRecord.rate_limit) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          limit: keyRecord.rate_limit,
          retryAfter: 60,
        });
      }
    }

    // Log usage
    try {
      const usageLogs = await table('api_usage_logs');
      await usageLogs.insert({
        id: require('uuid').v4(),
        api_key_id: keyRecord.id,
        user_id: keyRecord.user_id,
        endpoint: req.originalUrl,
        method: req.method,
        status_code: null, // Will be updated on response finish
        ip_address: req.ip || req.connection?.remoteAddress || 'unknown',
        created_at: new Date().toISOString(),
      });

      // Update last_used_at and total_requests
      await keys.update(
        { id: keyRecord.id },
        {
          last_used_at: new Date().toISOString(),
          total_requests: (keyRecord.total_requests || 0) + 1,
        }
      );
    } catch (_) {} // Non-blocking

    // Attach API key info to request
    req.apiKey = {
      id: keyRecord.id,
      userId: keyRecord.user_id,
      name: keyRecord.name,
      permissions: typeof keyRecord.permissions === 'string'
        ? JSON.parse(keyRecord.permissions)
        : keyRecord.permissions,
    };

    // Enforce permissions based on HTTP method
    const perms = req.apiKey.permissions || ['read'];
    const method = req.method.toUpperCase();
    const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const isAdmin = req.originalUrl.includes('/admin');

    if (isWrite && !perms.includes('write') && !perms.includes('admin')) {
      return res.status(403).json({ error: 'API key lacks write permission' });
    }
    if (isAdmin && !perms.includes('admin')) {
      return res.status(403).json({ error: 'API key lacks admin permission' });
    }

    // Also set user for downstream routes
    req.user = { userId: keyRecord.user_id };

    // Capture response status for logging
    const originalEnd = res.end;
    res.end = function (...args) {
      try {
        table('api_usage_logs').then(logs => {
          logs.filter({ api_key_id: keyRecord.id }).then(recent => {
            const latest = Array.isArray(recent) ? recent.find(l => !l.status_code) : null;
            if (latest) {
              logs.update({ id: latest.id }, { status_code: res.statusCode });
            }
          });
        }).catch(() => {});
      } catch (_) {}
      return originalEnd.apply(this, args);
    };

    next();
  } catch (e) {
    console.error('[API-KEY] Auth error:', e.message);
    return res.status(500).json({ error: 'API key validation failed' });
  }
}

module.exports = { authenticateApiKey };
