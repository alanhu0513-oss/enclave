/* ─── ENCLAVE Video Call Shield — Popup ─── */

let settings = { sensitivity: 'medium', autoScan: true, audioAnalysis: true, faceMatching: true };

chrome.storage.local.get(['shieldActive', 'settings', 'stats', 'lastDetection'], (data) => {
  if (data.settings) settings = { ...settings, ...data.settings };
  updateUI(data.shieldActive, data.stats, data.lastDetection);
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

  document.querySelectorAll('.sens-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.level === (settings.sensitivity || 'medium'));
  });

  document.getElementById('audioToggle').classList.toggle('on', settings.audioAnalysis !== false);

  if (lastDetection) {
    document.getElementById('lsIcon').textContent = lastDetection.isDeepfake ? '🚨' : '🛡️';
    document.getElementById('lsText').textContent = lastDetection.isDeepfake
      ? `Deepfake: ${lastDetection.confidence}%`
      : 'No threats';
    document.getElementById('lsTime').textContent = formatTime(lastDetection.time);
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
