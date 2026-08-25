/* ─── Enclave Extension — Popup UI ─── */

document.addEventListener('DOMContentLoaded', async () => {
  const { user } = await chrome.runtime.sendMessage({ type: 'GET_USER' });
  const { scanHistory = [] } = await chrome.storage.local.get('scanHistory');

  // Auth section
  const authSection = document.getElementById('auth-section');
  const mainSection = document.getElementById('main-section');
  const loginForm = document.getElementById('login-form');
  const logoutBtn = document.getElementById('logout-btn');
  const userInfo = document.getElementById('user-info');

  if (user) {
    authSection.style.display = 'none';
    mainSection.style.display = 'block';
    userInfo.textContent = user.email || user.fullName || 'Logged in';
  } else {
    authSection.style.display = 'block';
    mainSection.style.display = 'none';
  }

  // Login
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';

    const result = await chrome.runtime.sendMessage({ type: 'LOGIN', email, password });
    if (result.error) {
      errorEl.textContent = result.error;
    } else {
      authSection.style.display = 'none';
      mainSection.style.display = 'block';
      userInfo.textContent = result.user?.email || email;
    }
  });

  // Logout
  logoutBtn?.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'LOGOUT' });
    authSection.style.display = 'block';
    mainSection.style.display = 'none';
  });

  // Scan URL input
  const scanBtn = document.getElementById('scan-btn');
  const scanUrl = document.getElementById('scan-url');
  const scanResult = document.getElementById('scan-result');

  scanBtn?.addEventListener('click', async () => {
    const url = scanUrl.value.trim();
    if (!url) return;
    scanResult.innerHTML = '<div class="loading">Scanning...</div>';
    scanResult.style.display = 'block';

    const result = await chrome.runtime.sendMessage({ type: 'SCAN_IMAGE_FROM_POPUP', imageUrl: url });
    if (result.error) {
      scanResult.innerHTML = `<div class="error">Error: ${result.error}</div>`;
    } else {
      const color = result.verdict === 'LIKELY_SYNTHETIC' ? '#e94560' :
                    result.verdict === 'SUSPICIOUS' ? '#f0ad4e' : '#28a745';
      scanResult.innerHTML = `
        <div class="result" style="border-left: 3px solid ${color}; padding-left: 8px;">
          <div class="verdict" style="color: ${color}; font-weight: bold;">${result.verdict?.replace('_', ' ') || 'UNKNOWN'}</div>
          <div class="confidence">Confidence: ${result.confidence}%</div>
          ${result.faceCount ? `<div class="faces">Faces: ${result.faceCount}</div>` : ''}
        </div>
      `;
    }
  });

  // Scan history
  const historyList = document.getElementById('scan-history');
  if (historyList && scanHistory.length) {
    historyList.innerHTML = scanHistory.slice(0, 20).map(h => {
      const color = h.verdict === 'LIKELY_SYNTHETIC' ? '#e94560' :
                    h.verdict === 'SUSPICIOUS' ? '#f0ad4e' : '#28a745';
      const time = new Date(h.timestamp).toLocaleTimeString();
      return `
        <div class="history-item" style="border-left: 2px solid ${color}; padding-left: 6px; margin: 4px 0;">
          <div class="history-verdict" style="color: ${color}; font-size: 12px; font-weight: bold;">${h.verdict?.replace('_', ' ') || '?'}</div>
          <div class="history-url" style="font-size: 10px; color: #666; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 240px;">${h.url}</div>
          <div class="history-meta" style="font-size: 10px; color: #999;">${h.confidence}% · ${time}</div>
        </div>
      `;
    }).join('');
  } else if (historyList) {
    historyList.innerHTML = '<div class="empty" style="color: #999; font-size: 12px;">No scans yet</div>';
  }
});
