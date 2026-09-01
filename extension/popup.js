/* ─── ENCLAVE Video Call Shield — Popup ─── */

let settings = { sensitivity: 'medium', autoScan: true, audioAnalysis: true, faceMatching: true };

// Load state
chrome.storage.local.get(['shieldActive', 'settings', 'stats', 'lastDetection', 'apiToken'], (data) => {
  if (data.settings) settings = { ...settings, ...data.settings };
  updateUI(data.shieldActive, data.stats, data.lastDetection, !!data.apiToken);
});

// Toggle shield
document.getElementById('shieldToggle').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_SHIELD' });
      // Also send to background
      chrome.runtime.sendMessage({ type: 'TOGGLE_SHIELD' }, (res) => {
        updateToggleUI(res?.active);
      });
    }
  });
});

// Sensitivity selector
document.getElementById('sensitivity').addEventListener('change', (e) => {
  settings.sensitivity = e.target.value;
  chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings });
});

// Audio toggle
document.getElementById('audioToggle')?.addEventListener('click', () => {
  settings.audioAnalysis = !settings.audioAnalysis;
  chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings });
  document.getElementById('audioToggle').classList.toggle('active', settings.audioAnalysis);
});

function updateUI(active, stats, lastDetection, hasToken) {
  updateToggleUI(active);

  if (stats) {
    document.getElementById('scanCount').textContent = stats.scans || 0;
    document.getElementById('threatCount').textContent = stats.threats || 0;
  }

  document.getElementById('sensitivity').value = settings.sensitivity || 'medium';

  if (document.getElementById('audioToggle')) {
    document.getElementById('audioToggle').classList.toggle('active', settings.audioAnalysis !== false);
  }

  // Last detection
  const lastEl = document.getElementById('lastDetection');
  if (lastDetection && lastEl) {
    const ago = formatTimeAgo(lastDetection.time);
    lastEl.querySelector('.ld-icon').textContent = lastDetection.isDeepfake ? '🚨' : '🛡️';
    lastEl.querySelector('.ld-text').textContent = lastDetection.isDeepfake
      ? `Deepfake: ${lastDetection.confidence}%`
      : 'No threats detected';
    lastEl.querySelector('.ld-time').textContent = ago;
  }
}

function updateToggleUI(active) {
  const toggle = document.getElementById('shieldToggle');
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  if (toggle) toggle.className = `toggle ${active ? 'on' : ''}`;
  if (dot) dot.style.background = active ? '#00ff88' : '#ef4444';
  if (text) text.textContent = active ? 'Active' : 'Paused';
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Never';
  const diff = Date.now() - timestamp;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}
