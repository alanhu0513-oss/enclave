/* ─── Enclave Shield — Popup ─── */

const API = 'https://enclave-production-d818.up.railway.app';
let settings = { sensitivity: 'medium', audioAnalysis: true, faceMatching: true };
let shieldActive = false;
let stats = { scans: 0, threats: 0, audioScans: 0 };

document.addEventListener('DOMContentLoaded', init);

function init() {
  chrome.storage.local.get(['apiToken', 'settings', 'shieldActive', 'stats', 'userEmail'], (data) => {
    if (data.settings) settings = { ...settings, ...data.settings };
    if (data.shieldActive != null) shieldActive = data.shieldActive;
    if (data.stats) stats = { ...stats, ...data.stats };

    if (data.apiToken) {
      showDash(data.userEmail);
      syncUI();
      checkConn(data.apiToken);
    } else {
      showLogin();
    }

    bindLogin();
    bindLogout();
    bindShield();
    bindSensitivity();
    bindToggles();

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.stats) { stats = changes.stats.newValue || stats; renderStats(); }
      if (changes.lastDetection) renderLastDetect(changes.lastDetection.newValue);
      if (changes.shieldActive != null) { shieldActive = changes.shieldActive.newValue; renderShield(); }
    });
  });
}

/* ─── Views ─── */
function showLogin() {
  document.getElementById('loginView').classList.remove('hidden');
  document.getElementById('dashView').classList.add('hidden');
}
function showDash(email) {
  document.getElementById('loginView').classList.add('hidden');
  const dash = document.getElementById('dashView');
  dash.classList.remove('hidden');
  dash.classList.add('fade-in');
  if (email) document.getElementById('ldSub').textContent = email;
}

/* ─── Connection ─── */
function checkConn(token) {
  const bar = document.getElementById('connBar');
  const txt = document.getElementById('connText');
  fetch(`${API}/api/health`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    .then(r => r.json())
    .then(d => {
      if (d.status === 'ok' || d.status === 'degraded') {
        bar.className = 'conn-bar ok';
        txt.textContent = 'Connected';
      } else {
        bar.className = 'conn-bar err';
        txt.textContent = 'Server degraded';
      }
    })
    .catch(() => { bar.className = 'conn-bar err'; txt.textContent = 'Offline'; });
}

/* ─── Login ─── */
function bindLogin() {
  const btn = document.getElementById('btnLogin');
  const email = document.getElementById('inputEmail');
  const pass = document.getElementById('inputPass');
  const err = document.getElementById('loginErr');

  btn.addEventListener('click', doLogin);
  pass.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

  async function doLogin() {
    const em = email.value.trim();
    const pw = pass.value;
    if (!em || !pw) { showErr('Email and password required'); return; }

    btn.disabled = true;
    btn.textContent = 'Signing in...';
    err.style.display = 'none';

    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: em, password: pw }),
      });
      const data = await res.json();

      if (res.ok && data.token) {
        chrome.storage.local.set({
          apiToken: data.token,
          userEmail: em,
          userTier: data.user?.tier || 'free',
        });
        chrome.runtime.sendMessage({ type: 'SET_TOKEN', token: data.token });
        showDash(em);
        checkConn(data.token);
      } else {
        showErr(data.error || data.message || 'Login failed');
      }
    } catch (e) {
      showErr('Network error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  }

  function showErr(msg) {
    err.textContent = msg;
    err.style.display = 'block';
  }
}

/* ─── Logout ─── */
function bindLogout() {
  document.getElementById('btnLogout').addEventListener('click', () => {
    chrome.storage.local.remove(['apiToken', 'userEmail', 'userTier'], () => {
      chrome.runtime.sendMessage({ type: 'SET_TOKEN', token: null });
      showLogin();
    });
  });
}

/* ─── Shield toggle ─── */
function bindShield() {
  const row = document.getElementById('shieldRow');
  const btn = document.getElementById('shieldToggle');

  function toggle() {
    shieldActive = !shieldActive;
    chrome.storage.local.set({ shieldActive });
    chrome.runtime.sendMessage({ type: 'TOGGLE_SHIELD' });
    renderShield();
  }

  btn.addEventListener('click', e => { e.stopPropagation(); toggle(); });
  row.addEventListener('click', toggle);
}

function renderShield() {
  const btn = document.getElementById('shieldToggle');
  const row = document.getElementById('shieldRow');
  const label = document.getElementById('shieldLabel');
  const sub = document.getElementById('shieldSub');

  btn.classList.toggle('on', shieldActive);
  row.classList.toggle('on', shieldActive);

  if (shieldActive) {
    label.textContent = 'Shield Active';
    sub.textContent = 'Scanning video calls';
  } else {
    label.textContent = 'Shield Off';
    sub.textContent = 'Click to activate';
  }
}

/* ─── Sensitivity ─── */
function bindSensitivity() {
  document.querySelectorAll('.sens-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      settings.sensitivity = btn.dataset.level;
      chrome.storage.local.set({ settings });
      document.querySelectorAll('.sens-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

/* ─── Toggles ─── */
function bindToggles() {
  const audio = document.getElementById('togAudio');
  const face = document.getElementById('togFace');

  audio.addEventListener('click', () => {
    settings.audioAnalysis = !settings.audioAnalysis;
    chrome.storage.local.set({ settings });
    audio.classList.toggle('on', settings.audioAnalysis);
  });

  face.addEventListener('click', () => {
    settings.faceMatching = !settings.faceMatching;
    chrome.storage.local.set({ settings });
    face.classList.toggle('on', settings.faceMatching);
  });
}

/* ─── Stats ─── */
function renderStats() {
  document.getElementById('statScans').textContent = stats.scans || 0;
  document.getElementById('statThreats').textContent = stats.threats || 0;
  document.getElementById('statAudio').textContent = stats.audioScans || 0;
}

/* ─── Last detection ─── */
function renderLastDetect(d) {
  if (!d) return;
  const el = document.getElementById('lastDet');
  const icon = document.getElementById('ldIcon');
  const title = document.getElementById('ldTitle');
  const sub = document.getElementById('ldSub');

  if (d.isDeepfake || d.deepfake) {
    el.className = 'last-det danger fade-in';
    icon.textContent = '\u26A0';
    icon.style.fontSize = '16px';
    title.textContent = 'Deepfake detected';
    sub.textContent = `${d.confidence || 0}% \u00B7 ${d.source || d.provider || 'AI'}`;
  } else {
    el.className = 'last-det safe fade-in';
    icon.textContent = '\u2713';
    icon.style.fontSize = '14px';
    title.textContent = 'No threats detected';
    sub.textContent = `Scan #${stats.scans} \u00B7 ${d.provider || 'local'}`;
  }
}

/* ─── Full sync ─── */
function syncUI() {
  renderShield();
  renderStats();
  document.querySelectorAll('.sens-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.level === settings.sensitivity);
  });
  document.getElementById('togAudio').classList.toggle('on', settings.audioAnalysis);
  document.getElementById('togFace').classList.toggle('on', settings.faceMatching);
}
