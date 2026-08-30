/* ─── Enclave Monitoring Service ───
 * Tier-aware scheduled identity monitoring across multiple sources.
 *
 * Sources: surface web, Reddit, paste sites, dark web, social (X via Nitter).
 * - Per-source health tracking (ok / degraded / down / cooldown)
 * - Exponential backoff on failures; CAPTCHA & rate-limit graceful handling
 * - Scheduler per tier: free=manual only, pro=hourly, shield=hourly+more
 *   sources, business=every 15 minutes
 */

const { v4: uuidv4 } = require('uuid');
const { table } = require('../db/query');
const crawler = require('./crawler');
const notifications = require('./notifications');
const takedownService = require('./takedown');

/* ─── Tier configuration ─── */
const TIER_RANK = { free: 0, detection_only: 0, pro: 1, shield: 2, business: 3 };
const TIER_SCHEDULE_MINUTES = { pro: 60, shield: 60, business: 15 };

/* ─── Source registry ─── */
const SOURCES = [
  { id: 'web',     label: 'Surface Web',      minTierRank: 0, fragile: false },
  { id: 'reddit',  label: 'Reddit',           minTierRank: 1, fragile: false },
  { id: 'paste',   label: 'Paste Sites',      minTierRank: 1, fragile: false },
  { id: 'darkweb', label: 'Dark Web (Ahmia)', minTierRank: 2, fragile: false },
  { id: 'social',  label: 'X/Twitter (Nitter)', minTierRank: 3, fragile: true },
];

const SUSPICIOUS_SUBREDDITS = [
  'deepfake', 'deepfakes', 'faceswap', 'nsfw', 'gonewild', 'jerkbuds',
  'nudes', 'leaked', 'celebfakes', 'nsfw411',
];

/* ─── State ─── */
const _sessions = new Map();          // userId -> { running, timeout, ... }
const _health = new Map();            // userId -> Map(sourceId -> health obj)

function _defaultHealth() {
  return {
    status: 'idle',            // idle | ok | degraded | down | cooldown
    lastRunAt: null,
    lastSuccessAt: null,
    lastError: null,
    consecutiveFailures: 0,
    totalRuns: 0,
    totalFindings: 0,
    cooldownUntil: 0,
  };
}

function _getHealth(userId, sourceId) {
  if (!_health.has(userId)) _health.set(userId, new Map());
  const m = _health.get(userId);
  if (!m.has(sourceId)) m.set(sourceId, _defaultHealth());
  return m.get(sourceId);
}

async function _persistHealth(userId) {
  try {
    const tbl = await table('monitoring_state');
    const snapshot = {};
    for (const [id, h] of (_health.get(userId) || new Map())) snapshot[id] = h;
    const existing = await tbl.filter({ user_id: userId });
    const row = {
      user_id: userId,
      sources_health: snapshot,
      updated_at: new Date().toISOString(),
    };
    if (existing.length) await tbl.update({ user_id: userId }, row);
    else await tbl.insert({ id: uuidv4(), ...row });
  } catch (e) {
    console.warn('[Monitor] persist health failed:', e.message);
  }
}

