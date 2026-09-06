/* ─── Account Shield Service ───
 * Anti-hacker protection for the accounts a user cares about
 * (email, Google, bank, games, etc.).
 *
 * Monitors watched identifiers across breach datasets, dark-web /
 * leak sources, and suspicious credential-sharing pages. Generates
 * per-account security scores and emits Brevo email alerts when a
 * new breach finding appears.
 */

const { v4: uuidv4 } = require('uuid');
const { table } = require('../db/query');

const SITES = [
  'google', 'gmail', 'bank', 'credit-card', 'steam', 'epic', 'discord',
  'playstation', 'xbox', 'roblox', 'nintendo', 'twitter', 'instagram',
  'facebook', 'paypal', 'crypto', 'work', 'other',
];

function validSite(site) {
  return typeof site === 'string' && SITES.includes(site.toLowerCase());
}

function normalizeIdentifier(identifier) {
  return String(identifier || '').trim().toLowerCase();
}

/* ─── Breach dataset lookup (HIBP-style, offline + free source) ─── */

// A small embedded sample of well-known breach domains/patterns used to
// demonstrate monitoring without requiring a paid API key. Real detections
// come from the crawler + HIBP when HIBP_API_KEY is configured.
const NEGATIVE_DOMAINS = [
  'spambot', 'comb', 'antipublic', 'collection', 'leakbase', 'hudsonrock',
  'stealer', 'infostealer', 'rat', 'darkdump', 'breachcompilation',
];

function domainHit(identifier, domainCode) {
  return identifier.includes(domainCode);
}

/* ─── Crawler integration (dark web + paste + leaking-sites) ─── */

const CHECK_TIMEOUT_MS = 10000;

function withTimeout(promise, label, ms = CHECK_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => {
      console.warn(`[AccountShield] ${label} check timed out`);
      resolve({ results: [] });
    }, ms)),
  ]);
}

async function runSourceChecks(identifier) {
  const findings = [];
  const checked = {};
  try {
    const dark = await withTimeout(searchDarkWebSources(identifier), 'dark-web');
    const darkFindings = dark.results || [];
    for (const hit of darkFindings) {
      checked[hit.source || 'darkweb'] = true;
      if (hit.url && /suspicious|leak|dump|paste|forum/i.test(hit.url)) {
        findings.push({
          source: hit.source || 'darkweb',
          type: 'credential_leak',
          indicator: hit.url.slice(0, 200),
          headline: `Credential activity on ${hit.source || 'dark web'}`,
          detail: `Your identifier "${identifier}" was found on a leak/suspicious source.`,
          severity: 'high',
        });
      }
    }
  } catch (e) {
    console.warn('[AccountShield] dark-web check failed:', e.message);
  }

  try {
    const web = await withTimeout(searchWebEngines(identifier), 'web');
    const hits = web.results || [];
    for (const hit of hits) {
      const url = String(hit.url || '').toLowerCase();
      if (NEGATIVE_DOMAINS.some((d) => url.includes(d))) {
        checked.leak_domain = true;
        findings.push({
          source: 'leak_domain',
          type: 'credential_leak',
          indicator: hit.url.slice(0, 200),
          headline: 'Credential-adjacent domain indexed',
          detail: `A known leak/stealer-related location references "${identifier}".`,
          severity: 'medium',
        });
      }
    }
  } catch (e) {
    console.warn('[AccountShield] web check failed:', e.message);
  }

  const domains = Object.keys(checked);
  return { findings, checked: domains.length ? domains : ['none'] };
}

async function searchWebEngines(identifier) {
  try {
    const crawler = require('./crawler');
    if (typeof crawler.searchWebEngines !== 'function') return { results: [] };
    const r = await crawler.searchWebEngines(identifier);
    return Array.isArray(r) ? { results: r } : (r || { results: [] });
  } catch (e) {
    return { results: [] };
  }
}

async function searchDarkWebSources(identifier) {
  try {
    const crawler = require('./crawler');
    if (typeof crawler.searchDarkWebSources !== 'function') return { results: [] };
    const r = await crawler.searchDarkWebSources(identifier);
    return Array.isArray(r) ? { results: r } : (r || { results: [] });
  } catch (e) {
    return { results: [] };
  }
}

