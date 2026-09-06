/* ─── Account Shield Service ───
 * Anti-hacker protection for the accounts a user cares about
 * (email, Google, bank, games, etc.).
 *
 * Barrier model: beyond passive monitoring, the shield actively
 * blocks weak / reused / breached credentials at the gate, tracks
 * account hardening (MFA, rotation), and escalates into a lockdown
 * playbook when a breach is detected.
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
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

/* ─── Credential barrier (encrypted at rest) ───
 * Passwords are never stored in plaintext: AES-256-GCM with a key
 * derived from a dedicated env secret (SHIELD_KEY), falling back to a
 * JWT_SECRET-derived key so local / demo deployments just work.
 */

function barrierKey() {
  const secret = process.env.SHIELD_KEY || process.env.JWT_SECRET || 'enclave-shield-dev';
  return crypto.createHash('sha256').update('enclave:shield:v1:' + secret).digest();
}

function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', barrierKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return 'v1:' + iv.toString('base64') + ':' + tag.toString('base64') + ':' + enc.toString('base64');
}

function decryptSecret(token) {
  if (typeof token !== 'string' || !token.startsWith('v1:')) return null;
  const [_, ivB64, tagB64, encB64] = token.split(':');
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', barrierKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(encB64, 'base64')), decipher.final()]).toString('utf8');
  } catch (e) {
    return null;
  }
}

function sha256Hex(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex');
}

/* ─── Pwned password gate (HIBP k-anonymity range API, free, no key) ───
 * Only the first 5 chars of the SHA-1 hash ever leave the server.
 * Returns number of breaches the candidate password appears in.
 */

const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/';