/* ─── HTTP helper ─── */
async function fetchWithTimeout(url, timeoutMs = 10000, headers = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...headers,
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

/* ─── Source implementations ─── */

async function searchReddit(userName) {
  const results = [];
  const query = `"${userName}" (deepfake OR fake OR leaked OR impersonat* OR nude OR nsfw)`;
  const res = await fetchWithTimeout(
    `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=25&sort=new&include_over_18=on`,
    12000,
    { Accept: 'application/json' }
  );
  if (res.status === 429) throw Object.assign(new Error('reddit rate limited'), { code: 'RATE_LIMITED' });
  if (!res.ok) throw new Error(`reddit returned ${res.status}`);

  const data = await res.json();
  for (const child of (data.data?.children || [])) {
    const p = child.data || {};
    const title = (p.title || '').toLowerCase();
    const sub = (p.subreddit || '').toLowerCase();
    if (!title.includes(userName.toLowerCase())) continue;

    const susSub = SUSPICIOUS_SUBREDDITS.some((s) => sub.includes(s));
    const susTitle = /deepfake|fake|impersonat|leak|nonconsensual|ncii|sextortion/.test(title);

    results.push({
      sourceUrl: `https://www.reddit.com${p.permalink || ''}`,
      confidence: Math.min(95, 45 + (susSub ? 30 : 0) + (susTitle ? 20 : 0)),
      mediaType: 'social',
      matchedOn: `reddit r/${sub}${susSub ? ' (suspicious subreddit)' : ''}${susTitle ? ' + suspicious keywords' : ''}`,
      notes: `Reddit post: ${p.title}`,
      timestamp: new Date((p.created_utc || Date.now() / 1000) * 1000).toISOString(),
      engine: 'reddit',
    });
  }
  return results;
}

const PASTE_SITES = ['pastebin.com', 'justpaste.it', 'textbin.net', 'controlc.com'];

async function searchPastes(userName, searchFn) {
  const results = [];
  const siteQuery = PASTE_SITES.map((s) => `site:${s}`).join(' OR ');
  const q = `${siteQuery} "${userName}" (leaked OR doxx OR deepfake OR nudes OR exposed)`;
  // Uses the crawler's DuckDuckGo parser through its exported web search on a custom query is not
  // directly supported, so reuse DDG HTML endpoint here.
  const cheerio = require('cheerio');
  const res = await fetchWithTimeout(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, 12000);
  if (res.status === 429) throw Object.assign(new Error('ddg rate limited'), { code: 'RATE_LIMITED' });
  if (!res.ok) throw new Error(`ddg returned ${res.status}`);
  const html = await res.text();
  if (/anomaly|captcha/i.test(html.slice(0, 3000)) && !html.includes('result__a')) {
    throw Object.assign(new Error('ddg challenge page'), { code: 'SOURCE_BLOCKED' });
  }

  const $ = cheerio.load(html);
  $('.result__a, a.result__a').each((i, el) => {
    let url = $(el).attr('href') || '';
    const m = url.match(/uddg=([^&]+)/);
    if (m) url = decodeURIComponent(m[1]);
    if (!url.startsWith('http')) return;
    const title = $(el).text().trim();
    results.push({
      sourceUrl: url,
      confidence: 65,
      mediaType: 'paste',
      matchedOn: 'paste site match',
      notes: `Paste result: ${title || url}`,
      timestamp: new Date().toISOString(),
      engine: 'paste-ddg',
    });
  });
  return results;
}

const NITTER_INSTANCES = [
  'https://nitter.net',
  'https://nitter.poast.org',
  'https://nitter.privacydev.net',
];

async function searchSocial(userName) {
  const errors = [];
  for (const base of NITTER_INSTANCES) {
    try {
      const res = await fetchWithTimeout(`${base}/search?f=tweets&q=${encodeURIComponent(`"${userName}"`)}`, 10000);
      if (!res.ok) { errors.push(`${base}:${res.status}`); continue; }
      const html = await res.text();
      if (/instance has been disabled|rate.limit|blocked/i.test(html.slice(0, 2000))) {
        errors.push(`${base}:blocked`);
        continue;
      }
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);
      const results = [];
      $('.timeline-item').each((i, el) => {
        if (i > 15) return;
        const link = $(el).find('a.tweet-link').attr('href') || '';
        const text = $(el).find('.tweet-content').text().trim();
        const username = $(el).find('.username').first().text().trim();
        results.push({
          sourceUrl: `https://x.com${link}`,
          confidence: 55,
          mediaType: 'social',
          matchedOn: `x/twitter mention by ${username} (via nitter)`,
          notes: `Tweet: ${text.slice(0, 160)}`,
          timestamp: new Date().toISOString(),
          engine: 'nitter',
        });
      });
      if (results.length || html.includes('timeline-item')) return results;
      errors.push(`${base}:no-items`);
    } catch (e) {
      errors.push(`${base}:${e.message.slice(0, 40)}`);
    }
  }
  throw Object.assign(
    new Error(`all nitter instances failed (${errors.join(', ')})`),
    { code: 'SOURCE_DOWN' }
  );
}

/* ─── Source runner with health tracking ─── */

const _sourceRunners = {
  web: (name) => crawler.searchWebEngines(name),
  reddit: searchReddit,
  paste: searchPastes,
  darkweb: (name) => crawler.searchDarkWebSources(name),
  social: searchSocial,
};

function tierRank(tier) {
  return TIER_RANK[tier] ?? 0;
}

/** Sources enabled for a given tier. */
function enabledSourcesForTier(tier) {
  const rank = tierRank(tier);
  return SOURCES.filter((s) => rank >= s.minTierRank).map((s) => s.id);
}

