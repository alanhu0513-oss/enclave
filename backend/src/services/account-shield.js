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

/* ─── Barrier Intelligence engine ───
 * Beyond passive monitoring, the shield models the *attacker's path*:
 * it builds a reuse graph across watched accounts (shared passwords and
 * shared identifiers), computes an exploitability score per account, and
 * when one credential is breached it propagates a blast-radius warning to
 * every account it can reach. This is the kill-chain view that password
 * managers and HIBP-style tools do not provide.
 */

// Monetary / access value of an account if it falls to an attacker.
// Weighted so the weakest link is surfaced by real-world impact, not just
// by password strength alone.
const ACCOUNT_VALUE = {
  bank: 100, 'credit-card': 100, gmail: 90, google: 85, work: 85, paypal: 80,
  crypto: 75, twitter: 65, steam: 60, playstation: 55, xbox: 55, discord: 50,
  epic: 50, nintendo: 45, roblox: 40, instagram: 70, facebook: 70, other: 40,
};

function accountValue(site) {
  return ACCOUNT_VALUE[site] || 40;
}

function isBreached(account, breachesByAccount) {
  if ((account.pwned_count || 0) > 0) return true;
  const list = breachesByAccount.get(account.id);
  if (!list) return false;
  // Blast-radius warnings describe exposure through a *linked* account, not a
  // confirmed compromise of this account's own credentials — so they do not
  // elevate the wall to breached.
  return list.some((b) => b.status !== 'resolved' && b.type !== 'blast_radius');
}

/* Pure, deterministic analysis over the accounts a user is defending.
 * Both listAccounts and getIntelligence share this so the UI, offender
 * model, and cleanup workflows agree on the same picture.
 */
function analyzeAccounts(accounts, breaches) {
  const breachesByAccount = new Map();
  for (const b of breaches) {
    if (!breachesByAccount.has(b.account_id)) breachesByAccount.set(b.account_id, []);
    breachesByAccount.get(b.account_id).push(b);
  }

  // Reuse index: normalized identifiers and SHA-256(password) buckets.
  const idIndex = new Map();
  const pwIndex = new Map();
  for (const a of accounts) {
    if (a.identifier) {
      if (!idIndex.has(a.identifier)) idIndex.set(a.identifier, []);
      idIndex.get(a.identifier).push(a.id);
    }
    if (a.credential_enc) {
      const pw = decryptSecret(a.credential_enc);
      if (pw) {
        const h = sha256Hex('pw:' + pw);
        if (!pwIndex.has(h)) pwIndex.set(h, []);
        pwIndex.get(h).push(a.id);
      }
    }
  }

  const byId = new Map(accounts.map((a) => [a.id, a]));
  const byAccount = new Map();
  const graphEdges = [];
  const seenPairs = new Set();

  for (const a of accounts) {
    const pw = a.credential_enc ? decryptSecret(a.credential_enc) : null;
    const password_with = (pw ? pwIndex.get(sha256Hex('pw:' + pw)) : [])
      .filter((oid) => oid !== a.id);
    const identifier_with = ((idIndex.get(a.identifier) || [])).filter((oid) => oid !== a.id);

    const selfBreached = isBreached(a, breachesByAccount);
    const contaminatedVia = [];
    const linked = [...new Set([...password_with, ...identifier_with])];
    for (const lid of linked) {
      const other = byId.get(lid);
      if (other && isBreached(other, breachesByAccount)) {
        contaminatedVia.push({
          accountId: lid,
          site: other.site,
          identifier: other.identifier,
          reason: password_with.includes(lid) ? 'password' : 'identity',
        });
      }
    }

    const contaminated = [];
    const seen = new Set();
    for (const v of contaminatedVia) {
      if (seen.has(v.accountId)) continue;
      seen.add(v.accountId);
      contaminated.push(v);
    }

    byAccount.set(a.id, {
      self_breached: selfBreached,
      password_reused: password_with.length > 0,
      password_with,
      identifier_shared: identifier_with.length > 0,
      identifier_with,
      contaminated,
      exploitation: exploitabilityOf(a, {
        selfBreached,
        pwReused: password_with.length > 0,
        idShared: identifier_with.length > 0,
        contaminated: contaminated.length > 0,
      }),
    });
  }

  for (const a of accounts) {
    const info = byAccount.get(a.id);
    for (const oid of [...info.password_with, ...info.identifier_with]) {
      const pair = a.id < oid ? a.id + '|' + oid : oid + '|' + a.id;
      if (seenPairs.has(pair)) continue;
      seenPairs.add(pair);
      const reason = info.password_with.includes(oid) ? 'password' : 'identity';
      graphEdges.push({ source: a.id, target: oid, reason });
    }
  }

  return { byAccount, graphEdges };
}

