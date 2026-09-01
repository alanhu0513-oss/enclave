let settings = { enabled: true, showBadge: true, sensitivity: 'medium', useApi: true };

chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (res) => {
  if (res) {
    settings = res;
    updateUI();
  }
});

chrome.runtime.sendMessage({ type: 'GET_STATS' }, (res) => {
  if (res) {
    document.getElementById('scannedCount').textContent = res.scanned || 0;
    document.getElementById('threatCount').textContent = res.threats || 0;
  }
});

function updateUI() {
  document.getElementById('enabledToggle').classList.toggle('active', settings.enabled);
  document.getElementById('badgeToggle').classList.toggle('active', settings.showBadge);
  document.getElementById('apiToggle').classList.toggle('active', settings.useApi !== false);
  document.getElementById('sensitivity').value = settings.sensitivity || 'medium';
}

document.getElementById('enabledToggle').addEventListener('click', () => {
  settings.enabled = !settings.enabled;
  chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings });
  updateUI();
});

document.getElementById('badgeToggle').addEventListener('click', () => {
  settings.showBadge = !settings.showBadge;
  chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings });
  updateUI();
});

document.getElementById('apiToggle').addEventListener('click', () => {
  settings.useApi = settings.useApi === false ? true : false;
  chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings });
  updateUI();
});

document.getElementById('sensitivity').addEventListener('change', (e) => {
  settings.sensitivity = e.target.value;
  chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings });
});
