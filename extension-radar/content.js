(function() {
  'use strict';
  
  let settings = { enabled: true, sensitivity: 'medium', showBadge: true };
  let stats = { scanned: 0, threats: 0 };
  
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (res) => {
    if (res) settings = res;
  });
  
  const observer = new MutationObserver((mutations) => {
    if (!settings.enabled) return;
    
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1) {
          processNode(node);
        }
      }
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
  
  function processNode(node) {
    const images = node.querySelectorAll ? 
      node.querySelectorAll('img[src*="instagram"], img[src*="tiktok"], img[src*="twitter"], img[src*="pbs.twimg"], img[src*="fbcdn"]') :
      [];
    
    images.forEach(analyzeImage);
    
    if (node.tagName === 'IMG' && node.src) {
      analyzeImage(node);
    }
  }
  
  function analyzeImage(img) {
    if (img.dataset.radarAnalyzed) return;
    if (!img.src || img.width < 100 || img.height < 100) return;
    
    img.dataset.radarAnalyzed = 'pending';
    
    chrome.runtime.sendMessage({
      type: 'ANALYZE_IMAGE',
      url: img.src,
      source: window.location.hostname,
    }, (response) => {
      if (chrome.runtime.lastError || !response || !response.result) {
        img.dataset.radarAnalyzed = 'error';
        return;
      }
      
      const result = response.result;
      stats.scanned++;
      
      if (result.verdict === 'SUSPICIOUS' || result.confidence > 60) {
        stats.threats++;
        showBadge(img, result);
      } else {
        img.dataset.radarAnalyzed = 'safe';
      }
      
      chrome.runtime.sendMessage({ type: 'UPDATE_STATS', stats });
    });
  }
  
  function showBadge(img, result) {
    img.dataset.radarAnalyzed = 'threat';
    
    const badge = document.createElement('div');
    badge.className = 'enclave-radar-badge';
    badge.innerHTML = `
      <div class="enclave-radar-badge-inner">
        <span class="enclave-radar-icon">⚠</span>
        <span class="enclave-radar-text">${Math.round(result.confidence)}% risk</span>
      </div>
    `;
    
    const parent = img.parentElement;
    if (parent) {
      parent.style.position = 'relative';
      parent.appendChild(badge);
    }
    
    badge.addEventListener('mouseenter', () => {
      showTooltip(badge, result);
    });
    badge.addEventListener('mouseleave', () => {
      const tooltip = document.querySelector('.enclave-radar-tooltip');
      if (tooltip) tooltip.remove();
    });
  }
  
  function showTooltip(badge, result) {
    const tooltip = document.createElement('div');
    tooltip.className = 'enclave-radar-tooltip';
    tooltip.innerHTML = `
      <strong>ENCLAVE Deepfake Radar</strong><br>
      Verdict: ${result.verdict}<br>
      Confidence: ${Math.round(result.confidence)}%<br>
      ${result.indicators?.length ? '<br>Indicators:<br>' + result.indicators.map(i => '• ' + i).join('<br>') : ''}
    `;
    badge.appendChild(tooltip);
  }
})();