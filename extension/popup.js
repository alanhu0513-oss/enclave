document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("shieldToggle");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const scanCount = document.getElementById("scanCount");
  const threatCount = document.getElementById("threatCount");
  const blockCount = document.getElementById("blockCount");
  const lastDetection = document.getElementById("lastDetection");
  const sensBtns = document.querySelectorAll(".sens-btn");

  chrome.runtime.sendMessage({ type: "GET_STATUS" }, (res) => {
    if (!res) return;
    updateUI(res.active, res.sensitivity, res.stats, res.lastDetection);
  });

  toggle.addEventListener("click", () => {
    const isActive = toggle.classList.contains("on");
    chrome.runtime.sendMessage({ type: "TOGGLE_SHIELD", active: !isActive }, (res) => {
      if (res) updateUI(res.active);
    });
  });

  sensBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      sensBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      chrome.runtime.sendMessage({ type: "SET_SENSITIVITY", sensitivity: btn.dataset.level });
    });
  });

  function updateUI(active, sensitivity, stats, lastDet) {
    toggle.classList.toggle("on", active);
    statusDot.classList.toggle("off", !active);
    statusText.textContent = active ? "Active" : "Paused";
    statusText.style.color = active ? "#00c896" : "#666";

    if (stats) {
      scanCount.textContent = stats.scans || 0;
      threatCount.textContent = stats.threats || 0;
      blockCount.textContent = stats.blocked || 0;
    }

    if (sensitivity) {
      sensBtns.forEach((b) => {
        b.classList.toggle("active", b.dataset.level === sensitivity);
      });
    }

    if (lastDet && lastDet.time) {
      const isDanger = lastDet.isDeepfake;
      lastDetection.className = `last-detection ${isDanger ? "danger" : "safe"}`;
      lastDetection.innerHTML = `
        <div class="ld-header">
          <span class="ld-icon">${isDanger ? "⚠️" : "🛡️"}</span>
          <span class="ld-text">${isDanger ? "Threat detected" : "No threats detected"}</span>
        </div>
        <div class="ld-time">Confidence: ${(lastDet.confidence || 0).toFixed(1)}% · ${timeAgo(lastDet.time)}</div>
      `;
    }
  }

  function timeAgo(ts) {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  }
});