async function runSource(userId, userName, sourceId) {
  const health = _getHealth(userId, sourceId);
  if (Date.now() < health.cooldownUntil) {
    return { skipped: true, reason: 'cooldown' };
  }

  health.lastRunAt = new Date().toISOString();
  health.totalRuns++;

  try {
    const runner = _sourceRunners[sourceId];
    const results = runner ? await runner(userName) : [];
    health.status = 'ok';
    health.lastSuccessAt = new Date().toISOString();
    health.lastError = null;
    health.consecutiveFailures = 0;
    health.totalFindings += results.length;
    await _persistHealth(userId);
    return { skipped: false, results };
  } catch (e) {
    health.consecutiveFailures++;
    health.lastError = e.message.slice(0, 200);

    // Exponential backoff: 2min -> 5min -> 15min cap
    const backoffMin = Math.min(15, 2 * Math.pow(2.5, health.consecutiveFailures - 1));
    health.cooldownUntil = Date.now() + backoffMin * 60 * 1000;

    if (e.code === 'RATE_LIMITED') {
      health.status = 'cooldown';
      health.cooldownUntil = Date.now() + 5 * 60 * 1000;
    } else if (e.code === 'SOURCE_BLOCKED' || e.code === 'SOURCE_DOWN') {
      health.status = sourceId === 'social' ? 'down' : 'degraded';
    } else {
      health.status = health.consecutiveFailures >= 3 ? 'down' : 'degraded';
    }
    console.warn(`[Monitor] source ${sourceId} failed for ${userName}: ${e.message.slice(0, 120)}`);
    await _persistHealth(userId);
    return { skipped: false, results: [], error: e.message };
  }
}

/* ─── Full monitoring cycle ─── */

async function monitorCycle(userId, tier) {
  const users = await table('users');
  const user = await users.find({ id: userId });
  const userName = user?.full_name;
  if (!userName || userName === 'unknown') {
    return { error: 'User has no registered name to monitor' };
  }

  const enabledIds = enabledSourcesForTier(tier);
  const findings = [];

  for (const sourceId of enabledIds) {
    const out = await runSource(userId, userName, sourceId);
    if (!out.skipped && out.results) findings.push(...out.results);
  }

  /* Deep-analyze top findings (image extraction + face match), then create alerts */
  const toAnalyze = findings.sort((a, b) => b.confidence - a.confidence).slice(0, 4);
  const analyzed = [];
  for (const r of toAnalyze) {
    // Perceptual resurface detection: does this finding's image match a live takedown's phash?
    try {
      const resurface = await takedownService.matchResurfacedContent(userId, r.sourceUrl);
      if (resurface) {
        r.confidence = Math.min(99, r.confidence + 20);
        r.matchedOn += ` | RESURFACED content matching case ${String(resurface.takedownId).slice(0, 8)} (${resurface.similarityBits}/64 bits)`;
      }
    } catch (_) {}
    analyzed.push(await crawler.deepAnalyzeResult(r, userId));
  }

  const alertsTbl = await table('alerts');
  let newAlertCount = 0;
  for (const r of [...analyzed, ...findings.filter((f) => !analyzed.includes(f))]) {
    const existing = await alertsTbl.filter({ source_url: r.sourceUrl, user_id: userId });
    if (existing.length > 0) continue;

    const alertData = {
      id: uuidv4(),
      user_id: userId,
      source_url: r.sourceUrl,
      confidence: parseFloat(Number(r.confidence).toFixed(1)),
      status: 'PENDING_REVIEW',
      media_type: r.mediaType || 'link',
      matched_on: r.matchedOn || 'similarity match',
      notes: r.notes || '',
      timestamp: r.timestamp,
      created_at: new Date().toISOString(),
    };
    await alertsTbl.insert(alertData);
    newAlertCount++;

    if (r.confidence >= 50 && user) {
      try { await notifications.notifyNewAlert(user, alertData); } catch (_) {}
    }
  }

  // Notify user if new alerts were found
  if (newAlertCount > 0 && user) {
    try {
      const notifTbl = await table('notifications');
      await notifTbl.insert({
        id: uuidv4(),
        user_id: userId,
        type: 'monitoring_cycle',
        title: `${newAlertCount} new alert${newAlertCount > 1 ? 's' : ''} found`,
        body: `Monitoring scan completed across ${enabledIds.length} sources. ${findings.length} finding(s) total.`,
        data: JSON.stringify({ sourcesRun: enabledIds.length, findings: findings.length, newAlerts: newAlertCount }),
        read: false,
        created_at: new Date().toISOString(),
      });
      if (user.email && user.email_notifications !== false) {
        await notifications.sendEmail(
          user.email,
          `Enclave: ${newAlertCount} new identity threat${newAlertCount > 1 ? 's' : ''} detected`,
          `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#1a1a2e;">New threats detected</h2>
            <p>Monitoring scan completed across ${enabledIds.length} sources.</p>
            <p><strong>${newAlertCount}</strong> new alert(s), <strong>${findings.length}</strong> total finding(s).</p>
            <p><a href="${process.env.APP_URL || 'http://localhost:3000'}/alerts" style="background:#e94560;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">View Alerts</a></p>
          </div>`
        );
      }
      if (user.fcm_token) {
        await notifications.sendPush(user.fcm_token, {
          title: `${newAlertCount} new alert(s)`,
          body: `Monitoring found ${findings.length} finding(s) across ${enabledIds.length} sources`,
        });
      }
    } catch (_) {}
  }

  return { sourcesRun: enabledIds.length, findings: findings.length, newAlerts: newAlertCount };
}

