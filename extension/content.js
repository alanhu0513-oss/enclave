(function () {
  "use strict";

  let shieldEnabled = true;
  let overlay = null;
  let lastAlertTime = 0;

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "CAPTURE_FRAME" && shieldEnabled) {
      captureVideoFrame();
      sendResponse({ ok: true });
    }

    if (msg.type === "ALERT_DEEPFAKE") {
      showDeepfakeAlert(msg.confidence);
      sendResponse({ ok: true });
    }

    if (msg.type === "SHIELD_STATUS") {
      shieldEnabled = msg.active;
      if (overlay) {
        overlay.style.display = shieldEnabled ? "flex" : "none";
      }
      sendResponse({ ok: true });
    }
  });

  function captureVideoFrame() {
    const videos = document.querySelectorAll("video");
    if (videos.length === 0) return;

    const remoteVideo = findRemoteVideo(videos);
    if (!remoteVideo) return;

    const canvas = document.createElement("canvas");
    canvas.width = 299;
    canvas.height = 299;
    const ctx = canvas.getContext("2d");

    const vw = remoteVideo.videoWidth;
    const vh = remoteVideo.videoHeight;
    const size = Math.min(vw, vh);
    const sx = (vw - size) / 2;
    const sy = (vh - size) / 2;

    ctx.drawImage(remoteVideo, sx, sy, size, size, 0, 0, 299, 299);
    const imageData = canvas.toDataURL("image/jpeg", 0.8);

    chrome.runtime.sendMessage({
      type: "FRAME_CAPTURED",
      imageData,
      tabId: chrome.runtime.id
    });
  }

  function findRemoteVideo(videos) {
    for (const v of videos) {
      if (v.videoWidth > 100 && v.videoHeight > 100 && !v.muted) {
        return v;
      }
    }
    for (const v of videos) {
      if (v.videoWidth > 100 && v.videoHeight > 100) {
        return v;
      }
    }
    return null;
  }

  function showDeepfakeAlert(confidence) {
    const now = Date.now();
    if (now - lastAlertTime < 10000) return;
    lastAlertTime = now;

    if (overlay) overlay.remove();

    overlay = document.createElement("div");
    overlay.id = "enclave-shield-alert";
    overlay.innerHTML = `
      <div class="shield-alert-content">
        <div class="shield-alert-icon">⚠️</div>
        <div class="shield-alert-text">
          <strong>Deepfake Detected</strong>
          <span>Confidence: ${confidence.toFixed(1)}%</span>
        </div>
        <button class="shield-alert-dismiss" onclick="this.parentElement.parentElement.remove()">Dismiss</button>
      </div>
    `;
    document.body.appendChild(overlay);

    try {
      const audio = new Audio(chrome.runtime.getURL("sounds/alert.mp3"));
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch (e) {}
  }

  function createShieldIndicator() {
    if (document.getElementById("enclave-shield-indicator")) return;

    const indicator = document.createElement("div");
    indicator.id = "enclave-shield-indicator";
    indicator.innerHTML = `
      <div class="shield-badge">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <span>Shield Active</span>
      </div>
    `;
    document.body.appendChild(indicator);
  }

  const observer = new MutationObserver(() => {
    if (shieldEnabled && !document.getElementById("enclave-shield-indicator")) {
      createShieldIndicator();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  chrome.storage.local.get(["shieldEnabled"], (data) => {
    shieldEnabled = data.shieldEnabled !== false;
    if (shieldEnabled) {
      createShieldIndicator();
    }
  });
})();