function exploitabilityOf(account, { selfBreached, pwReused, idShared, contaminated }) {
  let score = 0;
  const reasons = [];
  const hasCred = !!account.credential_enc;

  if (selfBreached) { score += 45; reasons.push('Breached credentials are already in the wild'); }
  if ((account.pwned_count || 0) > 0) { score += (account.pwned_count || 0) > 10 ? 20 : 12; }
  if (!hasCred) { score += 25; reasons.push('No credential stored — defense posture unknown'); }
  else if ((account.strength_score || 0) < 3) { score += 12; reasons.push('Stored password is weak'); }
  if (!account.mfa_enabled) { score += 15; reasons.push('No 2FA — a single leaked password unlocks the account'); }
  if (pwReused) { score += 15; reasons.push('Password is reused across accounts'); }
  if (contaminated) { score += 20; reasons.push('Linked to a breached account — blast radius exposure'); }
  if (idShared) { score += 5; reasons.push('Identity used on multiple accounts'); }
  if (!selfBreached && (account.pwned_count || 0) > 0) { /* counted above */ }

  // Recent lockdown/hardening lowers exploitability: the attacker path was
  // already walked once and the credential was rolled.
  if (account.last_lockdown_at && !selfBreached) { score = Math.max(0, score - 10); }

  score = Math.min(100, Math.round(score));
  const risk_band = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';

  const attack_steps = [];
  if (selfBreached) attack_steps.push('Obtain the leaked credential from a public breach corpus');
  if (pwReused && (selfBreached || contaminated)) {
    attack_steps.push('Replay that credential against linked accounts sharing the same password');
  }
  if (idShared && (selfBreached || contaminated)) {
    attack_steps.push('Use the shared email/username to pivot via password-reset recovery lanes');
  }
  if (!account.mfa_enabled && hasCred) {
    attack_steps.push('Autonomously authenticate — MFA is absent, so a single secret is enough');
  }
  if (attack_steps.length === 0 && contaminated) {
    attack_steps.push('Exploit the leaked password or recovery email to reach this account');
  }
  if (attack_steps.length === 0 && !hasCred) {
    attack_steps.push('Attempt credential stuffing with the leaked value against this account');
  }
  if (attack_steps.length === 0) {
    attack_steps.push('No viable attacker path identified from current data');
  }

  return {
    score,
    risk_band,
    value: accountValue(account.site),
    blast_radius: contaminated,
    summary: reasons.length ? reasons[0] : 'No known exploitable path',
    attack_steps,
  };
}

// Merge analysis into a single account's wall state: a compromised wall
// stays breached; anything touched by blast radius drops to at-risk.
function analyzedWall(account, info) {
  const base = wallState(account);
  if (base === 'breached') return 'breached';
  if (info.self_breached) return 'breached';
  if (info.contaminated.length > 0) return 'at_risk';
  return base;
}

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

/* ─── Per-account hardening checklist ───
 * Ten defensive steps that make up a fortified wall. Each is evaluated
 * against live account state — including blast-radius analysis — so the UI
 * can show exactly what is left to do.
 */

