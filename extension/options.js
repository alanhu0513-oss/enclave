/* ─── Enclave Extension — Options Page ─── */

document.addEventListener('DOMContentLoaded', async () => {
  const { apiBase = 'http://localhost:4000' } = await chrome.storage.sync.get('apiBase');
  const { autoScan = false } = await chrome.storage.sync.get('autoScan');

  document.getElementById('api-base').value = apiBase;
  document.getElementById('auto-scan').checked = autoScan;

  // Save settings
  document.getElementById('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newApiBase = document.getElementById('api-base').value.trim().replace(/\/$/, '');
    const newAutoScan = document.getElementById('auto-scan').checked;

    await chrome.storage.sync.set({
      apiBase: newApiBase || 'http://localhost:4000',
      autoScan: newAutoScan,
    });

    const status = document.getElementById('save-status');
    status.textContent = 'Settings saved';
    status.style.color = '#28a745';
    setTimeout(() => { status.textContent = ''; }, 2000);
  });

  // Test connection
  document.getElementById('test-btn').addEventListener('click', async () => {
    const base = document.getElementById('api-base').value.trim().replace(/\/$/, '') || 'http://localhost:4000';
    const status = document.getElementById('test-status');
    status.textContent = 'Testing...';
    status.style.color = '#f0ad4e';

    try {
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      if (data.status === 'ok') {
        status.textContent = '✓ Connected';
        status.style.color = '#28a745';
      } else {
        status.textContent = '✗ Unexpected response';
        status.style.color = '#e94560';
      }
    } catch (e) {
      status.textContent = `✗ ${e.message}`;
      status.style.color = '#e94560';
    }
  });

  // Clear history
  document.getElementById('clear-history').addEventListener('click', async () => {
    await chrome.storage.local.remove('scanHistory');
    const status = document.getElementById('clear-status');
    status.textContent = 'History cleared';
    status.style.color = '#28a745';
    setTimeout(() => { status.textContent = ''; }, 2000);
  });
});
