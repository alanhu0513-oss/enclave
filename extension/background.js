/* ─── Enclave Shield — Background Service Worker ─── */

let apiToken = null;
let apiBase = 'https://enclave-production-d818.up.railway.app';
let shieldActive = false;
let scanInterval = null;
let activeTabs = new Map();
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
    stats: { scans: 0, threats: 0, audioScans: 0 },
    lastDetection: null,
    shieldActive: false,
  });
});

chrome.storage.local.get(['apiToken', 'apiBase', 'settings', 'shieldActive'], (data) => {
  if (data.apiToken) apiToken = data.apiToken;
  if (data.apiBase) apiBase = data.apiBase;
  if (data.settings) settings = { ...settings, ...data.settings };
  if (data.shieldActive != null) shieldActive = data.shieldActive;
});

/* ─── Message Router ─── */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'TOGGLE_SHIELD': {
      // Read from storage to stay in sync with popup
      chrome.storage.local.get('shieldActive', (data) => {
        shieldActive = !data.shieldActive;
        if (shieldActive) {
          startScanning(sender.tab?.id);
        } else {
          stopScanning();
        }
        chrome.storage.local.set({ shieldActive });
        sendResponse({ active: shieldActive });
      });
      return true;
    }

    case 'SET_SHIELD': {
      shieldActive = !!msg.active;
      if (shieldActive) {
        startScanning(sender.tab?.id);
      } else {
        stopScanning();
      }
      chrome.storage.local.set({ shieldActive });
      sendResponse({ active: shieldActive });
      return true;
    }

    case 'GET_STATUS': {
      chrome.storage.local.get(['stats', 'lastDetection'], (data) => {
        sendResponse({
          active: shieldActive,
          stats: data.stats || { scans: 0, threats: 0, audioScans: 0 },
          settings,
          lastDetection: data.lastDetection,
        });
      });
      return true;
    }

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
      apiToken = msg.token || null;
      chrome.storage.local.set({ apiToken: msg.token || null });
      sendResponse({ ok: true });
      return true;

    case 'SET_API_BASE':
      apiBase = msg.url || apiBase;
      chrome.storage.local.set({ apiBase });
      sendResponse({ ok: true });
      return true;

    case 'GET_STATS': {
      chrome.storage.local.get('stats', (data) => {
        sendResponse(data.stats || { scans: 0, threats: 0, audioScans: 0 });
      });
      return true;
    }

    case 'START_AUDIO_CAPTURE':
      startAudioCapture(sender.tab?.id);
      sendResponse({ ok: true });
      return true;

    default:
      return false;
  }
});

/* ─── Scanning ─── */
function startScanning(tabId) {
  if (scanInterval) clearInterval(scanInterval);

  scanInterval = setInterval(() => {
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (!tab.url) continue;
        const isVideoCall =
          tab.url.includes('zoom.us') ||
          tab.url.includes('meet.google.com') ||
          tab.url.includes('teams.microsoft.com') ||
          tab.url.includes('web.webex.com');

        if (isVideoCall && tab.id) {
          chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_FRAME' }).catch(() => {});
          if (settings.audioAnalysis) {
            startAudioCapture(tab.id);
          }
        }
      }
    });
  }, 3000);
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
    const confidence = result.confidence || 0;

    const detection = {
      time: Date.now(),
      confidence,
      verdict: result.verdict || 'Analyzing...',
      source,
      provider: result.provider || 'local',
      isDeepfake: confidence >= threshold,
    };
    chrome.storage.local.set({ lastDetection: detection });

    if (confidence >= threshold) {
      incrementStat('threats');

      chrome.notifications.create(`threat-${Date.now()}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Deepfake Detected',
        message: `${confidence}% — ${result.verdict || 'Potential manipulation detected'}`,
        priority: 2,
        requireInteraction: true,
      });

      if (tabId) {
        chrome.tabs.sendMessage(tabId, {
          type: 'ALERT_DEEPFAKE',
          confidence,
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
    const confidence = result.confidence || 0;

    const detection = {
      time: Date.now(),
      confidence,
      verdict: result.verdict || 'Audio analyzing...',
      source: 'audio',
      provider: result.provider || 'local',
      isDeepfake: confidence >= threshold,
    };
    chrome.storage.local.set({ lastDetection: detection });

    if (confidence >= threshold) {
      incrementStat('threats');

      chrome.notifications.create(`audio-threat-${Date.now()}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Audio Deepfake Detected',
        message: `Voice manipulation — ${confidence}% confidence`,
        priority: 2,
        requireInteraction: true,
      });

      if (tabId) {
        chrome.tabs.sendMessage(tabId, {
          type: 'ALERT_DEEPFAKE',
          confidence,
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
  const res = await fetch(dataUrl);
  const blob = await res.blob();

  const formData = new FormData();
  formData.append('image', blob, 'frame.jpg');
  if (source) formData.append('source', source);

  const headers = {};
  if (apiToken) headers['Authorization'] = `Bearer ${apiToken}`;

  const resp = await fetch(`${apiBase}/api/detect/image`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${resp.status}`);
  }

  const data = await resp.json();
  return data.data || data;
}

async function detectAudio(audioData) {
  const binary = atob(audioData);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const blob = new Blob([bytes], { type: 'audio/wav' });
  const formData = new FormData();
  formData.append('audio', blob, 'audio.wav');

  const headers = {};
  if (apiToken) headers['Authorization'] = `Bearer ${apiToken}`;

  const resp = await fetch(`${apiBase}/api/detect/audio`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${resp.status}`);
  }

  const data = await resp.json();
  return data.data || data;
}

/* ─── Stats ─── */
function incrementStat(key) {
  chrome.storage.local.get('stats', (data) => {
    const stats = data.stats || { scans: 0, threats: 0, audioScans: 0 };
    stats[key] = (stats[key] || 0) + 1;
    chrome.storage.local.set({ stats });
  });
}