function checklistFor(account, openFindings = 0, info = {}) {
  const hasCred = !!account.credential_enc;
  const strong = (account.strength_score ?? 0) >= 3;
  const pwned = (account.pwned_count ?? 0) > 0;
  const mfa = account.mfa_enabled === true;
  let stale = false;
  if (account.password_set_at) {
    const days = (Date.now() - new Date(account.password_set_at).getTime()) / 86400000;
    stale = days > 90;
  }
  const monitored = !!account.last_checked_at && account.last_result !== 'pending';
  const noOpen = openFindings === 0;
  const reused = !!info.password_reused;
  const contaminatedNow = !!(info.contaminated && info.contaminated.length);
  let recent = false;
  if (account.last_checked_at) {
    recent = (Date.now() - new Date(account.last_checked_at).getTime()) < 7 * 86400000;
  }

  return [
    { key: 'credential', label: 'Store the account password in the vault', met: hasCred, weight: 2 },
    { key: 'strong_password', label: 'Use a strong, unique password', met: hasCred && strong, weight: 2 },
    { key: 'not_in_breach', label: 'Password is not in known breach corpora', met: hasCred && !pwned, weight: 3 },
    { key: 'mfa', label: 'Enable two-factor authentication', met: mfa, weight: 2 },
    { key: 'fresh_rotation', label: 'Rotate the password within 90 days', met: hasCred && !stale, weight: 1 },
    { key: 'monitored', label: 'Dark-web and leak sweep has run', met: monitored, weight: 1 },
    { key: 'no_open_findings', label: 'No unresolved breach findings', met: noOpen, weight: 2 },
    { key: 'no_reuse', label: 'Avoid password reuse across accounts', met: !reused, weight: 2 },
    { key: 'no_contamination', label: 'Not exposed via linked breached accounts', met: !contaminatedNow, weight: 2 },
    { key: 'recent_sweep', label: 'Dark-web sweep within the last 7 days', met: recent, weight: 1 },
  ];
}

