/* ─── Enclave Extension — Background Service Worker ─── */

const API_BASE_DEFAULT = 'http://localhost:4000';

async function getApiBase() {
  const { apiBase } = await chrome.storage.sync.get('apiBase');
  return apiBase || API_BASE_DEFAULT;
}

async function getToken() {
  const { authToken } = await chrome.storage.local.get('authToken');
  return authToken || null;
}

async function apiFetch(path, options = {}) {
  const base = await getApiBase();
  const token = await getToken();
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.json) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.json);
    delete options.json;
  }
  const res = await fetch(`${base}${path}`, { ...options, headers });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

/* ─── Context Menu ─── */

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'enclave-scan-image',
    title: '🛡️ Scan for Deepfake',
    contexts: ['image'],
  });
  chrome.contextMenus.create({
    id: 'enclave-scan-page',
    title: '🛡️ Scan All Images on Page',
    contexts: ['page'],
  });
  chrome.contextMenus.create({
    id: 'enclave-report-takedown',
    title: '🚨 Report for Takedown',
    contexts: ['image'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'enclave-scan-image') {
    await scanSingleImage(info.srcUrl, tab);
  } else if (info.menuItemId === 'enclave-scan-page') {
    await scanPageImages(tab);
  } else if (info.menuItemId === 'enclave-report-takedown') {
    await reportForTakedown(info.srcUrl, tab);
  }
});

/* ─── Image Scanning ─── */

async function scanSingleImage(imageUrl, tab) {
  setBadge('...', tab.id, '#f0ad4e');
  try {
    const result = await scanImageViaApi(imageUrl);
    if (result.error) throw new Error(result.error);

    const confidence = result.confidence || 0;
    const verdict = result.verdict || 'UNKNOWN';

    if (verdict === 'LIKELY_SYNTHETIC') {
      setBadge('⚠️', tab.id, '#e94560');
    } else if (verdict === 'SUSPICIOUS') {
      setBadge('?', tab.id, '#f0ad4e');
    } else {
      setBadge('✓', tab.id, '#28a745');
    }

    // Notify content script to show badge
    chrome.tabs.sendMessage(tab.id, {
      type: 'SCAN_RESULT',
      imageUrl,
      confidence,
      verdict,
      faceCount: result.face_count || 0,
      faces: result.faces || [],
      heuristic: result.heuristic,
      mlScore: result.ml_avg_score,
    });

    // Save to scan history
    await saveScanHistory(imageUrl, result);

  } catch (e) {
    setBadge('✗', tab.id, '#dc3545');
    chrome.tabs.sendMessage(tab.id, {
      type: 'SCAN_RESULT',
      imageUrl,
      confidence: 0,
      verdict: 'ERROR',
      error: e.message,
    });
  }

  // Clear badge after 5s
  setTimeout(() => setBadge('', tab.id, '#28a745'), 5000);
}

async function scanPageImages(tab) {
  setBadge('...', tab.id, '#f0ad4e');
  chrome.tabs.sendMessage(tab.id, { type: 'SCAN_PAGE' });
}

async function scanImageViaApi(imageUrl) {
  try {
    // Try URL-based scan first
    const result = await apiFetch('/api/detect/url', {
      method: 'POST',
      json: { url: imageUrl },
    });
    return result.data || result;
  } catch {
    // Fallback: download image and send as file
    try {
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error('Failed to fetch image');
      const blob = await res.blob();
      const formData = new FormData();
      formData.append('image', blob, 'image.jpg');
      const token = await getToken();
      const base = await getApiBase();
      const apiRes = await fetch(`${base}/api/detect/image`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });
      if (!apiRes.ok) throw new Error(`API ${apiRes.status}`);
      const data = await apiRes.json();
      return data.data || data;
    } catch (e2) {
      return { error: e2.message, confidence: 0, verdict: 'ERROR' };
    }
  }
}

/* ─── Takedown Reporting ─── */

async function reportForTakedown(imageUrl, tab) {
  setBadge('🚨', tab.id, '#e94560');
  try {
    // First scan the image
    const result = await scanImageViaApi(imageUrl);
    if (result.error) throw new Error(result.error);

    // Create an alert first
    const alertRes = await apiFetch('/api/alerts/scan/url', {
      method: 'POST',
      json: { url: imageUrl },
    });
    const alert = alertRes.data || alertRes;

    if (alert && alert.id) {
      // Initiate takedown
      const takedownRes = await apiFetch(`/api/takedowns/${alert.id}/initiate`, {
        method: 'POST',
        json: { type: 'dmca', sendEmail: false },
      });
      const takedown = takedownRes.data || takedownRes;

      chrome.tabs.sendMessage(tab.id, {
        type: 'TAKEDOWN_RESULT',
        imageUrl,
        takedownId: takedown.takedownId,
        status: 'prepared',
      });

      setBadge('✓', tab.id, '#28a745');
    }
  } catch (e) {
    setBadge('✗', tab.id, '#dc3545');
    chrome.tabs.sendMessage(tab.id, {
      type: 'TAKEDOWN_RESULT',
      imageUrl,
      error: e.message,
    });
  }
  setTimeout(() => setBadge('', tab.id, '#28a745'), 5000);
}

/* ─── Badge Helpers ─── */

function setBadge(text, tabId, color) {
  try {
    chrome.action.setBadgeText({ text, tabId });
    chrome.action.setBadgeBackgroundColor({ color, tabId });
  } catch {}
}

/* ─── Scan History ─── */

async function saveScanHistory(imageUrl, result) {
  const { scanHistory = [] } = await chrome.storage.local.get('scanHistory');
  scanHistory.unshift({
    url: imageUrl,
    confidence: result.confidence,
    verdict: result.verdict,
    faceCount: result.face_count || 0,
    timestamp: Date.now(),
  });
  // Keep last 100 scans
  if (scanHistory.length > 100) scanHistory.length = 100;
  await chrome.storage.local.set({ scanHistory });
}

/* ─── Message Handler ─── */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_SCAN_HISTORY') {
    chrome.storage.local.get('scanHistory', ({ scanHistory = [] }) => {
      sendResponse({ history: scanHistory });
    });
    return true;
  }

  if (msg.type === 'SCAN_IMAGE_FROM_POPUP') {
    scanSingleImage(msg.imageUrl, sender.tab || { id: null });
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'LOGIN') {
    handleLogin(msg.email, msg.password).then(sendResponse);
    return true;
  }

  if (msg.type === 'LOGOUT') {
    chrome.storage.local.remove('authToken');
    chrome.storage.local.remove('user');
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'GET_USER') {
    chrome.storage.local.get('user', ({ user }) => {
      sendResponse({ user: user || null });
    });
    return true;
  }

  if (msg.type === 'SET_API_BASE') {
    chrome.storage.sync.set({ apiBase: msg.apiBase });
    sendResponse({ ok: true });
    return true;
  }
});

async function handleLogin(email, password) {
  try {
    const base = await getApiBase();
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!data.success) return { error: data.message || 'Login failed' };
    await chrome.storage.local.set({
      authToken: data.data.token,
      user: data.data.user,
    });
    return { user: data.data.user };
  } catch (e) {
    return { error: e.message };
  }
}
