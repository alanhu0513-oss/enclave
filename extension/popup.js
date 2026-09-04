/* ─── ENCLAVE Video Call Shield — Popup ─── */

let settings = { sensitivity: 'medium', autoScan: true, audioAnalysis: true, faceMatching: true };
let shieldActive = false;

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
  // Load state from background
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
    if (res) {
      shieldActive = res.active;
      if (res.settings) settings = { ...settings, ...res.settings };
      updateToggleUI(shieldActive);
      updateStats(res.stats);
      updateLastDetection(res.lastDetection);
      updateSettingsUI();
    }
    checkConnection();
  });

  // Load saved token
  chrome.storage.local.get('apiToken', (data) => {
    if (data.apiToken) {
      document.getElementById('tokenInput').value = data.apiToken;
    }
  });

  setupEventListeners();
});

// ─── Event Listeners ───
function setupEventListeners() {
  // Shield toggle
  document.getElementById('shieldToggle').addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ type: 'TOGGLE_SHIELD' }, (res) => {
      if (res) {
        shieldActive = res.active;
        updateToggleUI(shieldActive);
      }
    });
  });

  document.getElementById('mainToggle').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'TOGGLE_SHIELD' }, (res) => {
      if (res) {
        shieldActive = res.active;
        updateToggleUI(shieldActive);
      }
    });
  });

  // Sensitivity buttons
  document.querySelectorAll('.sens-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      settings.sensitivity = btn.dataset.level;
      chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings });
      document.querySelectorAll('.sens-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Audio toggle
  document.getElementById('audioToggle').addEventListener('click', () => {
    settings.audioAnalysis = !settings.audioAnalysis;
    chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings });
    document.getElementById('audioToggle').classList.toggle('on', settings.audioAnalysis);
  });

  // Face matching toggle
  document.getElementById('faceToggle').addEventListener('click', () => {
    settings.faceMatching = !settings.faceMatching;
    chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings });
    document.getElementById('faceToggle').classList.toggle('on', settings.faceMatching);
  });

  // Token save
  document.getElementById('tokenSave').addEventListener('click', () => {
    const token = document.getElementById('tokenInput').value.trim();
    chrome.runtime.sendMessage({ type: 'SET_TOKEN', token }, () => {
      checkConnection();
      // Visual feedback
      const btn = document.getElementById('tokenSave');
      btn.textContent = '✓';
      btn.style.color = 'var(--green)';
      setTimeout(() => {
        btn.textContent = 'Save';
        btn.style.color = '';
      }, 1500);
    });
  });

  // Enter key on token input
  document.getElementById('tokenInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('tokenSave').click();
    }
  });
}

// ─── UI Updates ───
function updateToggleUI(active) {
  const toggle = document.getElementById('shieldToggle');
  const mainToggle = document.getElementById('mainToggle');
  const label = document.getElementById('shieldLabel');
  const sub = document.getElementById('shieldSub');

  toggle.className = `toggle-switch ${active ? 'on' : ''}`;
  mainToggle.className = `main-toggle ${active ? 'active' : ''}`;

  if (active) {
    label.textContent = 'Shield Active';
    sub.textContent = 'Scanning video calls';
  } else {
    label.textContent = 'Shield Paused';
    sub.textContent = 'Click to enable protection';
  }
}

function updateStats(stats) {
  if (!stats) return;
  document.getElementById('scanCount').textContent = stats.scans || 0;
  document.getElementById('threatCount').textContent = stats.threats || 0;
  document.getElementById('audioCount').textContent = stats.audioScans || 0;
}

function updateLastDetection(detection) {
  const el = document.getElementById('lastDetect');
  const icon = document.getElementById('ldIcon');
  const title = document.getElementById('ldTitle');
  const sub = document.getElementById('ldSub');

  if (!detection) {
    el.className = 'last-detect safe';
    icon.textContent = '✅';
    title.textContent = 'No threats detected';
    sub.textContent = 'Waiting for video call...';
    return;
  }

  const isThreat = detection.isDeepfake;
  el.className = `last-detect ${isThreat ? 'danger' : 'safe'}`;
  icon.textContent = isThreat ? '🚨' : '✅';
  title.textContent = isThreat
    ? `Threat: ${detection.confidence}%`
    : 'No threats detected';
  sub.textContent = isThreat
    ? `${detection.verdict || 'Deepfake detected'} — ${formatTime(detection.time)}`
    : `Last scan: ${formatTime(detection.time)}`;
}

function updateSettingsUI() {
  document.querySelectorAll('.sens-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.level === (settings.sensitivity || 'medium'));
  });
  document.getElementById('audioToggle').classList.toggle('on', settings.audioAnalysis !== false);
  document.getElementById('faceToggle').classList.toggle('on', settings.faceMatching !== false);
}

async function checkConnection() {
  const el = document.getElementById('connStatus');
  const text = document.getElementById('connText');

  try {
    const resp = await fetch('https://enclave-production-d818.up.railway.app/api/health', {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (resp.ok) {
      el.className = 'conn-status connected';
      text.textContent = 'Connected to Enclave';
    } else {
      el.className = 'conn-status error';
      text.textContent = `Server error (${resp.status})`;
    }
  } catch (e) {
    el.className = 'conn-status error';
    text.textContent = 'Cannot reach server';
  }
}

function formatTime(ts) {
  if (!ts) return 'Never';
  const d = Date.now() - ts;
  if (d < 60000) return 'Just now';
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  return `${Math.floor(d / 86400000)}d ago`;
}

// ─── Live updates from background ───
chrome.storage.onChanged.addListener((changes) => {
  if (changes.stats) updateStats(changes.stats.newValue);
  if (changes.lastDetection) updateLastDetection(changes.lastDetection.newValue);
  if (changes.shieldActive) updateToggleUI(changes.shieldActive.newValue);
});
