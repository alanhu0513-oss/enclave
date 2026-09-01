/* ─── ENCLAVE Video Call Shield — Background Service Worker ─── */

let apiToken = null;
let apiBase = 'https://enclave-production-d818.up.railway.app';
let shieldActive = false;
let scanInterval = null;
let activeTabs = new Map(); // tabId -> { lastScan, participantIndex }
let settings = {
  sensitivity: 'medium',
  autoScan: true,
  audioAnalysis: true,
  faceMatching: true,
};

const SENSITIVITY = {
  high: { threshold: 60, label: 'High' },
  medium: { threshold: 75, label: 'Medium' },
  low: { threshold: 85, label: 'Low' },
};

/* ─── Init ─── */
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    settings,
    stats: { scans: 0, threats: 0, audioScans: 0, sessions: [] },
    lastDetection: null,
  });
});

chrome.storage.local.get(['apiToken', 'apiBase', 'settings'], (data) => {
  if (data.apiToken) apiToken = data.apiToken;
  if (data.apiBase) apiBase = data.apiBase;
  if (data.settings) settings = { ...settings, ...data.settings };
});

/* ─── Message Router ─── */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'TOGGLE_SHIELD':
      shieldActive = !shieldActive;
      if (shieldActive) {
        startScanning(sender.tab?.id);
      } else {
        stopScanning();
      }
      chrome.storage.local.set({ shieldActive });
      sendResponse({ active: shieldActive });
      return true;

    case 'GET_STATUS':
      sendResponse({
        active: shieldActive,
        stats: getStats(),
        settings,
        lastDetection: null,
      });
      return true;

    case 'FRAME_CAPTURED':
      handleFrame(msg.dataUrl, msg.source, sender.tab?.id);
      sendResponse({ ok: true });
      return false;

    case 'AUDIO_CHUNK':
      handleAudioChunk(msg.audioData, sender.tab?.id);
      sendResponse({ ok: true });
      return false;

    case 'UPDATE_SETTINGS':
      settings = { ...settings, ...msg.settings };
      chrome.storage.local.set({ settings });
      sendResponse({ ok: true });
      return true;

    case 'SET_TOKEN':
      apiToken = msg.token;
      chrome.storage.local.set({ apiToken: msg.token });
      sendResponse({ ok: true });
      return true;

    case 'SET_API_BASE':
      apiBase = msg.url;
      chrome.storage.local.set({ apiBase: msg.url });
      sendResponse({ ok: true });
      return true;

    case 'GET_STATS':
      sendResponse(getStats());
      return true;

    case 'START_AUDIO_CAPTURE':
      startAudioCapture(sender.tab?.id);
      sendResponse({ ok: true });
      return true;
  }
});

/* ─── Scanning ─── */
function startScanning(tabId) {
  if (scanInterval) clearInterval(scanInterval);
  activeTabs.clear();
  if (tabId) activeTabs.set(tabId, { lastScan: 0, participantIndex: 0 });

  scanInterval = setInterval(() => {
    const now = Date.now();
    for (const [tabId, state] of activeTabs) {
      if (now - state.lastScan >= 2000) {
        state.lastScan = now;
        chrome.tabs.sendMessage(tabId, { type: 'CAPTURE_FRAME' }).catch(() => {
          activeTabs.delete(tabId);
        });
      }
    }
  }, 1000);

  // Track tab close
  chrome.tabs.onRemoved.addListener((closedTabId) => {
    activeTabs.delete(closedTabId);
  });

  // Add any existing call tabs
  if (tabId) {
    chrome.tabs.sendMessage(tabId, { type: 'CAPTURE_FRAME' }).catch(() => {});
  }
}

function stopScanning() {
  if (scanInterval) { clearInterval(scanInterval); scanInterval = null; }
  activeTabs.clear();
}

/* ─── Frame Analysis ─── */
async function handleFrame(dataUrl, source, tabId) {
  if (!dataUrl) return;

  incrementStat('scans');

  try {
    const result = await detectImage(dataUrl, source || 'video_call');
    const threshold = SENSITIVITY[settings.sensitivity]?.threshold || 75;

    if (result.confidence >= threshold) {
      incrementStat('threats');
      const detection = {
        time: Date.now(),
        confidence: result.confidence,
        verdict: result.verdict,
        source,
        isDeepfake: true,
      };
      chrome.storage.local.set({ lastDetection: detection });

      // Chrome notification
      chrome.notifications.create(`threat-${Date.now()}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Deepfake Detected',
        message: `Confidence: ${result.confidence}% — ${result.verdict || 'Potential manipulation detected'}`,
        priority: 2,
        requireInteraction: true,
      });

      // Forward to content script for in-page alert
      if (tabId) {
        chrome.tabs.sendMessage(tabId, {
          type: 'ALERT_DEEPFAKE',
          confidence: result.confidence,
          verdict: result.verdict,
        }).catch(() => {});
      }
    }
  } catch (e) {
    console.warn('[Shield] Frame analysis error:', e.message);
  }
}

/* ─── Audio Analysis ─── */
async function handleAudioChunk(audioData, tabId) {
  if (!settings.audioAnalysis || !audioData) return;

  incrementStat('audioScans');

  try {
    const result = await detectAudio(audioData);
    const threshold = SENSITIVITY[settings.sensitivity]?.threshold || 75;

    if (result.confidence >= threshold) {
      incrementStat('threats');
      const detection = {
        time: Date.now(),
        confidence: result.confidence,
        verdict: result.verdict,
        source: 'audio',
        isDeepfake: true,
      };
      chrome.storage.local.set({ lastDetection: detection });

      chrome.notifications.create(`audio-threat-${Date.now()}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Audio Deepfake Detected',
        message: `Voice manipulation detected — Confidence: ${result.confidence}%`,
        priority: 2,
        requireInteraction: true,
      });

      if (tabId) {
        chrome.tabs.sendMessage(tabId, {
          type: 'ALERT_DEEPFAKE',
          confidence: result.confidence,
          verdict: result.verdict,
          source: 'audio',
        }).catch(() => {});
      }
    }
  } catch (e) {
    console.warn('[Shield] Audio analysis error:', e.message);
  }
}

function startAudioCapture(tabId) {
  if (!tabId) return;
  try {
    chrome.tabs.sendMessage(tabId, { type: 'START_AUDIO_CAPTURE' }).catch(() => {});
  } catch (_) {}
}

/* ─── API Calls ─── */
async function detectImage(dataUrl, source) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiToken) headers['Authorization'] = `Bearer ${apiToken}`;

  const resp = await fetch(`${apiBase}/api/detect/image`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ image: dataUrl, source }),
  });

  if (!resp.ok) throw new Error(`API ${resp.status}`);
  const json = await resp.json();
  return json.data || json;
}

async function detectAudio(audioBase64) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiToken) headers['Authorization'] = `Bearer ${apiToken}`;

  const resp = await fetch(`${apiBase}/api/detect/audio`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ audio: audioBase64, source: 'video_call_shield' }),
  });

  if (!resp.ok) throw new Error(`API ${resp.status}`);
  const json = await resp.json();
  return json.data || json;
}

/* ─── Stats ─── */
function getStats() {
  return {
    scans: 0,
    threats: 0,
    audioScans: 0,
    blocked: 0,
    activeTabs: activeTabs.size,
  };
}

function incrementStat(key) {
  chrome.storage.local.get('stats', (data) => {
    const stats = data.stats || { scans: 0, threats: 0, audioScans: 0 };
    stats[key] = (stats[key] || 0) + 1;
    chrome.storage.local.set({ stats });
  });
}
