/**
 * Usage Metering Service
 * Tracks API calls, scans, alerts, takedowns per user.
 * Enforces tier limits and provides usage statistics.
 */

const { table } = require('../db/query');
const { getTierLimits } = require('./billing');

const DEFAULT_LIMITS = {
  free: { scans: 3, alerts: 10, takedowns: 0, deepScans: 1, apiCalls: 0 },
  detection_only: { scans: -1, alerts: 50, takedowns: 0, deepScans: 2, apiCalls: 0 },
  pro: { scans: 50, alerts: 500, takedowns: 2, deepScans: 20, apiCalls: 0 },
  shield: { scans: 200, alerts: -1, takedowns: 10, deepScans: -1, apiCalls: 0 },
  business: { scans: -1, alerts: -1, takedowns: -1, deepScans: -1, apiCalls: 10000 }
};

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function getUsage(userId, monthKey) {
  monthKey = monthKey || getCurrentMonthKey();
  try {
    const usage = await table('usage_tracking');
    const record = await usage.find({ user_id: userId, month: monthKey });
    return record || {
      user_id: userId,
      month: monthKey,
      scans: 0, alerts: 0, takedowns: 0, deep_scans: 0, api_calls: 0,
      created_at: new Date().toISOString()
    };
  } catch (e) {
    return {
      user_id: userId,
      month: monthKey,
      scans: 0, alerts: 0, takedowns: 0, deep_scans: 0, api_calls: 0,
      created_at: new Date().toISOString()
    };
  }
}

async function incrementUsage(userId, type, count) {
  count = count || 1;
  const monthKey = getCurrentMonthKey();
  try {
    const usage = await table('usage_tracking');
    const existing = await usage.find({ user_id: userId, month: monthKey });

    if (existing) {
      const field = type === 'deep_scan' ? 'deep_scans' :
                    type === 'api_call' ? 'api_calls' :
                    type === 'scan' ? 'scans' :
                    type === 'alert' ? 'alerts' :
                    type === 'takedown' ? 'takedowns' : type;
      const newVal = (existing[field] || 0) + count;
      await usage.update({ id: existing.id }, {
        [field]: newVal,
        updated_at: new Date().toISOString()
      });
      return { [field]: newVal };
    } else {
      const record = {
        id: require('uuid').v4(),
        user_id: userId,
        month: monthKey,
        scans: type === 'scan' ? count : 0,
        alerts: type === 'alert' ? count : 0,
        takedowns: type === 'takedown' ? count : 0,
        deep_scans: type === 'deep_scan' ? count : 0,
        api_calls: type === 'api_call' ? count : 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      await usage.insert(record);
      return record;
    }
  } catch (e) {
    console.warn('[USAGE] Failed to track:', e.message);
    return null;
  }
}

async function checkLimit(userId, type, tier) {
  tier = tier || 'free';
  const limits = DEFAULT_LIMITS[tier] || DEFAULT_LIMITS.free;
  const usage = await getUsage(userId);

  let current, limit;
  switch (type) {
    case 'scan': current = usage.scans; limit = limits.scans; break;
    case 'alert': current = usage.alerts; limit = limits.alerts; break;
    case 'takedown': current = usage.takedowns; limit = limits.takedowns; break;
    case 'deep_scan': current = usage.deep_scans; limit = limits.deepScans; break;
    case 'api_call': current = usage.api_calls; limit = limits.apiCalls; break;
    default: return { allowed: false, reason: 'unknown_type' };
  }

  // -1 means unlimited
  if (limit === -1) {
    return { allowed: true, current, limit: -1, unlimited: true };
  }

  const remaining = Math.max(0, limit - current);
  const allowed = current < limit;

  return {
    allowed,
    current,
    limit,
    remaining,
    tier,
    type
  };
}

async function getUsageSummary(userId, tier) {
  const usage = await getUsage(userId);
  const limits = DEFAULT_LIMITS[tier || 'free'] || DEFAULT_LIMITS.free;

  return {
    month: usage.month || getCurrentMonthKey(),
    scans: {
      used: usage.scans || 0,
      limit: limits.scans,
      unlimited: limits.scans === -1,
      remaining: limits.scans === -1 ? -1 : Math.max(0, limits.scans - (usage.scans || 0))
    },
    alerts: {
      used: usage.alerts || 0,
      limit: limits.alerts,
      unlimited: limits.alerts === -1,
      remaining: limits.alerts === -1 ? -1 : Math.max(0, limits.alerts - (usage.alerts || 0))
    },
    takedowns: {
      used: usage.takedowns || 0,
      limit: limits.takedowns,
      unlimited: limits.takedowns === -1,
      remaining: limits.takedowns === -1 ? -1 : Math.max(0, limits.takedowns - (usage.takedowns || 0))
    },
    deepScans: {
      used: usage.deep_scans || 0,
      limit: limits.deepScans,
      unlimited: limits.deepScans === -1,
      remaining: limits.deepScans === -1 ? -1 : Math.max(0, limits.deepScans - (usage.deep_scans || 0))
    },
    apiCalls: {
      used: usage.api_calls || 0,
      limit: limits.apiCalls,
      unlimited: limits.apiCalls === -1,
      remaining: limits.apiCalls === -1 ? -1 : Math.max(0, limits.apiCalls - (usage.api_calls || 0))
    }
  };
}

async function getUsageHistory(userId, months) {
  months = months || 12;
  try {
    const usage = await table('usage_tracking');
    const all = await usage.filter({ user_id: userId });
    if (!Array.isArray(all)) return all ? [all] : [];
    return all.slice(-months);
  } catch (e) {
    return [];
  }
}

module.exports = {
  getUsage,
  incrementUsage,
  checkLimit,
  getUsageSummary,
  getUsageHistory,
  getCurrentMonthKey,
  DEFAULT_LIMITS
};
