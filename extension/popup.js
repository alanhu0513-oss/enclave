/* ─── ENCLAVE Video Call Shield — Popup ─── */

let settings = { sensitivity: 'medium', autoScan: true, audioAnalysis: true, faceMatching: true };

// Load state from background
chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
  if (res) {
    if (res.settings) settings = { ...settings, ...res.settings };
    updateUI(res.active, res.stats, res.lastDetection);
  }
});

// Shield toggle
document.getElementById('shieldToggle').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'TOGGLE_SHIELD' }, (res) => {
    if (res) updateToggleUI(res.active);
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

function updateUI(active, stats, lastDetection) {
  updateToggleUI(active);

  if (stats) {
    document.getElementById('scanCount').textContent = stats.scans || 0;
    document.getElementById('threatCount').textContent = stats.threats || 0;
  }

  // Highlight active sensitivity button
  document.querySelectorAll('.sens-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.level === (settings.sensitivity || 'medium'));
  });

  document.getElementById('audioToggle').classList.toggle('on', settings.audioAnalysis !== false);

  // Last detection
  if (lastDetection) {
    const isThreat = lastDetection.isDeepfake;
    document.getElementById('lsIcon').textContent = isThreat ? '🚨' : '✅';
    document.getElementById('lsText').textContent = isThreat
      ? `${lastDetection.confidence}% — ${lastDetection.verdict || 'Threat'}`
      : 'No threats';
    document.getElementById('lsTime').textContent = formatTime(lastDetection.time);
    document.getElementById('lastScan').className = `last-scan ${isThreat ? 'danger' : 'safe'}`;
  }
}

function updateToggleUI(active) {
  document.getElementById('shieldToggle').className = `toggle ${active ? 'on' : ''}`;
  document.getElementById('statusDot').className = `dot ${active ? '' : 'off'}`;
  document.getElementById('statusText').textContent = active ? 'Active' : 'Paused';
}

function formatTime(ts) {
  if (!ts) return 'Never';
  const d = Date.now() - ts;
  if (d < 60000) return 'Just now';
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  return `${Math.floor(d / 86400000)}d ago`;
}