function getSiteGuide(site) {
  return playbookFor(site);
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
  const breaches = await listBreaches(userId);
  const analysis = analyzeAccounts(rows, breaches);
  const openByAccount = {};
  for (const b of breaches) {
    if (b.status !== 'resolved') openByAccount[b.account_id] = (openByAccount[b.account_id] || 0) + 1;
  }
  return rows.map((r) => {
    const info = analysis.byAccount.get(r.id) || {
      self_breached: false, contaminated: [], password_reused: false,
      identifier_shared: false, password_with: [], identifier_with: [],
    };
    return {
      ...r,
      credential_enc: !!r.credential_enc,
      wall: analyzedWall(r, info),
      exploitability: info.exploitation,
      reuse: {
        password_reused: info.password_reused,
        password_with: info.password_with,
        identifier_shared: info.identifier_shared,
        identifier_with: info.identifier_with,
      },
      contamination: info.contaminated,
      checklist: checklistFor(r, openByAccount[r.id] || 0, info),
    };
  });
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

  if (newCount > 0) {
    // Kill-chain: any account sharing this identity/password is now at risk.
    await propagateContamination(userId, accountId);
    await notifyBreachReminder(userId, account, newCount);
  }

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

  const blast = accounts.filter((a) => (a.contamination || []).length > 0);
  const exposure = { high: 0, medium: 0, low: 0 };
  for (const a of accounts) {
    const band = a.exploitability?.risk_band;
    if (band) exposure[band] = (exposure[band] || 0) + 1;
  }
  const highest = [...accounts].sort(
    (x, y) => (y.exploitability?.score || 0) - (x.exploitability?.score || 0),
  )[0] || null;

  return {
    accounts: accounts.length,
    watched: accounts.length,
    openBreaches: open.length,
    totalBreaches: breaches.length,
    securityScore: avgScore,
    status: open.length > 0 ? 'attention' : (accounts.length ? 'protected' : 'empty'),
    walls,
    lockdowns: accounts.filter((a) => a.last_lockdown_at).length,
    intelligence: {
      blast_radius: blast.length,
      exposed: accounts.filter((a) => a.wall === 'breached' || a.wall === 'at_risk').length,
      exposure,
      weakest: highest ? {
        id: highest.id,
        site: highest.site,
        identifier: highest.identifier,
        score: highest.exploitability?.score ?? 0,
        band: highest.exploitability?.risk_band ?? 'low',
      } : null,
    },
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

async function credentialStatus(account, openFindings = 0, info = {}) {
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
    checklist: checklistFor(account, openFindings, info),
  };
}

async function getCredentialStatus(userId, accountId) {
  const tbl = await table('account_watchlist');
  const account = await tbl.find({ id: accountId, user_id: userId });
  if (!account) throw new Error('Account not found');
  const breachTbl = await table('account_breaches');
  const open = await breachTbl.filter({ account_id: accountId });
  const openFindings = open.filter((b) => b.status !== 'resolved').length;
  const all = await tbl.filter({ user_id: userId });
  const breaches = await listBreaches(userId);
  const info = analyzeAccounts(all, breaches).byAccount.get(accountId) || {};
  return credentialStatus(account, openFindings, info);
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

  if (results.length > 0) {
    await propagateContamination(userId, results.map((r) => r.accountId));
  }
  return results;
}

/* ─── Blast radius: propagate a confirmed breach to linked accounts ───
 * Once a credential is confirmed pwned, every watched account that shares
 * a password or identity with it becomes a contamination target. This is
 * the piece password managers lack: they flag the single account; we flag
 * the whole graph an attacker can chain through.
 */
async function propagateContamination(userId, breachedAccountIds) {
  const list = Array.isArray(breachedAccountIds) ? breachedAccountIds : [breachedAccountIds];
  const tbl = await table('account_watchlist');
  const breachTbl = await table('account_breaches');
  const accounts = await tbl.filter({ user_id: userId });
  const breaches = await listBreaches(userId);
  const analysis = analyzeAccounts(accounts, breaches);
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const existing = await breachTbl.filter({ user_id: userId });
  const known = new Set(existing.map((b) => (b.indicator || '') + '|' + b.type));
  const now = new Date().toISOString();
  let propagated = 0;

  for (const breachedId of list) {
    const src = byId.get(breachedId);
    if (!src) continue;
    for (const a of accounts) {
      if (a.id === breachedId) continue;
      const info = analysis.byAccount.get(a.id);
      const link = info && info.contaminated.find((c) => c.accountId === breachedId);
      if (!link) continue;
      const key = `blast:${breachedId}|blast_radius`;
      if (known.has(key)) continue;
      known.add(key);
      await breachTbl.create({
        id: uuidv4(), user_id: userId, account_id: a.id,
        source: 'blast_radius', type: 'blast_radius',
        indicator: breachedId,
        headline: `Compromise of ${src.site} exposes ${a.site}`,
        detail: `${src.identifier} shared a ${link.reason} with ${a.identifier}. Attackers who reach the breached credential now have a path into this account. Rotate the shared secret and change the recovery email.`,
        severity: 'high', status: 'new',
        first_seen: now, created_at: now,
      });
      // Blast exposure drops the victim wall to at-risk (via analysis) but
      // is not the same as a confirmed credential compromise, which is what
      // wall_escalated stands for.
      propagated++;
    }
  }
  return { propagated };
}

/* ─── Contain all: escalate every breached / at-risk account at once ─── */

async function containAll(userId) {
  const tbl = await table('account_watchlist');
  const ldTbl = await table('account_lockdowns');
  const accounts = await listAccounts(userId);
  const targets = accounts.filter((a) => a.wall === 'breached' || a.wall === 'at_risk');
  const active = await listLockdowns(userId);
  const activeByAccount = new Set(active.filter((l) => l.status === 'active').map((l) => l.account_id));
  const now = new Date().toISOString();
  const initiated = [];
  const already = [];

  for (const a of targets) {
    const pb = playbookFor(a.site);
    const record = {
      id: uuidv4(),
      user_id: userId,
      account_id: a.id,
      site: a.site,
      identifier: a.identifier,
      playbook: JSON.stringify({ ...pb, triggered_at: now, source: 'contain_all' }),
      created_at: now,
      status: 'active',
    };
    if (activeByAccount.has(a.id)) { already.push(a.id); continue; }
    await ldTbl.create(record);
    activeByAccount.add(a.id);
    initiated.push({ id: record.id, site: a.site, identifier: a.identifier, reason: a.wall, playbook: pb });
    await tbl.update({ id: a.id }, { wall_escalated: true, last_lockdown_at: now, updated_at: now });
  }

  if (initiated.length > 0) await notifyContainAllEmail(userId, initiated, already);
  return { initiated, alreadyActive: already, totalTargets: targets.length };
}

/* ─── Intelligence snapshot (offender model + contamination graph) ─── */

async function getIntelligence(userId) {
  const tbl = await table('account_watchlist');
  const rows = await tbl.filter({ user_id: userId });
  const breaches = await listBreaches(userId);
  const analysis = analyzeAccounts(rows, breaches);
  const byId = new Map(rows.map((a) => [a.id, a]));

  const accounts = rows.map((r) => {
    const info = analysis.byAccount.get(r.id);
    return {
      id: r.id,
      site: r.site,
      identifier: r.identifier,
      wall: analyzedWall(r, info),
      value: info.exploitation.value,
      self_breached: info.self_breached,
      reuse: {
        password_reused: info.password_reused,
        password_with: info.password_with,
        identifier_shared: info.identifier_shared,
        identifier_with: info.identifier_with,
      },
      contamination: info.contaminated,
      exploitability: info.exploitation,
    };
  });

  const edges = analysis.graphEdges
    .map(({ source, target, reason }) => {
      const s = byId.get(source);
      const t = byId.get(target);
      if (!s || !t) return null;
      return { source, target, reason, source_site: s.site, target_site: t.site };
    })
    .filter(Boolean);

  const exposed = accounts.filter((a) => a.wall === 'breached' || a.wall === 'at_risk');
  const exposure = { high: 0, medium: 0, low: 0 };
  for (const a of accounts) {
    exposure[a.exploitability.risk_band] = (exposure[a.exploitability.risk_band] || 0) + 1;
  }
  const weakest = [...exposed].sort(
    (x, y) => (y.exploitability.score * (y.value || 1)) - (x.exploitability.score * (x.value || 1)),
  )[0] || null;

  return {
    accounts,
    edges,
    blast_radius: accounts.filter((a) => a.contamination.length > 0).length,
    exposed: exposed.length,
    exposure,
    weakest,
  };
}

async function notifyContainAllEmail(userId, initiated, already) {
  try {
    const notify = require('./notifications');
    const usersTable = await table('users');
    const user = await usersTable.find({ id: userId });
    if (!user || !user.email) return;

    const items = initiated.map((a) =>
      `<li style="margin:6px 0;color:#f4f6fb;background:#121318;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px 12px;">
        <strong style="color:#FF3366;">${a.site}</strong> — <span style="font-family:monospace;font-size:12px;color:#00F2FE;">${a.identifier}</span>
        <p style="margin:4px 0 0;font-size:12px;color:#9aa0b5;">${a.reason} · playbook: ${a.playbook.title}</p>
      </li>`).join('');
    const alreadyHtml = already.length
      ? `<p style="color:#9aa0b5;font-size:12px;">${already.length} account(s) already have an active lockdown — a second one was not opened.</p>`
      : '';

    const detail = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <div style="background:linear-gradient(135deg,#050507,#0D0E12);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:28px;">
          <div style="font-size:44px;margin-bottom:12px;text-align:center;">&#128737;&#65039;</div>
          <h2 style="color:#f4f6fb;font-size:22px;margin:0 0 6px;text-align:center;">Barrier breach — full containment</h2>
          <p style="color:#9aa0b5;font-size:14px;margin:0 0 18px;text-align:center;">
            <strong style="color:#FF3366;">${initiated.length} lockdown playbook(s)</strong> initiated in one action.
            Accounts sharing the exposed passwords or identities are now in the blast radius.
          </p>
          <ol style="list-style:none;padding:0;margin:0 0 18px;">${items}</ol>
          ${alreadyHtml}
          <p style="color:#f4f6fb;font-size:13px;background:#121318;border:1px solid rgba(255,255,255,0.08);padding:12px;border-radius:10px;margin:0;">
            Rotate every listed password to a new, unique value, enable 2FA, and remove any recovery
            email you do not recognise. Call providers (banks, cards) for the highest-value accounts.
          </p>
        </div>
      </div>`;
    await notify.sendEmail(user.email, `Enclave — Containment: ${initiated.length} accounts locked down`, detail);
  } catch (e) {
    console.warn('[AccountShield] contain-all email failed:', e.message);
  }
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
  checklistFor,
  getSiteGuide,
  analyzeAccounts,
  propagateContamination,
  containAll,
  getIntelligence,
};