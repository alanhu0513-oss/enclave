/* ─── ENCLAVE Video Call Shield — Content Script ─── */

(function() {
  'use strict';

  let lastAlertTime = 0;
  const ALERT_COOLDOWN = 10000;
  let shieldIndicator = null;
  let alertOverlay = null;
  let audioContext = null;
  let mediaStream = null;
  let audioWorkletNode = null;

  /* ─── Video Element Detection (multi-participant) ─── */
  function findRemoteVideos() {
    const allVideos = Array.from(document.querySelectorAll('video'));
    const remote = [];

    for (const video of allVideos) {
      const w = video.videoWidth || video.clientWidth;
      const h = video.videoHeight || video.clientHeight;
      if (w < 80 || h < 80) continue;

      // Skip local preview (muted + small, or has 'local' in class/id)
      const isLocal = video.muted ||
        video.classList.toString().toLowerCase().includes('local') ||
        (video.id || '').toLowerCase().includes('local') ||
        (video.id || '').toLowerCase().includes('self') ||
        (video.id || '').toLowerCase().includes('preview');

      if (!isLocal) {
        remote.push(video);
      }
    }

    // Fallback: if no unmuted videos found, use any large video
    if (remote.length === 0) {
      for (const video of allVideos) {
        const w = video.videoWidth || video.clientWidth;
        const h = video.videoHeight || video.clientHeight;
        if (w >= 80 && h >= 80) remote.push(video);
      }
    }

    return remote;
  }

  /* ─── Frame Capture ─── */
  function captureFrame(video) {
    const canvas = document.createElement('canvas');
    canvas.width = 299;
    canvas.height = 299;
    const ctx = canvas.getContext('2d');

    // Cover-fit the video frame
    const vw = video.videoWidth || video.clientWidth;
    const vh = video.videoHeight || video.clientHeight;
    const scale = Math.max(299 / vw, 299 / vh);
    const sw = vw * scale;
    const sh = vh * scale;
    ctx.drawImage(video, (299 - sw) / 2, (299 - sh) / 2, sw, sh);

    return canvas.toDataURL('image/jpeg', 0.8);
  }

  /* ─── Audio Capture (via tabCapture) ─── */
  function startAudioCapture() {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });

      // Request tab capture from background
      chrome.runtime.sendMessage({ type: 'START_AUDIO_CAPTURE' });
    } catch (e) {
      console.warn('[Shield] Audio capture not available:', e.message);
    }
  }

  // Listen for audio stream from background (via tabCapture)
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'AUDIO_STREAM_READY' && msg.streamId) {
      setupAudioProcessing(msg.streamId);
    }
  });

  function setupAudioProcessing(streamId) {
    try {
      navigator.mediaDevices.getUserMedia({
        audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } }
      }).then((stream) => {
        mediaStream = stream;
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);

        let audioBuffer = [];
        const BUFFER_DURATION = 3; // seconds
        const SAMPLE_RATE = 16000;
        const CHUNK_SIZE = SAMPLE_RATE * BUFFER_DURATION;

        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          audioBuffer.push(...inputData);

          if (audioBuffer.length >= CHUNK_SIZE) {
            const chunk = audioBuffer.splice(0, CHUNK_SIZE);
            const base64 = float32ToBase64(chunk);
            chrome.runtime.sendMessage({
              type: 'AUDIO_CHUNK',
              audioData: base64,
            });
          }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
      }).catch(() => {});
    } catch (_) {}
  }

  function float32ToBase64(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    const bytes = new Uint8Array(int16Array.buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /* ─── Round-Robin Multi-Participant Scan ─── */
  let participantIndex = 0;

  function scanNextParticipant() {
    const videos = findRemoteVideos();
    if (videos.length === 0) return null;

    const idx = participantIndex % videos.length;
    participantIndex = (participantIndex + 1) % videos.length;
    return videos[idx];
  }

  /* ─── Message Handler ─── */
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'CAPTURE_FRAME') {
      const video = scanNextParticipant();
      if (video) {
        const dataUrl = captureFrame(video);
        const source = `participant-${participantIndex}`;
        chrome.runtime.sendMessage({ type: 'FRAME_CAPTURED', dataUrl, source });
      }
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === 'ALERT_DEEPFAKE') {
      showDeepfakeAlert(msg.confidence, msg.verdict, msg.source);
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === 'START_AUDIO_CAPTURE') {
      startAudioCapture();
      sendResponse({ ok: true });
      return true;
    }
  });

  /* ─── UI Overlays ─── */
  function createShieldIndicator() {
    if (shieldIndicator) return;
    shieldIndicator = document.createElement('div');
    shieldIndicator.id = 'enclave-shield-indicator';
    shieldIndicator.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
      <span>Shield Active</span>
    `;
    document.body.appendChild(shieldIndicator);
  }

  function removeShieldIndicator() {
    if (shieldIndicator) { shieldIndicator.remove(); shieldIndicator = null; }
  }

  function showDeepfakeAlert(confidence, verdict, source) {
    const now = Date.now();
    if (now - lastAlertTime < ALERT_COOLDOWN) return;
    lastAlertTime = now;

    if (alertOverlay) alertOverlay.remove();

    alertOverlay = document.createElement('div');
    alertOverlay.id = 'enclave-shield-alert';
    const sourceLabel = source === 'audio' ? 'Audio' : 'Video';
    alertOverlay.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:20px;">⚠️</span>
        <div>
          <div style="font-weight:700;font-size:14px;">Deepfake Detected — ${sourceLabel}</div>
          <div style="font-size:12px;opacity:0.8;">Confidence: ${confidence}% — ${verdict || 'Potential manipulation'}</div>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" style="background:none;border:none;color:white;font-size:18px;cursor:pointer;padding:4px 8px;">✕</button>
      </div>
    `;
    document.body.appendChild(alertOverlay);

    // Auto-dismiss after 15s
    setTimeout(() => { if (alertOverlay) alertOverlay.remove(); }, 15000);
  }

  /* ─── Init ─── */
  chrome.storage.local.get('shieldActive', (data) => {
    if (data.shieldActive) createShieldIndicator();
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.shieldActive) {
      if (changes.shieldActive.newValue) {
        createShieldIndicator();
      } else {
        removeShieldIndicator();
        if (alertOverlay) alertOverlay.remove();
      }
    }
  });
})();
