let apiToken = null;
let settings = {
  enabled: true,
  sensitivity: 'medium',
  showBadge: true,
  autoScan: true,
  useApi: true,
  apiBase: 'https://enclave-production-d818.up.railway.app',
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ settings, stats: { scanned: 0, threats: 0 } });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'ANALYZE_IMAGE') {
    analyzeImage(msg.url, msg.source)
      .then(result => sendResponse({ result }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
  
  if (msg.type === 'GET_SETTINGS') {
    chrome.storage.local.get('settings', (data) => {
      sendResponse(data.settings || settings);
    });
    return true;
  }
  
  if (msg.type === 'UPDATE_SETTINGS') {
    settings = { ...settings, ...msg.settings };
    chrome.storage.local.set({ settings });
    sendResponse({ ok: true });
  }
  
  if (msg.type === 'GET_STATS') {
    chrome.storage.local.get('stats', (data) => {
      sendResponse(data.stats || { scanned: 0, threats: 0 });
    });
    return true;
  }

  if (msg.type === 'SET_TOKEN') {
    apiToken = msg.token;
    sendResponse({ ok: true });
  }
});

async function analyzeImage(imageUrl, source) {
  // Try API first if enabled and token available
  if (settings.useApi && apiToken) {
    try {
      return await analyzeViaApi(imageUrl, source);
    } catch (e) {
      console.warn('[Radar] API failed, falling back to local:', e.message);
    }
  }

  // Local heuristic fallback
  return analyzeLocal(imageUrl, source);
}

async function analyzeViaApi(imageUrl, source) {
  const response = await fetch(imageUrl);
  const blob = await response.blob();

  const formData = new FormData();
  formData.append('image', blob, 'radar-scan.jpg');

  const apiResp = await fetch(`${settings.apiBase}/api/detect/image`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiToken}` },
    body: formData,
  });

  if (!apiResp.ok) throw new Error(`API ${apiResp.status}`);
  const data = await apiResp.json();

  return {
    confidence: data.data?.confidence || data.confidence || 50,
    verdict: data.data?.verdict || data.verdict || 'UNCERTAIN',
    indicators: data.data?.indicators || [],
    source,
    timestamp: Date.now(),
    viaApi: true,
  };
}

async function analyzeLocal(imageUrl, source) {
  try {
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    const hash = computeHash(bytes.slice(0, 1024));
    const variance = computeVariance(bytes);
    
    const sensitivityThresholds = {
      low: { suspicious: 800, authentic: 6000 },
      medium: { suspicious: 1000, authentic: 5000 },
      high: { suspicious: 1500, authentic: 4000 },
    };
    const thresholds = sensitivityThresholds[settings.sensitivity] || sensitivityThresholds.medium;
    
    let confidence = 50;
    let verdict = 'UNCERTAIN';
    let indicators = [];
    
    if (variance < thresholds.suspicious) {
      confidence = 75;
      verdict = 'SUSPICIOUS';
      indicators = ['Low byte variance — possible manipulation'];
    } else if (variance > thresholds.authentic) {
      confidence = 30;
      verdict = 'LIKELY_AUTHENTIC';
    }
    
    return {
      confidence,
      verdict,
      indicators,
      source,
      timestamp: Date.now(),
      viaApi: false,
    };
  } catch (e) {
    return { confidence: 0, verdict: 'ERROR', error: e.message };
  }
}

function computeHash(bytes) {
  let hash = 0;
  for (let i = 0; i < bytes.length; i++) {
    hash = ((hash << 5) - hash + bytes[i]) | 0;
  }
  return hash;
}

function computeVariance(bytes) {
  const sample = bytes.slice(0, 256);
  const mean = sample.reduce((a, b) => a + b, 0) / sample.length;
  return sample.reduce((a, b) => a + (b - mean) ** 2, 0) / sample.length;
}