/* ─── HIBP (Have I Been Pwned) — optional, free API key ─── */

async function checkHibp(identifier) {
  const key = process.env.HIBP_API_KEY;
  if (!key) return [];
  try {
    const email = normalizeIdentifier(identifier);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && !/^(log|kno|ln)\./.test(email)) return [];
    const resp = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}`, {
      headers: {
        'accept': 'application/json',
        'hibp-api-key': key,
        'user-agent': 'Enclave-Account-Shield/1.0',
      },
      signal: AbortSignal.timeout(12000),
    });
    if (resp.status === 404) return [];
    if (!resp.ok) return [];
    const breaches = await resp.json().catch(() => []);
    return Array.isArray(breaches) ? breaches : [];
  } catch (e) {
    console.warn('[AccountShield] HIBP check failed:', e.message);
    return [];
  }
}

/* ─── Core account ops ─── */

async function addAccount(userId, { site, identifier, label }) {
  if (!validSite(site)) throw new Error('Invalid site. Choose from: ' + SITES.join(', '));
  const clean = normalizeIdentifier(identifier);
  if (!clean) throw new Error('Identifier (email/username) is required');
  const tbl = await table('account_watchlist');
  const existing = await tbl.find({ user_id: userId, identifier: clean, site: site.toLowerCase() });
  if (existing) return existing;

  const now = new Date().toISOString();
  const row = {
    id: uuidv4(),
    user_id: userId,
    site: site.toLowerCase(),
    identifier: clean,
    label: label || null,
    status: 'monitoring',
    last_checked_at: null,
    last_result: 'pending',
    security_score: 100,
    created_at: now,
    updated_at: now,
  };
  await tbl.create(row);
  return row;
}

async function listAccounts(userId) {
  const tbl = await table('account_watchlist');
  const rows = await tbl.filter({ user_id: userId });
  return rows.sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
}

async function removeAccount(userId, accountId) {
  const tbl = await table('account_watchlist');
  await tbl.remove({ id: accountId, user_id: userId });
  const breachTbl = await table('account_breaches');
  await breachTbl.remove({ account_id: accountId, user_id: userId });
  return { removed: true };
}

async function scanAccount(userId, accountId) {
  const tbl = await table('account_watchlist');
  const account = await tbl.find({ id: accountId, user_id: userId });
  if (!account) throw new Error('Account not found');

  const logTbl = await table('account_scan_logs');
  const breachTbl = await table('account_breaches');

  const scanId = uuidv4();
  const started = new Date().toISOString();
  await logTbl.create({
    id: scanId, user_id: userId, account_id: accountId,
    sources: '{}', findings: 0, started_at: started, status: 'running',
  });

  const { findings, checked } = await runSourceChecks(account.identifier);
  let hibpCount = 0;
  try {
    const hibp = await checkHibp(account.identifier);
    hibpCount = hibp.length;
  } catch (_) { /* handled */ }

  const seen = await breachTbl.filter({ account_id: accountId });
  const known = new Set(seen.map((b) => (b.indicator || '') + '|' + b.type));

  let newCount = 0;
  for (const f of findings) {
    const key = (f.indicator || '') + '|' + f.type;
    if (known.has(key)) continue;
    known.add(key);
    await breachTbl.create({
      id: uuidv4(), user_id: userId, account_id: accountId,
      source: f.source, type: f.type, indicator: f.indicator || null,
      headline: f.headline, detail: f.detail,
      severity: f.severity || 'medium', status: 'new',
      first_seen: new Date().toISOString(), created_at: new Date().toISOString(),
    });
    newCount++;
  }

  if (hibpCount > 0 && !known.has(`hibp:${account.identifier}|hibp_breach`)) {
    known.add(`hibp:${account.identifier}|hibp_breach`);
    await breachTbl.create({
      id: uuidv4(), user_id: userId, account_id: accountId,
      source: 'hibp', type: 'hibp_breach',
      indicator: account.identifier,
      headline: 'Account appears in known breaches',
      detail: `${account.identifier} was found in ${hibpCount} documented breach(es) via Have I Been Pwned.`,
      severity: 'high', status: 'new',
      first_seen: new Date().toISOString(), created_at: new Date().toISOString(),
    });
    newCount++;
  }

  // Compute score: start 100, drop per severity.
  const allFindings = await breachTbl.filter({ account_id: accountId });
  let score = 100;
  for (const b of allFindings) {
    if (b.status === 'resolved') continue;
    if (b.severity === 'critical') score -= 35;
    else if (b.severity === 'high') score -= 20;
    else if (b.severity === 'medium') score -= 10;
    else score -= 5;
  }
  score = Math.max(0, score);

  const finished = new Date().toISOString();
  await logTbl.update({ id: scanId }, {
    sources: JSON.stringify(checked), findings: allFindings.length,
    finished_at: finished, status: 'complete',
  });

  await tbl.update({ id: accountId }, {
    last_checked_at: finished,
    last_result: newCount > 0 ? 'issues_found' : 'clean',
    security_score: score,
    updated_at: finished,
  });

  if (newCount > 0) await notifyBreachReminder(userId, account, newCount);

  return {
    accountId,
    newFindings: newCount,
    totalFindings: allFindings.length,
    score,
    sources: checked,
    finished_at: finished,
  };
}

async function listBreaches(userId, accountId) {
  const tbl = await table('account_breaches');
  const rows = await tbl.filter({ user_id: userId });
  const list = accountId ? rows.filter((r) => r.account_id === accountId) : rows;
  return list.sort((a, b) => ((b.created_at || '') > (a.created_at || '') ? 1 : -1));
}

async function resolveBreach(userId, breachId) {
  const tbl = await table('account_breaches');
  const found = await tbl.find({ id: breachId, user_id: userId });
  if (!found) throw new Error('Breach not found');
  await tbl.update({ id: breachId }, { status: 'resolved', updated_at: new Date().toISOString() });
  return { resolved: true };
}

async function accountSummary(userId) {
  const accounts = await listAccounts(userId);
  const breaches = await listBreaches(userId);
  const open = breaches.filter((b) => b.status !== 'resolved');
  const avgScore = accounts.length
    ? Math.round(accounts.reduce((s, a) => s + (a.security_score ?? 0), 0) / accounts.length)
    : 100;

  return {
    accounts: accounts.length,
    watched: accounts.length,
    openBreaches: open.length,
    totalBreaches: breaches.length,
    securityScore: avgScore,
    status: open.length > 0 ? 'attention' : (accounts.length ? 'protected' : 'empty'),
  };
}

async function notifyBreachReminder(userId, account, count) {
  try {
    const notify = require('./notifications');
    const usersTable = await table('users');
    const user = await usersTable.find({ id: userId });
    if (!user || !user.email) return;

    const detail = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <div style="background:linear-gradient(135deg,#050507,#0D0E12);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:28px;text-align:center;">
          <div style="font-size:44px;margin-bottom:12px;">&#128737;&#65039;</div>
          <h2 style="color:#f4f6fb;font-size:22px;margin:0 0 6px;">Account vulnerability detected</h2>
          <p style="color:#9aa0b5;font-size:14px;margin:0 0 18px;">
            <strong style="color:#FF3366;">${count} new finding(s)</strong> for your ${account.site} account
            (<span style="color:#00F2FE;">${account.identifier}</span>).
          </p>
          <p style="color:#f4f6fb;font-size:14px;background:#121318;border:1px solid rgba(255,255,255,0.08);padding:12px;border-radius:10px;margin:0 0 18px;">
            Recommended: rotate your password, enable 2-factor authentication, and review active sessions on that account.
          </p>
        </div>
      </div>`;
    await notify.sendEmail(user.email, `Enclave — ${account.site} account alerts`, detail);
  } catch (e) {
    console.warn('[AccountShield] alert email failed:', e.message);
  }
}

async function runAutoSweep(userId) {
  const accounts = await listAccounts(userId);
  const results = [];
  for (const a of accounts) {
    const stale = !a.last_checked_at || (Date.now() - new Date(a.last_checked_at).getTime() > 24 * 3600 * 1000);
    if (stale) {
      try { results.push(await scanAccount(userId, a.id)); } catch (e) { results.push({ accountId: a.id, error: e.message }); }
    }
  }
  return results;
}

module.exports = {
  SITES,
  addAccount,
  listAccounts,
  removeAccount,
  scanAccount,
  listBreaches,
  resolveBreach,
  accountSummary,
  runAutoSweep,
  runSourceChecks,
};