/* ─── Scheduler ─── */

async function startMonitoring(userId, tier) {
  if (_sessions.has(userId)) return getSessionStatus(userId);

  const minutes = TIER_SCHEDULE_MINUTES[tier];
  const state = {
    running: true,
    timeout: null,
    cycleCount: 0,
    intervalMinutes: minutes || null,
    nextRunAt: null,
  };

  async function loop() {
    if (!state.running) return;
    state.cycleCount++;
    try {
      await monitorCycle(userId, tier);
    } catch (e) {
      console.warn('[Monitor] cycle error:', e.message);
    }
    if (!state.running) return;

    let waitMs;
    if (minutes && state.cycleCount >= 1) {
      waitMs = minutes * 60 * 1000;
    } else if (minutes) {
      waitMs = 30 * 1000; // first quick cycle
    } else {
      // Free tier "monitoring": gentle 6h re-check of surface sources only
      waitMs = 6 * 60 * 60 * 1000;
    }
    state.nextRunAt = new Date(Date.now() + waitMs).toISOString();
    state.timeout = setTimeout(loop, waitMs);
  }

  _sessions.set(userId, state);

  // Kick off first cycle shortly after start
  state.timeout = setTimeout(loop, 3000);
  return getSessionStatus(userId);
}

function stopMonitoring(userId) {
  const state = _sessions.get(userId);
  if (!state) return false;
  state.running = false;
  if (state.timeout) clearTimeout(state.timeout);
  _sessions.delete(userId);
  return true;
}

function isMonitoring(userId) {
  return _sessions.has(userId);
}

function getSessionStatus(userId) {
  const state = _sessions.get(userId);
  if (!state) return { active: false, intervalMinutes: null, nextRunAt: null, cyclesCompleted: 0 };
  return {
    active: true,
    intervalMinutes: state.intervalMinutes,
    nextRunAt: state.nextRunAt,
    cyclesCompleted: state.cycleCount,
  };
}

/* ─── Status payload for the dashboard API ─── */

async function getStatusForUser(userId, tier) {
  const rank = tierRank(tier);
  const session = getSessionStatus(userId);

  // Load persisted health if in-memory empty (server restart)
  if (!_health.has(userId)) {
    try {
      const tbl = await table('monitoring_state');
      const rows = await tbl.filter({ user_id: userId });
      if (rows.length && rows[0].sources_health) {
        const m = new Map();
        for (const [id, h] of Object.entries(rows[0].sources_health)) m.set(id, { ..._defaultHealth(), ...h });
        _health.set(userId, m);
      }
    } catch (_) {}
  }

  const now = Date.now();
  const sources = SOURCES.map((s) => {
    const h = _getHealth(userId, s.id);
    const enabledByTier = rank >= s.minTierRank;
    let status = h.status;
    if (enabledByTier && now < h.cooldownUntil) status = 'cooldown';
    if (!enabledByTier) status = 'locked';
    return {
      id: s.id,
      label: s.label,
      fragile: s.fragile,
      enabled: enabledByTier,
      requiredTier: Object.keys(TIER_RANK).find((k) => TIER_RANK[k] === s.minTierRank) || null,
      status,
      lastRunAt: h.lastRunAt,
      lastSuccessAt: h.lastSuccessAt,
      lastError: h.lastError,
      totalRuns: h.totalRuns,
      totalFindings: h.totalFindings,
      cooldownRemainingMin: Math.max(0, Math.ceil((h.cooldownUntil - now) / 60000)),
    };
  });

  return {
    active: session.active,
    tier,
    schedule: session.intervalMinutes
      ? `every ${session.intervalMinutes} min`
      : (session.active ? 'background check every 6h' : 'manual only'),
    intervalMinutes: session.intervalMinutes,
    nextRunAt: session.nextRunAt,
    cyclesCompleted: session.cyclesCompleted,
    sources,
  };
}

module.exports = {
  startMonitoring,
  stopMonitoring,
  isMonitoring,
  getSessionStatus,
  getStatusForUser,
  monitorCycle,
  enabledSourcesForTier,
};
