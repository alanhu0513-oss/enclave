/* ─── Enclave Shield — Popup Script ─── */

const API = 'https://enclave-production-d818.up.railway.app';
let settings = { sensitivity: 'medium', audioAnalysis: true, faceMatching: true };
let shieldActive = false;
let stats = { scans: 0, threats: 0, audioScans: 0 };

/* ─── Init ─── */
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['apiToken', 'settings', 'shieldActive', 'stats', 'userEmail'], (data) => {
    if (data.settings) settings = { ...settings, ...data.settings };
    if (data.shieldActive) shieldActive = data.shieldActive;
    if (data.stats) stats = { ...stats, ...data.stats };

    if (data.apiToken) {
      showDashboard(data.userEmail);
      updateUI();
      checkConnection(data.apiToken);
    } else {
      showLogin();
    }

    setupToggles();
    setupSensitivity();
    setupLogin();
    setupLogout();

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.stats) {
        stats = changes.stats.newValue || stats;
        updateStats();
      }
      if (changes.lastDetection) {
        updateLastDetect(changes.lastDetection.newValue);
      }
      if (changes.shieldActive) {
        shieldActive = changes.shieldActive.newValue;
        updateToggle();
      }
    });
  });
});

/* ─── Login ─── */
function showLogin() {
  document.getElementById('loginSection').classList.remove('hidden');
  document.getElementById('dashboardSection').classList.add('hidden');
}

function showDashboard(email) {
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('dashboardSection').classList.remove('hidden');
  if (email) {
    document.getElementById('ldSub').textContent = `Signed in as ${email}`;
  }
}

function setupLogin() {
  const btn = document.getElementById('loginBtn');
  const emailInput = document.getElementById('loginEmail');
  const passInput = document.getElementById('loginPassword');
  const errEl = document.getElementById('loginError');

  btn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passInput.value;

    if (!email || !password) {
      errEl.textContent = 'Email and password required';
      errEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Signing in...';
    errEl.style.display = 'none';

    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok && data.token) {
        chrome.storage.local.set({
          apiToken: data.token,
          userEmail: email,
          userTier: data.user?.tier || 'free',
        });
        // Notify background script of new token
        chrome.runtime.sendMessage({ type: 'SET_TOKEN', token: data.token });
        showDashboard(email);
        checkConnection(data.token);
      } else {
        errEl.textContent = data.error || data.message || 'Login failed';
        errEl.style.display = 'block';
      }
    } catch (e) {
      errEl.textContent = 'Network error — is the server online?';
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });

  passInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btn.click();
  });
}

/* ─── Connection check ─── */
function checkConnection(token) {
  const el = document.getElementById('connStatus');
  const text = document.getElementById('connText');

  fetch(`${API}/api/health`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.status === 'ok' || data.status === 'degraded') {
        el.className = 'conn-status connected';
        text.textContent = 'Server connected';
      } else {
        el.className = 'conn-status error';
        text.textContent = 'Server degraded';
      }
    })
    .catch(() => {
      el.className = 'conn-status error';
      text.textContent = 'Offline';
    });
}

/* ─── Shield toggle ─── */
function setupToggles() {
  const mainToggle = document.getElementById('mainToggle');
  const shieldBtn = document.getElementById('shieldToggle');
  const audioBtn = document.getElementById('audioToggle');
  const faceBtn = document.getElementById('faceToggle');

  shieldBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    shieldActive = !shieldActive;
    chrome.storage.local.set({ shieldActive });
    chrome.runtime.sendMessage({ type: 'TOGGLE_SHIELD' });
    updateToggle();
  });

  mainToggle.addEventListener('click', () => shieldBtn.click());

  audioBtn.addEventListener('click', () => {
    settings.audioAnalysis = !settings.audioAnalysis;
    chrome.storage.local.set({ settings });
    audioBtn.classList.toggle('on', settings.audioAnalysis);
  });

  faceBtn.addEventListener('click', () => {
    settings.faceMatching = !settings.faceMatching;
    chrome.storage.local.set({ settings });
    faceBtn.classList.toggle('on', settings.faceMatching);
  });
}

function updateToggle() {
  const btn = document.getElementById('shieldToggle');
  const label = document.getElementById('shieldLabel');
  const sub = document.getElementById('shieldSub');
  const row = document.getElementById('mainToggle');

  btn.classList.toggle('on', shieldActive);
  row.classList.toggle('active', shieldActive);

  if (shieldActive) {
    label.textContent = 'Shield Active';
    sub.textContent = 'Scanning video calls';
  } else {
    label.textContent = 'Shield Off';
    sub.textContent = 'Click to activate';
  }
}

/* ─── Sensitivity ─── */
function setupSensitivity() {
  document.querySelectorAll('.sens-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      settings.sensitivity = btn.dataset.level;
      chrome.storage.local.set({ settings });
      document.querySelectorAll('.sens-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

/* ─── Stats ─── */
function updateStats() {
  document.getElementById('scanCount').textContent = stats.scans || 0;
  document.getElementById('threatCount').textContent = stats.threats || 0;
  document.getElementById('audioCount').textContent = stats.audioScans || 0;
}

/* ─── Last detection ─── */
function updateLastDetect(d) {
  const el = document.getElementById('lastDetect');
  const icon = document.getElementById('ldIcon');
  const title = document.getElementById('ldTitle');
  const sub = document.getElementById('ldSub');

  if (!d) return;

  if (d.deepfake) {
    el.className = 'last-detect danger';
    icon.textContent = '🚨';
    title.textContent = 'Deepfake detected';
    sub.textContent = `${d.confidence}% confidence · ${d.provider || 'AI'}`;
  } else {
    el.className = 'last-detect safe';
    icon.textContent = '✅';
    title.textContent = 'No threats detected';
    sub.textContent = `Scan #${stats.scans} · ${d.provider || 'local'}`;
  }
}

/* ─── Logout ─── */
function setupLogout() {
  document.getElementById('logoutBtn').addEventListener('click', () => {
    chrome.storage.local.remove(['apiToken', 'userEmail', 'userTier'], () => {
      chrome.runtime.sendMessage({ type: 'SET_TOKEN', token: null });
      showLogin();
    });
  });
}

/* ─── Full UI sync ─── */
function updateUI() {
  updateToggle();
  updateStats();

  document.querySelectorAll('.sens-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.level === settings.sensitivity);
  });

  document.getElementById('audioToggle').classList.toggle('on', settings.audioAnalysis);
  document.getElementById('faceToggle').classList.toggle('on', settings.faceMatching);
}
