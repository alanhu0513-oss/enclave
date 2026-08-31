let apiToken = null;
let settings = {
  enabled: true,
  sensitivity: 'medium',
  showBadge: true,
  autoScan: true,
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
});

async function analyzeImage(imageUrl, source) {
  try {
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    const hash = computeHash(bytes.slice(0, 1024));
    const variance = computeVariance(bytes);
    
    let confidence = 50;
    let verdict = 'UNCERTAIN';
    
    if (variance < 1000) {
      confidence = 75;
      verdict = 'SUSPICIOUS';
    } else if (variance > 5000) {
      confidence = 30;
      verdict = 'LIKELY_AUTHENTIC';
    }
    
    return {
      confidence,
      verdict,
      indicators: variance < 1000 ? ['Low variance - possible manipulation'] : [],
      source,
      timestamp: Date.now(),
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