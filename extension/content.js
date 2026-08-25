/* ─── Enclave Extension — Content Script ─── */

(function() {
  'use strict';

  const BADGE_CLASS = 'enclave-badge';
  const SCANNED_ATTR = 'data-enclave-scanned';
  let autoScanEnabled = false;
  let scanQueue = [];
  let scanning = false;

  /* ─── Badge Rendering ─── */

  function createBadge(verdict, confidence, faceCount) {
    const existing = document.createElement('div');
    existing.className = BADGE_CLASS;

    let color, icon, label;
    if (verdict === 'LIKELY_SYNTHETIC') {
      color = '#e94560';
      icon = '⚠️';
      label = `${Math.round(confidence)}%`;
    } else if (verdict === 'SUSPICIOUS') {
      color = '#f0ad4e';
      icon = '?';
      label = `${Math.round(confidence)}%`;
    } else if (verdict === 'LIKELY_NATURAL') {
      color = '#28a745';
      icon = '✓';
      label = 'OK';
    } else if (verdict === 'ERROR') {
      color = '#6c757d';
      icon = '✗';
      label = 'ERR';
    } else {
      color = '#6c757d';
      icon = '…';
      label = 'WAIT';
    }

    return Object.assign(existing, {
      innerHTML: `
        <span class="enclave-badge-icon">${icon}</span>
        <span class="enclave-badge-label">${label}</span>
        ${faceCount ? `<span class="enclave-badge-faces">${faceCount} face${faceCount > 1 ? 's' : ''}</span>` : ''}
      `,
      style: `
        background: ${color};
        position: absolute;
        top: 4px;
        right: 4px;
        z-index: 999999;
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        display: flex;
        align-items: center;
        gap: 3px;
        pointer-events: none;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      `,
    });
  }

  function addBadgeToImage(img, verdict, confidence, faceCount) {
    const container = img.parentElement;
    if (!container) return;

    // Make container positioned if not already
    const pos = getComputedStyle(container).position;
    if (pos === 'static') container.style.position = 'relative';

    // Remove existing badge
    const existing = container.querySelector(`.${BADGE_CLASS}`);
    if (existing) existing.remove();

    const badge = createBadge(verdict, confidence, faceCount);
    container.appendChild(badge);

    // Auto-remove after 10s for natural results
    if (verdict === 'LIKELY_NATURAL') {
      setTimeout(() => badge.remove(), 10000);
    }
  }

  function showResultOverlay(img, result) {
    // Remove any existing overlay
    const existing = img.parentElement?.querySelector('.enclave-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'enclave-overlay';

    const isSynthetic = result.verdict === 'LIKELY_SYNTHETIC';
    const isSuspicious = result.verdict === 'SUSPICIOUS';
    const borderColor = isSynthetic ? '#e94560' : isSuspicious ? '#f0ad4e' : '#28a745';

    overlay.innerHTML = `
      <div class="enclave-overlay-content" style="border-left: 3px solid ${borderColor};">
        <div class="enclave-overlay-header">
          <strong>🛡️ Enclave</strong>
          <span class="enclave-overlay-verdict" style="color: ${borderColor};">${result.verdict?.replace('_', ' ') || 'UNKNOWN'}</span>
        </div>
        <div class="enclave-overlay-body">
          <div>Confidence: <strong>${result.confidence}%</strong></div>
          ${result.faceCount ? `<div>Faces detected: <strong>${result.faceCount}</strong></div>` : ''}
          ${result.mlScore !== null && result.mlScore !== undefined ? `<div>ML score: <strong>${result.mlScore}</strong></div>` : ''}
        </div>
        <div class="enclave-overlay-actions">
          ${isSynthetic || isSuspicious ? '<button class="enclave-btn-danger" data-action="report">🚨 Report for Takedown</button>' : ''}
          <button class="enclave-btn-secondary" data-action="close">Close</button>
        </div>
      </div>
    `;

    // Position near the image
    const rect = img.getBoundingClientRect();
    const container = img.parentElement;
    container.style.position = 'relative';
    overlay.style.cssText = `
      position: absolute;
      top: ${rect.height + 4}px;
      left: 0;
      z-index: 9999999;
      min-width: 220px;
      max-width: 280px;
    `;
    container.appendChild(overlay);

    // Event listeners
    overlay.querySelector('[data-action="close"]')?.addEventListener('click', () => overlay.remove());
    overlay.querySelector('[data-action="report"]')?.addEventListener('click', () => {
      const srcUrl = img.src || img.dataset.src;
      chrome.runtime.sendMessage({ type: 'REPORT_TAKEDOWN', imageUrl: srcUrl });
      overlay.remove();
    });

    // Auto-remove after 15s
    setTimeout(() => overlay.remove(), 15000);
  }

  /* ─── Page Scanning ─── */

  function getVisibleImages() {
    return Array.from(document.querySelectorAll('img')).filter(img => {
      if (img.hasAttribute(SCANNED_ATTR)) return false;
      if (img.width < 50 || img.height < 50) return false;
      if (img.src?.startsWith('data:')) return false;
      if (img.src?.includes('emoji') || img.src?.includes('icon') || img.src?.includes('avatar')) return false;
      if (img.src?.includes('logo') || img.src?.includes('badge')) return false;
      const rect = img.getBoundingClientRect();
      return rect.top < window.innerHeight + 200 && rect.bottom > -200;
    });
  }

  async function scanPageImages() {
    const images = getVisibleImages();
    if (!images.length) return;

    for (const img of images) {
      img.setAttribute(SCANNED_ATTR, 'pending');
      scanQueue.push(img);
    }
    processScanQueue();
  }

  async function processScanQueue() {
    if (scanning || !scanQueue.length) return;
    scanning = true;

    while (scanQueue.length) {
      const img = scanQueue.shift();
      if (!img.src) continue;

      try {
        const result = await scanImageViaContentScript(img.src);
        if (result && !result.error) {
          addBadgeToImage(img, result.verdict, result.confidence, result.faceCount);
          img.setAttribute(SCANNED_ATTR, result.verdict);
        } else {
          img.setAttribute(SCANNED_ATTR, 'error');
        }
      } catch {
        img.setAttribute(SCANNED_ATTR, 'error');
      }

      // Throttle: 500ms between scans
      await new Promise(r => setTimeout(r, 500));
    }

    scanning = false;
  }

  async function scanImageViaContentScript(imageUrl) {
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'SCAN_IMAGE_FROM_POPUP',
        imageUrl,
      });
      return result;
    } catch {
      return { error: 'Extension context invalidated' };
    }
  }

  /* ─── Message Handler ─── */

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'SCAN_RESULT') {
      const img = document.querySelector(`img[src="${msg.imageUrl}"]`);
      if (img) {
        addBadgeToImage(img, msg.verdict, msg.confidence, msg.faceCount);
        showResultOverlay(img, msg);
      }
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === 'SCAN_PAGE') {
      autoScanEnabled = true;
      scanPageImages();
      sendResponse({ ok: true, scanned: getVisibleImages().length });
      return true;
    }

    if (msg.type === 'TAKEDOWN_RESULT') {
      const img = document.querySelector(`img[src="${msg.imageUrl}"]`);
      if (img) {
        const container = img.parentElement;
        const notice = document.createElement('div');
        notice.className = 'enclave-takedown-notice';
        notice.innerHTML = msg.error
          ? `⚠️ Takedown failed: ${msg.error}`
          : `✅ Takedown notice prepared (ID: ${msg.takedownId?.slice(0, 8)})`;
        notice.style.cssText = `
          position: absolute; bottom: 4px; left: 4px; z-index: 999999;
          background: ${msg.error ? '#f0ad4e' : '#28a745'}; color: white;
          padding: 4px 8px; border-radius: 4px; font-size: 11px;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        `;
        container.style.position = 'relative';
        container.appendChild(notice);
        setTimeout(() => notice.remove(), 8000);
      }
      sendResponse({ ok: true });
      return true;
    }
  });

  /* ─── Auto-scan on scroll (opt-in) ─── */

  let scrollTimeout;
  window.addEventListener('scroll', () => {
    if (!autoScanEnabled) return;
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const newImages = getVisibleImages();
      if (newImages.length > 0) {
        for (const img of newImages) {
          img.setAttribute(SCANNED_ATTR, 'pending');
          scanQueue.push(img);
        }
        processScanQueue();
      }
    }, 1000);
  }, { passive: true });

})();
