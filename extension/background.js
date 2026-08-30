const API_BASE = "https://enclave-production-d818.up.railway.app";

let isShieldActive = false;
let detectionInterval = null;
let lastDetection = null;
let stats = { scans: 0, threats: 0, startTime: null };

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    shieldEnabled: true,
    sensitivity: "medium",
    alertSound: true,
    autoBlock: false,
    stats: { scans: 0, threats: 0, blocked: 0 }
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "TOGGLE_SHIELD") {
    isShieldActive = msg.active;
    chrome.storage.local.set({ shieldEnabled: isShieldActive });
    if (isShieldActive) {
      startDetection(sender.tab?.id);
    } else {
      stopDetection();
    }
    sendResponse({ active: isShieldActive });
  }

  if (msg.type === "GET_STATUS") {
    chrome.storage.local.get(["shieldEnabled", "sensitivity", "stats"], (data) => {
      sendResponse({
        active: isShieldActive,
        sensitivity: data.sensitivity || "medium",
        stats: data.stats || stats,
        lastDetection
      });
    });
    return true;
  }

  if (msg.type === "FRAME_CAPTURED") {
    analyzeFrame(msg.imageData, msg.tabId);
    sendResponse({ ok: true });
  }

  if (msg.type === "SET_SENSITIVITY") {
    chrome.storage.local.set({ sensitivity: msg.sensitivity });
    sendResponse({ ok: true });
  }

  if (msg.type === "GET_HISTORY") {
    chrome.storage.local.get(["detectionHistory"], (data) => {
      sendResponse({ history: data.detectionHistory || [] });
    });
    return true;
  }
});

function startDetection(tabId) {
  if (detectionInterval) return;
  stats.startTime = Date.now();
  detectionInterval = setInterval(() => {
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { type: "CAPTURE_FRAME" }).catch(() => {});
    }
  }, 2000);
}

function stopDetection() {
  if (detectionInterval) {
    clearInterval(detectionInterval);
    detectionInterval = null;
  }
}

async function analyzeFrame(imageData, tabId) {
  try {
    const response = await fetch(`${API_BASE}/api/detect/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageData, source: "video_call_shield" })
    });

    if (!response.ok) return;

    const result = await response.json();
    const confidence = result.confidence || 0;
    const sensitivity = await getSensitivity();
    const threshold = sensitivity === "high" ? 60 : sensitivity === "medium" ? 75 : 85;

    stats.scans++;
    lastDetection = {
      time: Date.now(),
      confidence,
      isDeepfake: confidence >= threshold,
      result
    };

    chrome.storage.local.set({ stats });

    if (confidence >= threshold) {
      stats.threats++;
      chrome.storage.local.set({ stats, lastDetection });

      chrome.notifications.create(`deepfake-${Date.now()}`, {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "⚠️ Deepfake Detected",
        message: `Confidence: ${confidence.toFixed(1)}%. Possible AI impersonation detected in this video call.`,
        priority: 2,
        requireInteraction: true
      });

      if (tabId) {
        chrome.tabs.sendMessage(tabId, {
          type: "ALERT_DEEPFAKE",
          confidence,
          result
        });
      }
    }
  } catch (err) {
    console.error("[Shield] Detection error:", err);
  }
}

async function getSensitivity() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["sensitivity"], (data) => {
      resolve(data.sensitivity || "medium");
    });
  });
}
