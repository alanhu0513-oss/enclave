const express = require('express');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');
const { table } = require('../db/query');
const billing = require('../services/billing');
const monitoring = require('../services/monitoring-service');

const router = express.Router();
router.use(authenticate);

/** Middleware: require admin role. */
async function requireAdmin(req, res, next) {
  try {
    const users = await table('users');
    const user = await users.find({ id: req.user.userId });
    if (!user || user.role !== 'admin') {
      return error(res, 'Admin access required', 403);
    }
    next();
  } catch (e) {
    return error(res, e.message);
  }
}

router.use(requireAdmin);

/* ─── Dashboard Overview ─── */

router.get('/overview', async (req, res) => {
  try {
    const users = await table('users');
    const alerts = await table('alerts');
    const allUsers = await users.filter({});
    const allAlerts = await alerts.filter({});

    const now = new Date();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const newUsersToday = allUsers.filter((u) => new Date(u.created_at) > dayAgo).length;
    const newUsersWeek = allUsers.filter((u) => new Date(u.created_at) > weekAgo).length;
    const newAlertsToday = allAlerts.filter((a) => new Date(a.created_at) > dayAgo).length;

    const planCounts = {};
    for (const u of allUsers) {
      const plan = u.plan || 'free';
      planCounts[plan] = (planCounts[plan] || 0) + 1;
    }

    return success(res, {
      totalUsers: allUsers.length,
      totalAlerts: allAlerts.length,
      newUsersToday,
      newUsersWeek,
      newAlertsToday,
      planDistribution: planCounts,
    });
  } catch (e) {
    return error(res, e.message);
  }
});

/* ─── Revenue Metrics ─── */

router.get('/revenue', async (req, res) => {
  try {
    const users = await table('users');
    const allUsers = await users.filter({});

    let mrr = 0;
    const planPrices = { free: 0, detection_only: 0, pro: 999, shield: 1999, business: 4999 };
    for (const u of allUsers) {
      mrr += planPrices[u.plan] || 0;
    }

    const planCounts = {};
    for (const u of allUsers) {
      const plan = u.plan || 'free';
      planCounts[plan] = (planCounts[plan] || 0) + 1;
    }

    return success(res, {
      mrr,
      mrrFormatted: `$${(mrr / 100).toFixed(2)}`,
      arr: mrr * 12,
      arrFormatted: `$${((mrr * 12) / 100).toFixed(2)}`,
      payingUsers: (planCounts.pro || 0) + (planCounts.shield || 0) + (planCounts.business || 0),
      freeUsers: planCounts.free || 0,
      planDistribution: planCounts,
    });
  } catch (e) {
    return error(res, e.message);
  }
});

/* ─── User Management ─── */

router.get('/users', async (req, res) => {
  try {
    const users = await table('users');
    const allUsers = await users.filter({});
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const sorted = allUsers.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const page = sorted.slice(offset, offset + limit).map((u) => ({
      id: u.id,
      email: u.email,
      name: u.full_name,
      plan: u.plan || 'free',
      role: u.user_role || 'user',
      createdAt: u.created_at,
      lastLogin: u.last_login,
    }));

    return success(res, { users: page, total: allUsers.length, limit, offset });
  } catch (e) {
    return error(res, e.message);
  }
});

router.patch('/users/:id/plan', async (req, res) => {
  try {
    const { plan } = req.body;
    const validPlans = ['free', 'detection_only', 'pro', 'shield', 'business'];
    if (!validPlans.includes(plan)) return error(res, 'Invalid plan', 400);

    const users = await table('users');
    await users.update({ id: req.params.id }, { plan });
    return success(res, { updated: true });
  } catch (e) {
    return error(res, e.message);
  }
});

router.patch('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['user', 'admin'];
    if (!validRoles.includes(role)) return error(res, 'Invalid role', 400);

    const users = await table('users');
    await users.update({ id: req.params.id }, { user_role: role });
    return success(res, { updated: true });
  } catch (e) {
    return error(res, e.message);
  }
});

/* ─── System Health ─── */

router.get('/health', async (req, res) => {
  try {
    const mlStatus = await require('../services/ml-client').getStatus().catch(() => ({ available: false }));
    const uptime = process.uptime();
    const memory = process.memoryUsage();

    return success(res, {
      server: {
        status: 'ok',
        uptime: Math.floor(uptime),
        uptimeFormatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
        memory: {
          heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
          rss: Math.round(memory.rss / 1024 / 1024),
        },
      },
      ml: mlStatus,
      nodeVersion: process.version,
      platform: process.platform,
    });
  } catch (e) {
    return error(res, e.message);
  }
});

/* ─── Alerts Overview ─── */

router.get('/alerts', async (req, res) => {
  try {
    const alerts = await table('alerts');
    const allAlerts = await alerts.filter({});

    const statusCounts = {};
    for (const a of allAlerts) {
      const status = a.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    }

    const highConfidence = allAlerts.filter((a) => (a.confidence || 0) >= 80).length;

    return success(res, {
      total: allAlerts.length,
      statusDistribution: statusCounts,
      highConfidence,
    });
  } catch (e) {
    return error(res, e.message);
  }
});

module.exports = router;