async function pwnedPasswordCount(password) {
  const sha1 = crypto.createHash('sha1').update(String(password)).digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const resp = await fetch(HIBP_RANGE_URL + prefix, {
      headers: { 'user-agent': 'Enclave-Account-Shield/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return 0;
    const body = await resp.text();
    for (const line of body.split(/\r?\n/)) {
      const [cand, count] = line.split(':');
      if (cand && cand.toUpperCase() === suffix) return parseInt(count || '0', 10) || 0;
    }
    return 0;
  } catch (e) {
    console.warn('[AccountShield] pwned-range check failed:', e.message);
    return 0;
  }
}

/* Strength: length + charset diversity, score 0-4. */
function passwordStrength(password) {
  const pw = String(password || '');
  let score = 0;
  if (pw.length >= 12) score += 2;
  else if (pw.length >= 8) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 0.5;
  if (/[^A-Za-z0-9]/.test(pw)) score += 0.5;
  return Math.min(4, Math.floor(score));
}

function passwordFeedback(pw) {
  const msg = [];
  if (String(pw).length < 12) msg.push('Use at least 12 characters');
  if (!/(?=.*[a-z])(?=.*[A-Z])/.test(pw)) msg.push('Mix upper and lower case');
  if (!/\d/.test(pw)) msg.push('Add at least one number');
  if (!/[^A-Za-z0-9]/.test(pw)) msg.push('Add at least one symbol');
  return msg.length ? msg : ['Strong password'];
}

/* Derive wall state for an account from its defensive fields. */
function wallState(account) {
  if (account.pwned_count > 0) return 'breached';
  if (!account.credential_enc) return 'open';
  if (account.wall_escalated) return 'breached';
  const lacksMfa = !account.mfa_enabled;
  const weak = (account.strength_score ?? 0) < 3;
  let stale = false;
  if (account.password_set_at) {
    const days = (Date.now() - new Date(account.password_set_at).getTime()) / 86400000;
    stale = days > 90;
  }
  if (lacksMfa || weak || stale) return 'at_risk';
  return 'fortified';
}

const WALL_COPY = {
  fortified: { label: 'Fortified', tone: 'green' },
  at_risk: { label: 'At risk', tone: 'amber' },
  breached: { label: 'Breached', tone: 'red' },
  open: { label: 'Open', tone: 'cue' },
};

/* ─── Lockdown playbooks (official provider recovery lanes) ─── */

const PLAYBOOKS = {
  google: {
    title: 'Google / Gmail lockdown',
    steps: [
      'Go to myaccount.google.com/security and open "Security checkup".',
      'Sign out every other session, then remove unknown devices/sessions.',
      'Change your password and remove recovery phone numbers or emails you do not recognise.',
      'Enable 2-Step Verification and use a passkey or authenticator app.',
      'For full recovery use accounts.google.com/recovery if you lose access.',
    ],
    links: [
      ['Google Security Checkup', 'https://myaccount.google.com/security'],
      ['Google Account Recovery', 'https://accounts.google.com/recovery'],
    ],
  },
  bank: {
    title: 'Banking lockdown',
    steps: [
      'Call your bank immediately using the number on the back of your card and freeze the account.',
      'Ask them to place a fraud alert and revoke all active sessions/devices.',
      'Change your online banking PIN/password while on the call.',
      'Review recent transactions and dispute anything you do not recognise.',
      'Enable push-based 2FA (authenticator app, not SMS) if offered.',
    ],
    links: [
      ['Federal Trade Commission — IdentityTheft.gov', 'https://www.identitytheft.gov'],
      ['Equifax / Experian / TransUnion fraud alerts', 'https://www.consumer.ftc.gov/articles/free-credit-reports'],
    ],
  },
  'credit-card': {
    title: 'Credit card lockdown',
    steps: [
      'Call the number on the back of your card and lock the card immediately.',
      'Request a replacement with a new card number.',
      'Set transaction alerts so every charge pings your phone.',
      'Pull your credit report from Equifax, Experian and TransUnion and look for new accounts.',
      'Place a credit freeze if you see unfamiliar inquiries.',
    ],
    links: [
      ['IdentityTheft.gov', 'https://www.identitytheft.gov'],
      ['Annual Credit Report', 'https://www.annualcreditreport.com'],
    ],
  },
  steam: {
    title: 'Steam lockdown',
    steps: [
      'Sign out of Steam everywhere (Steam > Settings > Devices/Authorizations).',
      'Change your password and remove all backup codes you did not create.',
      'Enable Steam Guard mobile authenticator.',
      'Revoke API keys at steamcommunity.com/dev/apikey if you do not recognise them.',
      'Contact Steam Support for recovery help if trades or purchases look fraudulent.',
    ],
    links: [
      ['Steam Account Security', 'https://store.steampowered.com/account'],
      ['Steam Support Account Recovery', 'https://help.steampowered.com'],
    ],
  },
};

function playbookFor(site) {
  return PLAYBOOKS[site] || {
    title: `${site} account lockdown`,
    steps: [
      'Change your password to a new, unique one and sign out of all other sessions.',
      'Enable two-factor / 2FA wherever the service offers it.',
      'Revoke unknown devices, tokens and third-party app access.',
      'Remove any recovery email/phone you do not recognise.',
      'Review recent activity and report anything unfamiliar to the service provider.',
    ],
    links: [
      ['Service security settings', 'https://support.microsoft.com'],
    ],
  };
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
  rows.sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
  return rows.map((r) => ({ ...r, wall: wallState(r), credential_enc: !!r.credential_enc }));
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
    wall_escalated: newCount > 0 ? true : false,
    updated_at: finished,
  });

  if (newCount > 0) await notifyBreachReminder(userId, account, newCount);

  const updated = await tbl.find({ id: accountId });
  return {
    accountId,
    newFindings: newCount,
    totalFindings: allFindings.length,
    score,
    sources: checked,
    wall: updated ? wallState(updated) : wallState(account),
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

  const walls = { fortified: 0, at_risk: 0, breached: 0, open: 0 };
  for (const a of accounts) walls[a.wall] = (walls[a.wall] || 0) + 1;

  return {
    accounts: accounts.length,
    watched: accounts.length,
    openBreaches: open.length,
    totalBreaches: breaches.length,
    securityScore: avgScore,
    status: open.length > 0 ? 'attention' : (accounts.length ? 'protected' : 'empty'),
    walls,
    lockdowns: accounts.filter((a) => a.last_lockdown_at).length,
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

/* ─── Credential barrier: set / check / harden ─── */

async function setCredential(userId, accountId, { password, mfaEnabled }) {
  const tbl = await table('account_watchlist');
  const account = await tbl.find({ id: accountId, user_id: userId });
  if (!account) throw new Error('Account not found');

  const pw = String(password || '');
  if (pw.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  // Barrier gate 1 — must not already be used on another watched account.
  const mine = await tbl.filter({ user_id: userId });
  for (const other of mine) {
    if (other.id === accountId || !other.credential_enc) continue;
    const otherPw = decryptSecret(other.credential_enc);
    if (otherPw === pw) {
      throw new Error('This password is already in use on another watched account — reuse is what gets accounts hacked');
    }
  }

  // Barrier gate 2 — known-breached password check (HIBP k-anonymity).
  const pwned = await pwnedPasswordCount(pw);
  if (pwned > 0) {
    throw new Error(`This password appeared in ${pwned.toLocaleString()} data breaches — we will not let you use it`);
  }

  // Barrier gate 3 — strength floor.
  const strength = passwordStrength(pw);
  if (strength < 3) {
    throw new Error('Password too weak: ' + passwordFeedback(pw).join('; '));
  }

  const now = new Date().toISOString();
  await tbl.update({ id: accountId }, {
    credential_enc: encryptSecret(pw),
    pwned_count: pwned,
    strength_score: strength,
    mfa_enabled: mfaEnabled === true,
    password_set_at: now,
    credential_checked_at: now,
    updated_at: now,
  });

  const updated = await tbl.find({ id: accountId });
  return credentialStatus(updated);
}

async function credentialStatus(account) {
  const enc = !!account.credential_enc;
  let stale = null;
  if (account.password_set_at) {
    const days = Math.floor((Date.now() - new Date(account.password_set_at).getTime()) / 86400000);
    if (days > 90) stale = days;
  }
  return {
    fortified: account.pwned_count === 0 && enc && (account.strength_score ?? 0) >= 3 &&
      account.mfa_enabled && !stale,
    password_set: enc,
    password_strength: account.strength_score ?? 0,
    pwned_count: account.pwned_count ?? 0,
    mfa_enabled: account.mfa_enabled === true,
    rotation_stale_days: stale,
    wall: wallState(account),
    checked_at: account.credential_checked_at || null,
  };
}

async function getCredentialStatus(userId, accountId) {
  const tbl = await table('account_watchlist');
  const account = await tbl.find({ id: accountId, user_id: userId });
  if (!account) throw new Error('Account not found');
  return credentialStatus(account);
}

/* Re-run the pwned-password check for stored credentials (auto-sweep).
 * If a credential has since appeared in a breach, surface a finding. */
async function recheckCredentials(userId) {
  const tbl = await table('account_watchlist');
  const breachTbl = await table('account_breaches');
  const mine = await tbl.filter({ user_id: userId });
  const results = [];

  for (const account of mine) {
    if (!account.credential_enc) continue;
    const pw = decryptSecret(account.credential_enc);
    const pwned = await pwnedPasswordCount(pw);
    if (pwned <= account.pwned_count) continue;

    await tbl.update({ id: account.id }, {
      pwned_count: pwned,
      credential_checked_at: new Date().toISOString(),
      wall_escalated: true,
      updated_at: new Date().toISOString(),
    });

    await breachTbl.create({
      id: uuidv4(), user_id: userId, account_id: account.id,
      source: 'hibp_passwords', type: 'credential_in_breach',
      indicator: account.identifier,
      headline: `Stored credential for ${account.site} now appears in breaches`,
      detail: `The saved password for ${account.identifier} was found in ${pwned.toLocaleString()} breach(es). Attackers already have it. Rotate immediately.`,
      severity: 'critical', status: 'new',
      first_seen: new Date().toISOString(), created_at: new Date().toISOString(),
    });
    results.push({ accountId: account.id, pwned });
  }
  return results;
}

/* ─── Lockdown: escalate a suspected breach into a recovery playbook ─── */

async function lockdownAccount(userId, accountId) {
  const tbl = await table('account_watchlist');
  const account = await tbl.find({ id: accountId, user_id: userId });
  if (!account) throw new Error('Account not found');

  const pb = playbookFor(account.site);
  const now = new Date().toISOString();
  const record = {
    id: uuidv4(),
    user_id: userId,
    account_id: accountId,
    site: account.site,
    identifier: account.identifier,
    playbook: JSON.stringify({ ...pb, triggered_at: now }),
    created_at: now,
    status: 'active',
  };
  const ldTbl = await table('account_lockdowns');
  await ldTbl.create(record);

  await tbl.update({ id: accountId }, {
    wall_escalated: true,
    last_lockdown_at: now,
    updated_at: now,
  });

  await notifyLockdownEmail(userId, account, pb);
  return { ...record, playbook: JSON.parse(record.playbook) };
}

async function listLockdowns(userId) {
  const tbl = await table('account_lockdowns');
  const rows = await tbl.filter({ user_id: userId });
  return rows
    .sort((a, b) => ((b.created_at || '') > (a.created_at || '') ? 1 : -1))
    .map((r) => {
      let playbook;
      try { playbook = JSON.parse(r.playbook); } catch (_) { playbook = null; }
      return { ...r, playbook };
    });
}

async function completeLockdown(userId, lockdownId) {
  const tbl = await table('account_lockdowns');
  const found = await tbl.find({ id: lockdownId, user_id: userId });
  if (!found) throw new Error('Lockdown record not found');
  await tbl.update({ id: lockdownId }, { status: 'completed', updated_at: new Date().toISOString() });
  return { completed: true };
}

async function notifyLockdownEmail(userId, account, pb) {
  try {
    const notify = require('./notifications');
    const usersTable = await table('users');
    const user = await usersTable.find({ id: userId });
    if (!user || !user.email) return;

    const steps = (pb.steps || []).map((s, i) =>
      `<li style="margin:6px 0;color:#9aa0b5;">${i + 1}. ${s}</li>`).join('');
    const links = (pb.links || []).map(([label, href]) =>
      `<a href="${href}" style="display:inline-block;margin:4px;padding:8px 14px;border-radius:8px;background:#121318;border:1px solid rgba(255,255,255,0.1);color:#05F2C7;text-decoration:none;font-size:13px;">${label}</a>`).join('');

    const detail = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <div style="background:linear-gradient(135deg,#050507,#0D0E12);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:28px;">
          <div style="font-size:44px;margin-bottom:12px;">&#128308;</div>
          <h2 style="color:#f4f6fb;font-size:22px;margin:0 0 4px;">Lockdown initiated</h2>
          <p style="color:#9aa0b5;font-size:14px;margin:0 0 18px;">
            ${pb.title} for <span style="color:#00F2FE;">${account.identifier}</span>.
            Follow these steps now to take back control.
          </p>
          <ol style="text-align:left;font-size:14px;padding-left:4px;margin:0 0 18px;">${steps}</ol>
          <div style="text-align:center;">${links}</div>
        </div>
      </div>`;
    await notify.sendEmail(user.email, `Enclave — Lockdown: ${pb.title}`, detail);
  } catch (e) {
    console.warn('[AccountShield] lockdown email failed:', e.message);
  }
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
  setCredential,
  getCredentialStatus,
  recheckCredentials,
  lockdownAccount,
  listLockdowns,
  completeLockdown,
  wallState,
  WALL_COPY,
};