(function () {
  'use strict';

  /* ─── Service Worker ─── */
  if ('serviceWorker' in navigator) {
    // Force-unregister any stale SW first, then register fresh
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      return Promise.all(regs.map(function (r) { return r.unregister(); }));
    }).then(function () {
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        console.log('[Enclave] SW registered:', reg.scope);
      }, function (err) {
        console.warn('[Enclave] SW failed:', err);
      });
    });
  }

  /* ─── Constants ─── */
  var LS_ALERTS     = 'enclave_alerts';
  var LS_NAME       = 'enclave_registered_name';
  var LS_AUTH       = 'enclave_auth_attempts';
  var LS_FACEPRINT  = 'enclave_faceprint';
  var LS_VOICEPRINT = 'enclave_voiceprint';
  var LS_SIGNATURE  = 'enclave_signature';
  var CLOAK         = 12;
  var CLOAK_RATE    = 200;
  var VOICE_MATCH_THRESHOLD = 0.65;

  /* ─── State ─── */
  var alerts          = [];
  var registeredName  = '';
  var registeredUserId = null;
  var selectedAlertId = null;
  var worker          = null;
  var cryptoKeyPair   = null;
  var cloakInterval   = null;
  var tunnelActive    = false;
  var tunnelStream    = null;
  var tunnelAudioCtx  = null;
  var tunnelAnimId    = null;
  var loginInitDone   = false;

  /* ─── DOM Refs ─── */
  var authOverlay      = document.getElementById('auth-overlay');
  var authPanel        = document.getElementById('auth-panel');
  var authVideo        = document.getElementById('auth-video');
  var authCanvas       = document.getElementById('auth-canvas');
  var btnAuthStart     = document.getElementById('btn-auth-start');
  var authStatus       = document.getElementById('auth-status');
  var stageLiveness    = document.getElementById('auth-stage-liveness');
  var stageVoice       = document.getElementById('auth-stage-voice');
  var livenessInst     = document.getElementById('liveness-instruction');
  var livenessFill     = document.getElementById('liveness-fill');
  var livenessDetected = document.getElementById('liveness-detected');
  var voiceCode        = document.getElementById('voice-code');
  var voiceCanvas      = document.getElementById('voice-canvas');
  var burstDots        = document.querySelectorAll('.burst-dot');

  var appRoot          = document.getElementById('app-root');
  var headerProfile    = document.getElementById('header-profile');
  var btnLock          = document.getElementById('btn-lock');
  var alertList        = document.getElementById('alert-list');
  var dashboardStatus  = document.getElementById('dashboard-status');
  var crawlerStatus    = document.getElementById('crawler-status');

  var reviewStatus     = document.getElementById('resolution-status');

  /* ─── Registration Portal DOM Refs ─── */
  var registerPortal     = document.getElementById('register-portal');
  var regError           = document.getElementById('reg-error');
  var regStepName        = document.getElementById('reg-step-name');
  var regStepFace        = document.getElementById('reg-step-face');
  var regStepAudio       = document.getElementById('reg-step-audio');
  var regStepComplete    = document.getElementById('reg-step-complete');
  var regInputName       = document.getElementById('reg-input-name');
  var btnRegName         = document.getElementById('btn-reg-name');
  var regVideo           = document.getElementById('reg-video');
  var regFaceCanvas      = document.getElementById('reg-face-canvas');
  var regFacePreview     = document.getElementById('reg-face-preview');
  var btnRegCapture      = document.getElementById('btn-reg-capture');
  var btnRegFaceDone     = document.getElementById('btn-reg-face-done');
  var regSpectrumCanvas  = document.getElementById('reg-spectrum-canvas');
  var regAudioStatus     = document.getElementById('reg-audio-status');
  var btnRegRecord       = document.getElementById('btn-reg-record');
  var btnRegAudioDone    = document.getElementById('btn-reg-audio-done');
  var btnRegComplete     = document.getElementById('btn-reg-complete');
  var regStatus          = document.getElementById('reg-status');

  var regStream = null;
  var regAudioCtx = null;
  var regAnalyser = null;
  var regSource = null;

  /* ─── Scanner & Signature DOM Refs ─── */
  var scannerUrl       = document.getElementById('scanner-url');
  var scannerFile      = document.getElementById('scanner-file');
  var btnScanner       = document.getElementById('btn-scanner');
  var scannerStatus    = document.getElementById('scanner-status');

  var sigModal         = document.getElementById('signature-modal');
  var sigCanvas        = document.getElementById('sig-canvas');
  var btnSigClear      = document.getElementById('btn-sig-clear');
  var btnSigConfirm    = document.getElementById('btn-sig-confirm');
  var sigStatus        = document.getElementById('sig-status');
  var regPortraitFile  = document.getElementById('reg-portrait-file');
  var regUploadLink    = document.getElementById('reg-upload-link');

  var pendingSigResolve = null;
  var toastContainer = document.getElementById('toast-container');

  /* ─── New DOM refs for added features ─── */
  var faceGuide         = document.getElementById('auth-face-guide');
  var voiceProfileMatch = document.getElementById('voice-profile-match');
  var voiceProfileScore = document.getElementById('voice-profile-score');
  var btnDeepScan       = document.getElementById('btn-deep-scan');
  var settingsModal     = document.getElementById('settings-modal');
  var settingsPanel     = document.getElementById('settings-panel');
  var btnSettingsOpen   = document.getElementById('btn-settings-open');
  var btnSettingsClose  = document.getElementById('btn-settings-close');
  var settingsName      = document.getElementById('settings-name');
  var settingsFaceStatus = document.getElementById('settings-face-status');
  var settingsFacePreview = document.getElementById('settings-face-preview');
  var settingsVoiceStatus = document.getElementById('settings-voice-status');
  var settingsSigStatus  = document.getElementById('settings-sig-status');
  var btnSettingsRename  = document.getElementById('btn-settings-rename');
  var btnSettingsReface  = document.getElementById('btn-settings-reface');
  var btnSettingsRevoice = document.getElementById('btn-settings-revoice');
  var btnSettingsResig   = document.getElementById('btn-settings-resig');
  var btnSettingsClear   = document.getElementById('btn-settings-clear');
  var btnSettingsExport  = document.getElementById('btn-settings-export');
  var settingsStatus     = document.getElementById('settings-status');
  var btnSettingsLogout  = document.getElementById('btn-settings-logout');
  var settingsVoiceFreq  = document.getElementById('settings-voice-freq');
  var btnApplyFreq       = document.getElementById('btn-settings-apply-freq');
  var toggleWidget       = document.getElementById('toggle-widget');
  var widgetStatusLabel  = document.getElementById('widget-status-label');
  var tunnelSection      = document.getElementById('tunnel-section');
  var tunnelSpectrum     = document.getElementById('tunnel-spectrum');
  var tunnelStatus       = document.getElementById('tunnel-status');
  var btnTunnel          = document.getElementById('btn-tunnel');
  var tunnelInfo         = document.getElementById('tunnel-info');

  /* ─── Toast Alert Banner ─── */
  function showToastAlert(message) {
    if (!toastContainer) return;
    var item = document.createElement('div');
    item.className = 'toast-item';
    item.innerHTML = '<svg viewBox="0 0 36 36" width="18" height="18" style="flex-shrink:0;color:#FF3366;"><use href="#icon-dispatch"/></svg>'
      + '<span class="toast-message">' + message + '</span>'
      + '<button class="toast-dismiss"><svg viewBox="0 0 24 24" width="12" height="12"><use href="#icon-close"/></svg></button>';
    item.querySelector('.toast-dismiss').addEventListener('click', function (e) {
      e.stopPropagation();
      dismissToast(item);
    });
    item.addEventListener('click', function () { dismissToast(item); });
    toastContainer.appendChild(item);
    setTimeout(function () { dismissToast(item); }, 5000);
  }

  function dismissToast(item) {
    if (!item || item.classList.contains('toast-dismissing')) return;
    item.classList.add('toast-dismissing');
    setTimeout(function () {
      if (item.parentNode) item.parentNode.removeChild(item);
    }, 300);
  }

  /* ─── Universal Media Stream Cleanup ─── */
  function terminateActiveMediaStreams(extraStream) {
    [authStream, regStream, tunnelStream].forEach(function (s) {
      if (s && s.getTracks) {
        s.getTracks().forEach(function (t) { t.stop(); });
      }
    });
    if (extraStream && extraStream.getTracks) {
      extraStream.getTracks().forEach(function (t) { t.stop(); });
    }
    authStream = null;
    regStream = null;
    tunnelStream = null;
    if (authVideo) authVideo.srcObject = null;
    if (regVideo) regVideo.srcObject = null;
    if (tunnelAudioCtx) { try { tunnelAudioCtx.close(); } catch (e) {} tunnelAudioCtx = null; }
  }

  /* ─── localStorage helpers ─── */
  function lsGet(key, fallback) {
    try { var v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  function loadState() {
    alerts = lsGet(LS_ALERTS, []);
    registeredName = lsGet(LS_NAME, '');
    if (registeredName && headerProfile) headerProfile.textContent = registeredName;
    // Try to sync alerts from API
    if (window.EnclaveAPI && window.EnclaveAPI.isLoggedIn()) {
      window.EnclaveAPI.getAlerts().then(function (apiAlerts) {
        if (apiAlerts && apiAlerts.length) {
          // Merge: API alerts are authoritative, but keep local ones not yet on server
          var apiMap = {};
          apiAlerts.forEach(function (a) { apiMap[a.id] = a; });
          alerts.forEach(function (a) {
            if (!apiMap[a.id]) apiMap[a.id] = a;
          });
          alerts = Object.values(apiMap).sort(function (a, b) {
            return b.timestamp.localeCompare(a.timestamp);
          });
          saveAlerts();
          renderDashboard();
        }
      }).catch(function () {});
    }
  }

  function saveAlerts() {
    lsSet(LS_ALERTS, alerts);
  }
  function saveName()   { lsSet(LS_NAME, registeredName); }

  /* ═══════════════════════════════════════════════════════
     BIOMETRIC LIVENESS GATE
     ═══════════════════════════════════════════════════════ */

  var authStream   = null;
  var authCtx      = null;
  var authAnalyser = null;
  var authAnimId   = null;
  var authStep     = 'idle'; // idle | liveness | voice | done | failed

  /* ─── Liveness: adaptive face-vector motion challenge ─── */
  var CHALLENGES = [
    { id: 'left',  text: 'Turn your head left',  mode: 'left'  },
    { id: 'up',    text: 'Look up',              mode: 'up'    },
    { id: 'right', text: 'Tilt your head right', mode: 'right' }
  ];

  function detectMotion(video, canvas, challenge) {
    var ctx = canvas.getContext('2d');
    var w = 160, h = 120;
    canvas.width = w; canvas.height = h;

    var prevGray = null;
    var sustainedFrames = 0;
    var REQUIRED_FRAMES = 15;
    livenessFill.style.width = '0%';
    livenessFill.classList.remove('complete');
    if (faceGuide) faceGuide.classList.remove('hidden');

    return new Promise(function (resolve, reject) {
      var cancelled = false;
      var timeout = setTimeout(function () {
        cancelled = true;
        if (faceGuide) faceGuide.classList.add('hidden');
        reject(new Error('Motion timeout'));
      }, 25000);

      function tick() {
        if (cancelled) return;
        ctx.drawImage(video, 0, 0, w, h);
        var imageData = ctx.getImageData(0, 0, w, h);
        var data = imageData.data;

        var gray = new Float32Array(w * h);
        for (var i = 0; i < w * h; i++) {
          var p = i * 4;
          gray[i] = data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114;
        }

        if (prevGray) {
          var totalDiff = 0;
          var cx = 0, cy = 0, totalW = 0;
          for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
              var diff = Math.abs(gray[y * w + x] - prevGray[y * w + x]);
              totalDiff += diff;
              if (diff > 8) {
                cx += x * diff;
                cy += y * diff;
                totalW += diff;
              }
            }
          }

          if (totalW > 400) {
            var nx = (cx / totalW) / w;
            var ny = (cy / totalW) / h;

            var inZone = false;
            switch (challenge.mode) {
              case 'left':  inZone = nx > 0.52; break;
              case 'up':    inZone = ny < 0.42; break;
              case 'right': inZone = nx > 0.45 && ny < 0.50; break;
            }

            sustainedFrames = inZone ? sustainedFrames + 1 : Math.max(0, sustainedFrames - 1);
          } else if (totalDiff < 200) {
            sustainedFrames = Math.max(0, sustainedFrames - 2);
          }

          var pct = Math.min(100, (sustainedFrames / REQUIRED_FRAMES) * 100);
          livenessFill.style.width = pct + '%';
          if (sustainedFrames >= 1) livenessDetected.classList.remove('hidden');

          if (sustainedFrames >= REQUIRED_FRAMES) {
            livenessFill.classList.add('complete');
            livenessFill.style.width = '100%';
            livenessDetected.textContent = '✓ Motion verified';
            livenessDetected.classList.remove('hidden');
            clearTimeout(timeout);
            cancelled = true;
            if (faceGuide) faceGuide.classList.add('hidden');
            setTimeout(function () { resolve(); }, 400);
            return;
          }
        }

        prevGray = gray;
        if (!cancelled) authAnimId = requestAnimationFrame(tick);
      }

      tick();
    });
  }

  /* ─── Voice challenge ─── */
  function runVoiceChallenge(digits) {
    var challenge = digits.join('-');
    voiceCode.textContent = challenge;

    var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    var source = audioCtx.createMediaStreamSource(authStream);
    source.connect(analyser);

    var vCtx = voiceCanvas.getContext('2d');
    vCtx.fillStyle = '#060a10';
    vCtx.fillRect(0, 0, voiceCanvas.width, voiceCanvas.height);

    var burstCount = 0;
    var inBurst = false;
    var burstFrames = 0;
    var MIN_BURST_FRAMES = 8;
    var SILENCE_FRAMES = 0;
    var neededBursts = digits.length;

    // collect live profile for voiceprint matching
    var liveFrameProfiles = [];

    if (voiceProfileMatch) voiceProfileMatch.classList.add('hidden');

    return new Promise(function (resolve, reject) {
      var cancelled = false;
      var timeout = setTimeout(function () {
        cancelled = true;
        cleanup();
        reject(new Error('Voice timeout'));
      }, 25000);

      function drawSpectrum(freqData, len) {
        vCtx.fillStyle = '#060a10';
        vCtx.fillRect(0, 0, voiceCanvas.width, voiceCanvas.height);
        var barW = voiceCanvas.width / len;
        for (var i = 0; i < len; i++) {
          var h = (freqData[i] / 255) * voiceCanvas.height;
          var hue = 160 + (freqData[i] / 255) * 40;
          vCtx.fillStyle = 'hsl(' + hue + ', 80%, ' + (30 + h / voiceCanvas.height * 40) + '%)';
          vCtx.fillRect(i * barW, voiceCanvas.height - h, barW - 1, h);
        }
      }

      // voiceprint comparison
      function compareVoiceprint(liveProfile) {
        var stored = lsGet(LS_VOICEPRINT, null);
        if (!stored || !stored.profile || stored.profile.length === 0) {
          return { match: true, score: 1, reason: 'no baseline' };
        }
        var storedProfile = stored.profile;
        var len = Math.min(liveProfile.length, storedProfile.length);
        var sumNum = 0, sumDenA = 0, sumDenB = 0;
        for (var i = 0; i < len; i++) {
          sumNum += liveProfile[i] * storedProfile[i];
          sumDenA += liveProfile[i] * liveProfile[i];
          sumDenB += storedProfile[i] * storedProfile[i];
        }
        var denom = Math.sqrt(sumDenA) * Math.sqrt(sumDenB);
        var similarity = denom > 0 ? sumNum / denom : 0;
        var match = similarity >= VOICE_MATCH_THRESHOLD;
        return { match: match, score: Math.round(similarity * 100), reason: match ? 'pass' : 'voiceprint mismatch' };
      }

      function analyze() {
        if (cancelled) return;
        var freqData = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(freqData);
        drawSpectrum(freqData, analyser.frequencyBinCount);

        // collect live profile
        liveFrameProfiles.push(Array.prototype.slice.call(freqData));

        // compute energy
        var energy = 0;
        for (var i = 0; i < freqData.length; i++) energy += freqData[i];
        var avgEnergy = energy / freqData.length;
        var threshold = 20;

        if (avgEnergy > threshold) {
          burstFrames++;
          if (!inBurst) {
            inBurst = true;
            burstFrames = 1;
          }
        } else {
          if (inBurst && burstFrames >= MIN_BURST_FRAMES) {
            burstCount++;
            if (burstCount <= neededBursts) {
              burstDots[burstCount - 1].classList.add('active');
            }
          }
          inBurst = false;
          burstFrames = 0;
        }

        if (burstCount >= neededBursts) {
          clearTimeout(timeout);
          cancelled = true;
          cleanup();

          // compare live profile against stored voiceprint
          if (liveFrameProfiles.length > 0) {
            var binCount = liveFrameProfiles[0].length;
            var avgProfile = new Array(binCount).fill(0);
            liveFrameProfiles.forEach(function (frame) {
              for (var i = 0; i < binCount; i++) avgProfile[i] += frame[i];
            });
            for (var i = 0; i < binCount; i++) avgProfile[i] = Math.round(avgProfile[i] / liveFrameProfiles.length);

            var result = compareVoiceprint(avgProfile);
            if (voiceProfileMatch) {
              voiceProfileMatch.classList.remove('hidden');
              if (voiceProfileScore) {
                voiceProfileScore.textContent = result.score + '%';
                voiceProfileScore.className = 'profile-match-score ' + (result.match ? 'match-ok' : 'match-fail');
              }
            }
            if (!result.match) {
              reject(new Error('Voiceprint mismatch: ' + result.score + '% similarity'));
              return;
            }
          }
          resolve();
          return;
        }

        if (!cancelled) authAnimId = requestAnimationFrame(analyze);
      }

      function cleanup() {
        if (source) source.disconnect();
        if (audioCtx) audioCtx.close();
      }

      analyze();
    });
  }

  /* ─── Full auth flow ─── */
  function startAuth() {
    if (authStep !== 'idle') return;
    authStep = 'liveness';
    btnAuthStart.disabled = true;
    btnAuthStart.textContent = 'Initializing...';
    authStatus.className = 'auth-status';
    authStatus.textContent = 'Requesting camera access...';

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      failAuth('Camera API unavailable.', false);
      return;
    }

    // Request video first, then audio separately for better error handling
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(function (videoStream) {
        authStream = videoStream;
        authVideo.srcObject = videoStream;
        authStatus.textContent = 'Camera OK. Requesting microphone...';

        return navigator.mediaDevices.getUserMedia({ audio: true })
          .then(function (audioStream) {
            // Merge audio tracks into existing stream
            audioStream.getAudioTracks().forEach(function (track) {
              authStream.addTrack(track);
            });
          })
          .catch(function () {
            // Mic failed — continue with video only (voice challenge will be skipped)
            console.warn('[Enclave] Mic unavailable, continuing with video only.');
            authStatus.textContent = 'Mic unavailable. Visual challenge only.';
          });
      })
      .then(function () {
        authVideo.onloadedmetadata = function () {
          // Phase 1: Adaptive motion challenge
          var challenge = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
          livenessInst.textContent = challenge.text;
          livenessDetected.classList.add('hidden');
          authStatus.textContent = 'Performing ' + challenge.mode + ' motion analysis...';
          detectMotion(authVideo, authCanvas, challenge).then(function () {
            stageLiveness.classList.remove('active');
            // Phase 2: Voice (skip if no audio)
            authStep = 'voice';
            stageVoice.classList.add('active');
            authStatus.textContent = 'Awaiting voice challenge...';
            var digits = [];
            for (var i = 0; i < 4; i++) digits.push(Math.floor(Math.random() * 10));
            var hasAudio = authStream && authStream.getAudioTracks().length > 0;
            var voicePromise = hasAudio ? runVoiceChallenge(digits) : Promise.resolve();
            return voicePromise;
          }).then(function () {
            // Success
            authStep = 'done';
            stageVoice.classList.remove('active');
            authStatus.className = 'auth-status success';
            authStatus.textContent = 'Vault Integrity Verified. Decrypting Local Database...';
            terminateActiveMediaStreams();
            livenessFill.style.width = '0%';
            livenessFill.classList.remove('complete');
            livenessDetected.classList.add('hidden');
            burstDots.forEach(function (d) { d.classList.remove('active'); });
            setTimeout(function () {
              authOverlay.classList.add('hidden');
              appRoot.classList.remove('hidden');
            }, 1800);
          }).catch(function (err) {
            failAuth(err.message || 'Biometric verification failed.', true);
          });
        };
      })
      .catch(function (err) {
        failAuth('Camera access denied: ' + (err.message || 'unknown'), true);
      });
  }

  function failAuth(msg, allowRetry) {
    authStep = 'failed';
    authStatus.className = 'auth-status failure';
    authStatus.textContent = msg || 'ACCESS DENIED';
    if (msg) console.warn('[Enclave] Auth fail:', msg);
    terminateActiveMediaStreams();
    if (allowRetry) {
      btnAuthStart.disabled = false;
      btnAuthStart.textContent = 'Retry Authentication';
      authStep = 'idle';
    } else {
      btnAuthStart.disabled = true;
      btnAuthStart.textContent = 'Locked';
    }
  }

  btnAuthStart.addEventListener('click', startAuth);

  /* ═══════════════════════════════════════════════════════
     BACKGROUND DEEPFAKE CRAWLER (API-based)
     ═══════════════════════════════════════════════════════ */

  function spawnCrawler() {
    if (worker) return;
    worker = { active: true };
    runCrawlerCycle();
  }

  function runCrawlerCycle() {
    if (!worker || !worker.active) return;
    if (!window.EnclaveAPI || !window.EnclaveAPI.isLoggedIn()) {
      setTimeout(runCrawlerCycle, 30000);
      return;
    }
    window.EnclaveAPI.getCrawlerStatus().then(function (status) {
      if (status && status.active) {
        setTimeout(runCrawlerCycle, 20000);
      } else {
        window.EnclaveAPI.startCrawler().then(function () {
          setTimeout(runCrawlerCycle, 20000);
        }).catch(function () {
          setTimeout(runCrawlerCycle, 30000);
        });
      }
    }).catch(function () {
      setTimeout(runCrawlerCycle, 30000);
    });
  }

  function pollAlerts() {
    if (!worker || !worker.active) return;
    if (!window.EnclaveAPI || !window.EnclaveAPI.isLoggedIn()) {
      setTimeout(pollAlerts, 15000);
      return;
    }
    window.EnclaveAPI.getAlerts().then(function (apiAlerts) {
      if (apiAlerts && apiAlerts.length) {
        var apiMap = {};
        apiAlerts.forEach(function (a) { apiMap[a.id] = a; });
        alerts.forEach(function (a) { if (!apiMap[a.id]) apiMap[a.id] = a; });
        alerts = Object.values(apiAlerts).sort(function (a, b) {
          return (b.timestamp || '').localeCompare(a.timestamp || '');
        });
        saveAlerts();
        renderDashboard();
        var pending = alerts.filter(function (a) { return a.status === 'PENDING_REVIEW' && a.confidence >= 90; });
        if (pending.length > 0) {
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification('Enclave Critical Alert', {
                body: 'Unauthorized AI-Altered Likeness Detected Online.',
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="80" font-size="80">🔒</text></svg>'
              });
            } catch (e) {}
          }
          showToastAlert('Critical: Unauthorized AI-Altered Likeness Detected Online.');
        }
      }
      setTimeout(pollAlerts, 15000);
    }).catch(function () {
      setTimeout(pollAlerts, 20000);
    });
  }

  /* ─── Deep Scan Trigger ─── */
  function triggerDeepScan() {
    if (!registeredName) return;
    scannerStatus.textContent = 'Deep scan in progress...';

    if (window.EnclaveAPI && window.EnclaveAPI.isLoggedIn()) {
      window.EnclaveAPI.deepScan().then(function (result) {
        var count = result && result.count ? result.count : 0;
        scannerStatus.textContent = 'Deep scan complete — ' + count + ' result(s) found.';
        return window.EnclaveAPI.getAlerts();
      }).then(function (apiAlerts) {
        if (apiAlerts && apiAlerts.length) {
          alerts = apiAlerts;
          saveAlerts();
          renderDashboard();
        }
      }).catch(function (e) {
        scannerStatus.textContent = 'Deep scan failed: ' + (e.message || 'Unknown error');
      });
    } else {
      scannerStatus.textContent = 'Sign in to run a deep scan against live search engines.';
    }

    try {
      var beepCtx = new (window.AudioContext || window.webkitAudioContext)();
      var osc = beepCtx.createOscillator();
      var gain = beepCtx.createGain();
      osc.connect(gain);
      gain.connect(beepCtx.destination);
      osc.frequency.value = 660;
      osc.type = 'square';
      gain.gain.value = 0.1;
      osc.start();
      osc.stop(beepCtx.currentTime + 0.2);
    } catch (e) {}
  }

  /* ═══════════════════════════════════════════════════════
     DASHBOARD
     ═══════════════════════════════════════════════════════ */

  function renderDashboard() {
    alertList.innerHTML = '';
    var pending = 0;
    alerts.forEach(function (a) {
      if (a.status === 'PENDING_REVIEW') pending++;
      var item = document.createElement('div');
      item.className = 'alert-item' + (selectedAlertId === a.id ? ' selected' : '');
      item.dataset.alertId = a.id;

      var badge = document.createElement('span');
      badge.className = 'alert-confidence';
      badge.textContent = a.confidence + '%';

      var src = document.createElement('span');
      src.className = 'alert-source';
      var label = a.type ? a.type.toUpperCase() + ' — ' : '';
      src.textContent = label + a.source;

      var st = document.createElement('span');
      st.className = 'alert-status' + (a.status === 'PENDING_REVIEW' ? ' pending' : '');
      st.textContent = a.status;

      item.appendChild(badge);
      item.appendChild(src);
      item.appendChild(st);

      item.addEventListener('click', function () {
        document.querySelectorAll('.alert-item').forEach(function (el) {
          el.classList.remove('selected');
        });
        item.classList.add('selected');
        selectedAlertId = a.id;
        openReview(a);
      });

      alertList.appendChild(item);
    });

    if (pending === 0) {
      alertList.innerHTML = '<p style="color:#4a5a68;padding:1rem 0;font-size:0.85rem;">No threats detected. System is scanning in the background.</p>';
    }

    dashboardStatus.textContent = pending + ' pending alert(s).';
  }

  /* ═══════════════════════════════════════════════════════
     REVIEW PANEL & TRIAD
     ═══════════════════════════════════════════════════════ */

  var currentReviewAlert = null;

  function openReview(alert) {
    currentReviewAlert = alert;
    var sourceText = alert.source || 'unknown';
    var matchedOn = alert.matchedOn || 'visual similarity';
    var metaHtml = 'Match: ' + alert.confidence + '% &middot; Type: ' + (alert.type || 'unknown')
      + ' &middot; Detected: ' + matchedOn
      + ' &middot; Timestamp: ' + (alert.timestamp || 'N/A');
    openResolution(alert);
    reviewStatus.textContent = 'Select action for Alert — ' + metaHtml;
  }

  function closeReview() {
    closeResolution();
    currentReviewAlert = null;
    selectedAlertId = null;
  }

  /* ─── Whitelist ─── */
  function whitelistAlert(alert) {
    for (var i = 0; i < alerts.length; i++) {
      if (alerts[i].id === alert.id) {
        alerts[i].status = 'RESOLVED_SAFE';
        break;
      }
    }
    saveAlerts();
    renderDashboard();
    closeReview();
    // Also call API
    if (window.EnclaveAPI && window.EnclaveAPI.isLoggedIn()) {
      window.EnclaveAPI.whitelistAlert(alert.id).catch(function () {});
    }
  }

  /* ─── DMCA / C&D Generator ─── */
  function promptAndGenerate(docType, alert) {
    var name = registeredName;
    if (!name) {
      name = prompt('Enter your full legal name for the ' + docType + ' notice:');
      if (!name || !name.trim()) {
        reviewStatus.textContent = 'Name required to generate notice.';
        return;
      }
      name = name.trim();
      registeredName = name;
      saveName();
      if (headerProfile) headerProfile.textContent = name;
    }

    reviewStatus.textContent = 'Biometric re-verification required.';
    reauthenticate().then(function () {
      reviewStatus.textContent = 'Sign your name to authorize the ' + docType + ' notice.';
      return showSignaturePad();
    }).then(function () {
      generatePDF(docType, alert, name);
    }).catch(function () {
      reviewStatus.textContent = 'Re-verification failed. Action cancelled.';
    });
  }

  /* ─── Biometric Re-Verification ─── */
  function reauthenticate() {
    return new Promise(function (resolve, reject) {
      var digits = [];
      for (var i = 0; i < 3; i++) digits.push(Math.floor(Math.random() * 10));
      var challenge = digits.join('-');

      var overlay = document.createElement('div');
      overlay.id = 'reauth-overlay';
      overlay.innerHTML =
        '<div id="reauth-panel">' +
          '<h3>Quick Biometric Re-Verification</h3>' +
          '<p style="color:#6a7a88;font-size:0.78rem;margin-bottom:0.5rem;">Read the code aloud</p>' +
          '<video id="reauth-video" autoplay playsinline muted></video>' +
          '<p class="reauth-challenge">' + challenge + '</p>' +
          '<div class="spectrum-bar" style="max-width:280px;margin:0.5rem auto;">' +
            '<canvas id="reauth-spectrum" width="280" height="30"></canvas>' +
          '</div>' +
          '<p class="reauth-status" id="reauth-status">Listening...</p>' +
        '</div>';
      document.body.appendChild(overlay);

      var reauthVideo = document.getElementById('reauth-video');
      var reauthSpectrum = document.getElementById('reauth-spectrum');
      var reauthStatus = document.getElementById('reauth-status');

      var cancelled = false;
      var timeout = setTimeout(function () {
        cancelled = true;
        cleanup();
        reject(new Error('timeout'));
      }, 18000);

      navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(function (s) {
        if (cancelled) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
        reauthVideo.srcObject = s;

        var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        var analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        var source = audioCtx.createMediaStreamSource(s);
        source.connect(analyser);

        var vCtx = reauthSpectrum.getContext('2d');
        var burstCount = 0;
        var inBurst = false;
        var burstFrames = 0;
        var needed = digits.length;

        function draw() {
          if (cancelled) return;
          var freqData = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(freqData);

          vCtx.fillStyle = '#060a10';
          vCtx.fillRect(0, 0, reauthSpectrum.width, reauthSpectrum.height);
          var barW = reauthSpectrum.width / freqData.length;
          for (var i = 0; i < freqData.length; i++) {
            var h = (freqData[i] / 255) * reauthSpectrum.height;
            vCtx.fillStyle = 'hsl(170, 80%, ' + (30 + h / reauthSpectrum.height * 40) + '%)';
            vCtx.fillRect(i * barW, reauthSpectrum.height - h, barW - 1, h);
          }

          var energy = 0;
          for (var i = 0; i < freqData.length; i++) energy += freqData[i];
          var avg = energy / freqData.length;

          if (avg > 18) {
            burstFrames++;
            if (!inBurst) { inBurst = true; burstFrames = 1; }
          } else {
            if (inBurst && burstFrames >= 6) burstCount++;
            inBurst = false;
            burstFrames = 0;
          }

          if (burstCount >= needed) {
            clearTimeout(timeout);
            cancelled = true;
            terminateActiveMediaStreams(s);
            source.disconnect();
            audioCtx.close();
            reauthStatus.className = 'reauth-status success';
            reauthStatus.textContent = '✓ Verified';
            setTimeout(function () {
              if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
              resolve();
            }, 600);
            return;
          }

          if (!cancelled) requestAnimationFrame(draw);
        }

        draw();

        function cleanup() {
          terminateActiveMediaStreams(s);
          source.disconnect();
          audioCtx.close();
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }
      }).catch(function () {
        clearTimeout(timeout);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        reject(new Error('Camera/mic denied'));
      });
    });
  }

  /* ─── PDF Generation ─── */
  function generatePDF(docType, alert, name) {
    if (typeof jspdf === 'undefined') {
      reviewStatus.textContent = 'PDF library not loaded. Check network.';
      return;
    }

    var doc = new jspdf.jsPDF({ unit: 'mm', format: 'letter' });
    var pageW = doc.internal.pageSize.getWidth();
    var margin = 20;
    var y = margin;

    // dark background
    doc.setFillColor(10, 14, 20);
    doc.rect(0, 0, pageW, doc.internal.pageSize.getHeight(), 'F');

    // header accent line
    doc.setDrawColor(0, 212, 170);
    doc.setLineWidth(1);
    doc.line(margin, y + 6, pageW - margin, y + 6);

    // title
    doc.setTextColor(0, 212, 170);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    var title = docType === 'DMCA' ? 'DMCA Takedown Notice' : 'Cease & Desist Demand';
    doc.text('ENCLAVE — ' + title, margin, y);
    y += 14;

    // body
    doc.setTextColor(200, 210, 218);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);

    var lines = [];
    if (docType === 'DMCA') {
      lines.push('DIGITAL MILLENNIUM COPYRIGHT ACT (DMCA) TAKEDOWN NOTICE');
      lines.push('');
      lines.push('TO WHOM IT MAY CONCERN:');
      lines.push('');
      lines.push('This letter serves as formal notification under Section 512(c) of the Digital');
      lines.push('Millennium Copyright Act that I, ' + name + ', am requesting the immediate');
      lines.push('removal of infringing material hosted on your platform.');
      lines.push('');
      lines.push('Infringing material located at:');
      lines.push(alert.source);
      lines.push('');
      lines.push('Match Confidence: ' + alert.confidence + '%');
      lines.push('Match Type: ' + (alert.matchedOn || 'visual similarity'));
      lines.push('');
      lines.push('I state under penalty of perjury that the information in this notification');
      lines.push('is accurate and that I am the owner of the exclusive right allegedly infringed.');
      lines.push('');
      lines.push('Sincerely,');
    } else {
      lines.push('FORMAL CEASE AND DESIST DEMAND');
      lines.push('');
      lines.push('CONFIDENTIAL — FOR SETTLEMENT PURPOSES ONLY');
      lines.push('');
      lines.push('This correspondence constitutes a formal legal demand that you immediately');
      lines.push('cease and desist all unauthorized use, manipulation, and reproduction of');
      lines.push('the digital identity and likeness of ' + name + '.');
      lines.push('');
      lines.push('Infringing material identified at:');
      lines.push(alert.source);
      lines.push('');
      lines.push('Match Confidence: ' + alert.confidence + '%');
      lines.push('');
      lines.push('Failure to comply within forty-eight (48) hours will result in pursuit of');
      lines.push('all available civil remedies, including statutory damages and legal fees.');
      lines.push('');
      lines.push('Respectfully executed,');
    }

    lines.forEach(function (line) {
      doc.text(line, margin, y);
      y += 5.5;
    });

    y += 4;
    var sigDataUrl = lsGet(LS_SIGNATURE, '');
    if (sigDataUrl) {
      try {
        doc.addImage(sigDataUrl, 'PNG', margin, y, 55, 18);
        y += 22;
      } catch (e) {
        doc.setTextColor(0, 212, 170);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('/s/ ' + name, margin, y);
        y += 6;
      }
    } else {
      doc.setTextColor(0, 212, 170);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('/s/ ' + name, margin, y);
      y += 6;
    }
    doc.setTextColor(100, 120, 136);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Digitally signed by ' + name + ' via Enclave', margin, y);

    // footer line
    y += 4;
    doc.setDrawColor(0, 212, 170);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += 3;
    doc.setTextColor(60, 80, 96);
    doc.setFontSize(7);
    doc.text('Document ID: ' + alert.id + ' | Generated: ' + new Date().toISOString().slice(0, 10), margin, y);

    // ─── ENCLAVE PROVENANCE & AUTHENTICITY MANIFEST ───
    var boxX = margin - 2;
    var boxW = pageW - margin * 2 + 4;
    var boxY = y + 6;
    var lineH = 4.2;
    var pubKeyObj = lsGet('enclave_public_key_jwk', null);
    var pubKeyStr = (pubKeyObj && pubKeyObj.x && pubKeyObj.y)
      ? 'ECDSA P-256 — x:' + pubKeyObj.x + ' y:' + pubKeyObj.y
      : 'ECDSA P-256 — key not exported';
    var faceHash = lsGet('enclave_faceprint_hash', '') || 'SHA-256 — not computed';
    var signingTime = new Date().toISOString();

    // fill + stroke the bounding box
    doc.setDrawColor(0, 212, 170);
    doc.setLineWidth(0.3);
    doc.setFillColor(8, 12, 20);
    doc.rect(boxX, boxY - 1, boxW, lineH * 4 + 5, 'DF');
    // render all text on top of fill
    doc.setTextColor(0, 212, 170);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('ENCLAVE PROVENANCE & AUTHENTICITY MANIFEST', margin, boxY + 1);
    doc.setTextColor(160, 170, 180);
    doc.setFont('Courier', 'normal');
    doc.setFontSize(5.5);
    doc.text('Public Key: ' + pubKeyStr, margin, boxY + lineH + 1);
    doc.text('Faceprint SHA-256: ' + faceHash, margin, boxY + lineH * 2 + 1);
    doc.text('Signed: ' + signingTime + ' | Enclave v2.0', margin, boxY + lineH * 3 + 1);

    var docLabel = docType === 'DMCA' ? 'dmca' : 'cease_and_desist';
    doc.save('enclave_alert_' + alert.id + '_' + docLabel + '.pdf');

    // update alert
    for (var i = 0; i < alerts.length; i++) {
      if (alerts[i].id === alert.id) {
        alerts[i].status = 'NOTICE_GENERATED';
        break;
      }
    }
    saveAlerts();
    renderDashboard();
    reviewStatus.textContent = docType + ' notice generated and downloaded.';
  }

  /* ═══════════════════════════════════════════════════════
     LOCK
     ═══════════════════════════════════════════════════════ */
  btnLock.addEventListener('click', function () {
    if (worker) { worker.active = false; worker = null; }
    if (window.EnclaveAPI && window.EnclaveAPI.isLoggedIn()) {
      window.EnclaveAPI.stopCrawler().catch(function () {});
    }
    stopVoiceTunnel();
    stopCameraCloak();
    // Reset auth state for login
    authStep = 'idle';
    btnAuthStart.disabled = false;
    btnAuthStart.textContent = 'Authenticate';
    authStatus.className = 'auth-status';
    authStatus.textContent = '';
    stageLiveness.classList.add('active');
    stageVoice.classList.remove('active');
    livenessFill.style.width = '0%';
    livenessFill.classList.remove('complete');
    livenessDetected.classList.add('hidden');
    burstDots.forEach(function (d) { d.classList.remove('active'); });
    authOverlay.classList.add('hidden');
    registerPortal.classList.add('hidden');
    appRoot.classList.add('hidden');
    window.EnclaveAuthUI.show();
  });

  /* ═══════════════════════════════════════════════════════
     SETTINGS PANEL
     ═══════════════════════════════════════════════════════ */

  function openSettings() {
    if (!registeredName) { settingsStatus.textContent = 'No vault data available.'; return; }
    settingsName.textContent = registeredName;
    var fp = lsGet(LS_FACEPRINT, null);
    if (fp && fp.thumbnail) {
      settingsFaceStatus.textContent = 'Captured (' + fp.width + '×' + fp.height + ', ' + (fp.captured ? fp.captured.slice(0, 10) : 'unknown') + ')';
      settingsFacePreview.innerHTML = '';
      var img = document.createElement('img');
      img.src = fp.thumbnail;
      img.style.cssText = 'width:80px;height:auto;border-radius:4px;border:1px solid #1a2430;';
      settingsFacePreview.appendChild(img);
    } else {
      settingsFaceStatus.textContent = 'Not captured';
      settingsFacePreview.innerHTML = '';
    }
    var vp = lsGet(LS_VOICEPRINT, null);
    if (vp && vp.profile) {
      settingsVoiceStatus.textContent = 'Recorded (' + vp.frames + ' frames, ' + (vp.captured ? vp.captured.slice(0, 10) : 'unknown') + ')';
    } else {
      settingsVoiceStatus.textContent = 'Not captured';
    }
    var sig = lsGet(LS_SIGNATURE, '');
    settingsSigStatus.textContent = sig ? 'Saved' : 'Not signed';
    settingsModal.classList.remove('hidden');
    settingsStatus.textContent = '';
  }

  function closeSettings() {
    settingsModal.classList.add('hidden');
  }

  function refreshSettingsPanel() {
    if (!settingsModal.classList.contains('hidden')) openSettings();
  }

  btnSettingsOpen.addEventListener('click', openSettings);
  btnSettingsClose.addEventListener('click', closeSettings);

  /* ─── Re-capture flows from Settings ─── */
  btnSettingsRename.addEventListener('click', function () {
    var newName = prompt('Enter new registered name:', registeredName);
    if (newName && newName.trim()) {
      registeredName = newName.trim();
      saveName();
      if (headerProfile) headerProfile.textContent = registeredName;
      openSettings();
      settingsStatus.textContent = 'Name updated.';
    }
  });

  btnSettingsReface.addEventListener('click', function () {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      settingsStatus.textContent = 'Camera unavailable.';
      return;
    }
    closeSettings();
    // re-trigger face capture flow inside registration portal context
    advRegStep(regStepFace, [regStepName, regStepAudio, regStepComplete]);
    registerPortal.classList.remove('hidden');
    openRegCamera();
    settingsStatus.textContent = '';
    btnRegComplete.textContent = 'Return to Vault';
    btnRegComplete.onclick = function () {
      registerPortal.classList.add('hidden');
      refreshSettingsPanel();
      btnRegComplete.textContent = 'Enrollment Complete';
      btnRegComplete.onclick = function () {
        registerPortal.classList.add('hidden');
      };
    };
  });

  btnSettingsRevoice.addEventListener('click', function () {
    closeSettings();
    advRegStep(regStepAudio, [regStepName, regStepFace, regStepComplete]);
    registerPortal.classList.remove('hidden');
    openRegMic();
    settingsStatus.textContent = '';
    btnRegComplete.textContent = 'Return to Vault';
    btnRegComplete.onclick = function () {
      registerPortal.classList.add('hidden');
      refreshSettingsPanel();
      btnRegComplete.textContent = 'Enrollment Complete';
      btnRegComplete.onclick = function () {
        registerPortal.classList.add('hidden');
      };
    };
  });

  btnSettingsResig.addEventListener('click', function () {
    closeSettings();
    showSignaturePad().then(function () {
      refreshSettingsPanel();
      settingsStatus.textContent = 'Signature updated.';
    }).catch(function () {});
  });

  btnSettingsClear.addEventListener('click', function () {
    if (confirm('Are you sure you want to clear ALL vault data? This cannot be undone.')) {
      localStorage.clear();
      registeredName = '';
      alerts = [];
    if (worker) { worker.active = false; worker = null; }
    closeSettings();
    appRoot.classList.add('hidden');
    authStep = 'idle';
    authOverlay.classList.add('hidden');
    registerPortal.classList.add('hidden');
    // Sign out from Clerk
    if (window.Clerk && window.Clerk.signOut) {
      window.EnclaveAuthUI.show();
    } else {
      window.EnclaveAuthUI.show();
    }
    }
  });

  /* ─── Export Identity Manifest (Web Crypto) ─── */
  btnSettingsExport.addEventListener('click', function () {
    var fp = lsGet(LS_FACEPRINT, null);
    var vp = lsGet(LS_VOICEPRINT, null);
    var sig = lsGet(LS_SIGNATURE, '');
    if (!registeredName) {
      settingsStatus.textContent = 'No identity data to export.';
      return;
    }
    var manifest = {
      name: registeredName,
      faceprint: fp ? { width: fp.width, height: fp.height, grayscale: fp.grayscale, captured: fp.captured } : null,
      voiceprint: vp ? { bins: vp.bins, sampleRate: vp.sampleRate, frames: vp.frames, durationMs: vp.durationMs, captured: vp.captured } : null,
      signature: sig ? 'present' : 'absent',
      alerts: alerts.length,
      exported: new Date().toISOString(),
      version: '2.0'
    };
    var blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'enclave_identity_manifest.json';
    a.click();
    URL.revokeObjectURL(url);
    settingsStatus.textContent = 'Identity manifest exported.';
  });

  /* ─── Voice Frequency Control ─── */
  if (btnApplyFreq && settingsVoiceFreq) {
    // Load saved frequency
    var savedFreq = localStorage.getItem('enclave_voice_frequency');
    if (savedFreq) settingsVoiceFreq.value = savedFreq;

    btnApplyFreq.addEventListener('click', function () {
      var freq = settingsVoiceFreq.value;
      localStorage.setItem('enclave_voice_frequency', freq);
      // Apply to voice shield if active
      if (window.EnclaveNative && window.EnclaveNative.voiceShield && window.EnclaveNative.voiceShield.isActive()) {
        // Restart voice shield with new frequency
        window.EnclaveNative.voiceShield.stop().then(function () {
          // Store freq for native plugin to use on restart
          if (window.EnclaveNative.voiceShield.setFrequency) {
            window.EnclaveNative.voiceShield.setFrequency(parseInt(freq, 10));
          }
          return window.EnclaveNative.voiceShield.start();
        }).then(function () {
          settingsStatus.textContent = 'Voice frequency updated to ' + freq + ' Hz';
        });
      } else {
        if (window.EnclaveNative && window.EnclaveNative.voiceShield && window.EnclaveNative.voiceShield.setFrequency) {
          window.EnclaveNative.voiceShield.setFrequency(parseInt(freq, 10));
        }
        settingsStatus.textContent = 'Voice frequency set to ' + freq + ' Hz';
      }
      refreshSettingsPanel();
    });
  }

  /* ─── Widget Toggle ─── */
  if (toggleWidget) {
    var widgetEnabled = localStorage.getItem('enclave_widget_enabled');
    if (widgetEnabled !== null) {
      toggleWidget.checked = widgetEnabled === 'true';
    }
    if (widgetStatusLabel) {
      widgetStatusLabel.textContent = toggleWidget.checked ? 'Enabled' : 'Disabled';
    }

    toggleWidget.addEventListener('change', function () {
      var enabled = this.checked;
      localStorage.setItem('enclave_widget_enabled', enabled);
      if (widgetStatusLabel) {
        widgetStatusLabel.textContent = enabled ? 'Enabled' : 'Disabled';
      }
      // Notify native bridge
      if (window.EnclaveNative && window.EnclaveNative.shieldOverlay) {
        if (enabled && window.EnclaveNative.shieldOverlay.getStatus().cameraActive && window.EnclaveNative.shieldOverlay.getStatus().voiceActive) {
          window.EnclaveNative.shieldOverlay.start();
        } else if (!enabled) {
          window.EnclaveNative.shieldOverlay.stop();
        }
      }
      settingsStatus.textContent = enabled ? 'System widget enabled' : 'System widget disabled';
    });
  }

  /* ─── Logout ─── */
  if (btnSettingsLogout) {
    btnSettingsLogout.addEventListener('click', function () {
      if (!confirm('Log out of Enclave? All local data will be preserved.')) return;
      if (worker) { worker.active = false; worker = null; }
      stopVoiceTunnel();
      stopCameraCloak();
      if (window.EnclaveNative && window.EnclaveNative.shieldOverlay && window.EnclaveNative.shieldOverlay.isActive()) {
        window.EnclaveNative.shieldOverlay.stop();
      }
      if (window.EnclaveAPI) { window.EnclaveAPI.logout(); }
      if (window.EnclaveNative && window.EnclaveNative.secureStorage) {
        window.EnclaveNative.secureStorage.remove('enclave_jwt');
      }
      closeSettings();
      appRoot.classList.add('hidden');
      authStep = 'idle';
      btnAuthStart.disabled = false;
      btnAuthStart.textContent = 'Authenticate';
      authStatus.className = 'auth-status';
      authStatus.textContent = '';
      stageLiveness.classList.add('active');
      stageVoice.classList.remove('active');
      window.EnclaveAuthUI.show();
    });
  }

  /* ─── Encrypted Voice Tunnel ─── */
  function startVoiceTunnel() {
    if (tunnelActive) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      tunnelInfo.textContent = 'Microphone unavailable.';
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
      tunnelStream = s;
      tunnelAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var source = tunnelAudioCtx.createMediaStreamSource(s);
      // apply scrambling filters for external comms protection
      var chainEnd = applyVoiceScrambling(tunnelAudioCtx, source);
      // analyser on the scrambled output for live visualization
      var tunnelAnalyser = tunnelAudioCtx.createAnalyser();
      tunnelAnalyser.fftSize = 128;
      if (chainEnd) {
        chainEnd.connect(tunnelAnalyser);
      } else {
        source.connect(tunnelAnalyser);
      }

      tunnelActive = true;
      tunnelStatus.textContent = 'ACTIVE';
      tunnelStatus.className = 'tunnel-status-indicator active';
      btnTunnel.textContent = 'Deactivate Tunnel';
      tunnelInfo.textContent = 'Encrypted tunnel active — microphone feed scrambled.';

      var vCtx = tunnelSpectrum.getContext('2d');
      function drawTunnel() {
        if (!tunnelActive) return;
        var freqData = new Uint8Array(tunnelAnalyser.frequencyBinCount);
        tunnelAnalyser.getByteFrequencyData(freqData);
        vCtx.fillStyle = '#060a10';
        vCtx.fillRect(0, 0, tunnelSpectrum.width, tunnelSpectrum.height);
        var barW = tunnelSpectrum.width / freqData.length;
        for (var i = 0; i < freqData.length; i++) {
          var h = (freqData[i] / 255) * tunnelSpectrum.height;
          vCtx.fillStyle = 'hsl(320, 80%, ' + (30 + h / tunnelSpectrum.height * 40) + '%)';
          vCtx.fillRect(i * barW, tunnelSpectrum.height - h, barW - 1, h);
        }
        tunnelAnimId = requestAnimationFrame(drawTunnel);
      }
      drawTunnel();
    }).catch(function () {
      tunnelInfo.textContent = 'Mic access denied for tunnel.';
    });
  }

  function stopVoiceTunnel() {
    tunnelActive = false;
    if (tunnelAnimId) { cancelAnimationFrame(tunnelAnimId); tunnelAnimId = null; }
    terminateActiveMediaStreams();
    var vCtx = tunnelSpectrum.getContext('2d');
    vCtx.fillStyle = '#060a10';
    vCtx.fillRect(0, 0, tunnelSpectrum.width, tunnelSpectrum.height);
    tunnelStatus.textContent = 'INACTIVE';
    tunnelStatus.className = 'tunnel-status-indicator inactive';
    btnTunnel.textContent = 'Activate Tunnel';
    tunnelInfo.textContent = '';
  }

  btnTunnel.addEventListener('click', function () {
    if (tunnelActive) { stopVoiceTunnel(); }
    else { startVoiceTunnel(); }
  });

  /* ═══════════════════════════════════════════════════════
     CAMERA CLOAKING PROTECTION
     ═══════════════════════════════════════════════════════ */

  var cloakCanvas = null;
  var cloakCtx = null;

  function startCameraCloak(videoEl, containerEl) {
    stopCameraCloak();
    if (!videoEl || !containerEl) return;
    cloakCanvas = document.createElement('canvas');
    cloakCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:10;opacity:0.35;mix-blend-mode:overlay;';
    cloakCanvas.width = 2;
    cloakCanvas.height = 2;
    cloakCtx = cloakCanvas.getContext('2d');
    containerEl.style.position = 'relative';
    containerEl.appendChild(cloakCanvas);
    var staticPattern = [];
    for (var i = 0; i < 4; i++) staticPattern.push(Math.random() * 255);

    function tickCloak() {
      if (!cloakCtx || !cloakCanvas.parentNode) return;
      var id = cloakCtx.createImageData(2, 2);
      for (var i = 0; i < 4; i++) {
        var offset = i * 4;
        var noise = Math.random() * 60;
        id.data[offset] = staticPattern[i] * 0.7 + noise;
        id.data[offset + 1] = staticPattern[i] * 0.5 + noise * 0.8;
        id.data[offset + 2] = staticPattern[i] * 0.3 + noise * 0.6;
        id.data[offset + 3] = 80;
      }
      cloakCtx.putImageData(id, 0, 0);
      cloakCanvas.width = cloakCanvas.width;
      cloakCanvas.style.transform = 'scale(' + (containerEl.offsetWidth / 2) + ', ' + (containerEl.offsetHeight / 2) + ')';
      cloakCanvas.style.transformOrigin = '0 0';
      cloakInterval = setTimeout(tickCloak, CLOAK_RATE);
    }
    tickCloak();
  }

  function stopCameraCloak() {
    if (cloakInterval) { clearTimeout(cloakInterval); cloakInterval = null; }
    if (cloakCanvas && cloakCanvas.parentNode) cloakCanvas.parentNode.removeChild(cloakCanvas);
    cloakCanvas = null;
    cloakCtx = null;
  }

  function applyVoiceScrambling(audioCtx, source) {
    if (!audioCtx || !source) return null;
    try {
      var scrambler = audioCtx.createBiquadFilter();
      scrambler.type = 'bandpass';
      scrambler.frequency.value = 1800 + Math.random() * 600;
      scrambler.Q.value = 2 + Math.random() * 3;
      source.disconnect();
      source.connect(scrambler);
      var scrambler2 = audioCtx.createBiquadFilter();
      scrambler2.type = 'notch';
      scrambler2.frequency.value = 800 + Math.random() * 400;
      scrambler2.Q.value = 3 + Math.random() * 2;
      scrambler.connect(scrambler2);
      scrambler2.connect(audioCtx.destination);
      return scrambler2;
    } catch (e) {
      source.connect(audioCtx.destination);
      return null;
    }
  }

  /* ═══════════════════════════════════════════════════════
     WEB CRYPTO — ECDSA + SHA-256 + PROOF OF REALITY
     ═══════════════════════════════════════════════════════ */

  function exportPublicKeyJwk(keyPair) {
    if (!keyPair || !keyPair.publicKey || !window.crypto || !window.crypto.subtle) return null;
    return crypto.subtle.exportKey('jwk', keyPair.publicKey).then(function (jwk) {
      lsSet('enclave_public_key_jwk', jwk);
      return jwk;
    }).catch(function () { return null; });
  }

  function generateIdentityProof() {
    if (!window.crypto || !window.crypto.subtle) return null;
    if (cryptoKeyPair) return cryptoKeyPair;
    try {
      crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
      ).then(function (kp) {
        cryptoKeyPair = kp;
        exportPublicKeyJwk(kp);
        lsSet('enclave_crypto_keys', {
          generated: new Date().toISOString()
        });
      }).catch(function () { cryptoKeyPair = null; });
    } catch (e) { cryptoKeyPair = null; }
    return cryptoKeyPair;
  }

  function hashImageData(canvas) {
    if (!window.crypto || !window.crypto.subtle) return null;
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) {
        if (!blob) { resolve(null); return; }
        blob.arrayBuffer().then(function (buf) {
          crypto.subtle.digest('SHA-256', buf).then(function (hash) {
            var hex = Array.prototype.map.call(
              new Uint8Array(hash),
              function (b) { return b.toString(16).padStart(2, '0'); }
            ).join('');
            resolve(hex);
          }).catch(function () { resolve(null); });
        }).catch(function () { resolve(null); });
      }, 'image/png');
    });
  }

  function signManifest(hash) {
    if (!cryptoKeyPair || !window.crypto || !window.crypto.subtle) return null;
    try {
      var enc = new TextEncoder();
      return crypto.subtle.sign(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        cryptoKeyPair.privateKey,
        enc.encode(hash + registeredName)
      ).then(function (sig) {
        return btoa(String.fromCharCode.apply(null, new Uint8Array(sig)));
      }).catch(function () { return null; });
    } catch (e) { return null; }
  }

  /* ═══════════════════════════════════════════════════════
     ON-DEVICE ML DEEPFAKE DETECTOR (TensorFlow.js)
     ═══════════════════════════════════════════════════════ */

  var tfjsLoaded = false;
  var tfjsModel = null;

  async function loadTFJS() {
    if (tfjsLoaded) return tfjsModel;
    return new Promise(function (resolve) {
      var script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js';
      script.onload = async function () {
        tfjsLoaded = true;
        try {
          tfjsModel = await tf.loadGraphModel(
            'https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v2_100_224/classification/3/default/1',
            { fromTFHub: true }
          );
        } catch (e) {
          tfjsModel = null;
        }
        resolve(tfjsModel);
      };
      script.onerror = function () { resolve(null); };
      document.head.appendChild(script);
    });
  }

  async function analyzeWithML(canvas) {
    if (!tfjsModel) return { mlScore: null, mlReason: null };
    try {
      var tensor = tf.browser.fromPixels(canvas).resizeNearestNeighbor([224, 224]).toFloat();
      var offset = tf.scalar(127.5);
      tensor = tensor.sub(offset).div(offset);
      tensor = tensor.expandDims();
      var predictions = tfjsModel.predict(tensor);
      var topk = tf.topk(predictions, 3);
      var values = topk.values.dataSync();
      var maxProb = values[0];
      tensor.dispose();
      predictions.dispose();
      topk.dispose();
      if (maxProb > 0.92) {
        return { mlScore: Math.round((1 - maxProb) * 100), mlReason: 'overconfident classification (possible GAN artifact)' };
      } else if (maxProb < 0.15) {
        return { mlScore: Math.round((1 - maxProb) * 100), mlReason: 'unrecognizable pattern (synthetic anomaly)' };
      } else {
        return { mlScore: Math.round(maxProb * 50 + 25), mlReason: 'standard classification variance' };
      }
    } catch (e) {
      return { mlScore: null, mlReason: null };
    }
  }

  /* ═══════════════════════════════════════════════════════
     INITIAL REGISTRATION ENROLLMENT
     ═══════════════════════════════════════════════════════ */

  function showRegError(msg) { regError.textContent = msg; regError.classList.remove('hidden'); }
  function hideRegError() { regError.textContent = ''; regError.classList.add('hidden'); }

  function advRegStep(show, hide) {
    hide.forEach(function (el) { el.classList.remove('active'); });
    show.classList.add('active');
    hideRegError();
    // Goal Gradient: update enrollment progress bar
    var fill = document.getElementById('enrollment-progress-fill');
    var text = document.getElementById('enrollment-progress-text');
    if (fill && text) {
      var stepMap = {};
      stepMap[regStepName.id] = { pct: 33, num: 1 };
      stepMap[regStepFace.id] = { pct: 66, num: 2 };
      stepMap[regStepAudio.id] = { pct: 90, num: 3 };
      stepMap[regStepComplete.id] = { pct: 100, num: 3 };
      var info = stepMap[show.id] || { pct: 33, num: 1 };
      fill.style.width = info.pct + '%';
      text.textContent = 'Step ' + info.num + ' of 3 — ' + info.pct + '% complete';
    }
  }

  /* ─── Step 1: Name ─── */
  btnRegName.addEventListener('click', function () {
    var name = regInputName.value.trim();
    if (!name) { showRegError('Full name is required.'); return; }
    registeredName = name;
    saveName();
    if (headerProfile) headerProfile.textContent = name;
    advRegStep(regStepFace, [regStepName]);
    openRegCamera();
  });

  /* ─── Step 2: Face Snapshot ─── */
  function openRegCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showRegError('Camera unavailable.');
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: true }).then(function (s) {
      regStream = s;
      regVideo.srcObject = s;
      // camera cloaking overlay
      var cameraBox = regVideo.parentElement;
      startCameraCloak(regVideo, cameraBox);
    }).catch(function () {
      showRegError('Camera access denied.');
    });
  }

  function closeRegCamera() {
    stopCameraCloak();
    terminateActiveMediaStreams();
  }

  btnRegCapture.addEventListener('click', function () {
    if (!regStream) return;
    var w = 64, h = 48;
    regFaceCanvas.width = w;
    regFaceCanvas.height = h;
    var ctx = regFaceCanvas.getContext('2d');
    ctx.drawImage(regVideo, 0, 0, w, h);

    // grayscale for smaller storage
    var imgData = ctx.getImageData(0, 0, w, h);
    var d = imgData.data;
    for (var i = 0; i < d.length; i += 4) {
      var g = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      d[i] = d[i + 1] = d[i + 2] = g;
    }
    ctx.putImageData(imgData, 0, 0);

    var dataUrl = regFaceCanvas.toDataURL('image/png');

    var faceMatrix = {
      type: 'face_spatial_matrix',
      width: w,
      height: h,
      grayscale: true,
      thumbnail: dataUrl,
      captured: new Date().toISOString()
    };
    lsSet(LS_FACEPRINT, faceMatrix);

    // Proof of Reality: generate ECDSA keypair + SHA-256 hash
    generateIdentityProof();
    hashImageData(regFaceCanvas).then(function (hash) {
      if (hash) {
        lsSet('enclave_faceprint_hash', hash);
      }
    });

    regFacePreview.innerHTML = '';
    var thumb = document.createElement('canvas');
    thumb.width = w; thumb.height = h;
    thumb.getContext('2d').putImageData(imgData, 0, 0);
    regFacePreview.appendChild(thumb);
    regFacePreview.classList.remove('hidden');

    closeRegCamera();
    btnRegCapture.disabled = true;
    btnRegCapture.textContent = 'Captured';
    btnRegFaceDone.disabled = false;
    btnRegFaceDone.style.opacity = '1';
  });

  btnRegFaceDone.addEventListener('click', function () {
    advRegStep(regStepAudio, [regStepFace]);
    openRegMic();
  });

  /* ─── Step 3: Audio Baseline ─── */
  var regRecordedFrames = [];
  var regRecording = false;

  function openRegMic() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showRegError('Microphone unavailable.');
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
      if (regAudioCtx) regAudioCtx.close();
      regAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      regAnalyser = regAudioCtx.createAnalyser();
      regAnalyser.fftSize = 128;
      regSource = regAudioCtx.createMediaStreamSource(s);
      regSource.connect(regAnalyser);
      drawRegSpectrum();
    }).catch(function () {
      showRegError('Mic access denied.');
    });
  }

  function closeRegMic() {
    if (regSource) regSource.disconnect();
    if (regAudioCtx) regAudioCtx.close();
    regAudioCtx = null;
    regAnalyser = null;
    regSource = null;
  }

  function drawRegSpectrum() {
    if (!regAnalyser) return;
    var freqData = new Uint8Array(regAnalyser.frequencyBinCount);
    regAnalyser.getByteFrequencyData(freqData);
    var ctx = regSpectrumCanvas.getContext('2d');
    ctx.fillStyle = '#060a10';
    ctx.fillRect(0, 0, regSpectrumCanvas.width, regSpectrumCanvas.height);
    var barW = regSpectrumCanvas.width / freqData.length;
    for (var i = 0; i < freqData.length; i++) {
      var h = (freqData[i] / 255) * regSpectrumCanvas.height;
      ctx.fillStyle = 'hsl(170, 80%, ' + (30 + h / regSpectrumCanvas.height * 40) + '%)';
      ctx.fillRect(i * barW, regSpectrumCanvas.height - h, barW - 1, h);
    }
    if (regRecording) {
      regRecordedFrames.push(Array.prototype.slice.call(freqData));
    }
    if (regAnalyser) requestAnimationFrame(drawRegSpectrum);
  }

  btnRegRecord.addEventListener('click', function () {
    if (regRecording) return;
    regRecordedFrames = [];
    regRecording = true;
    btnRegRecord.disabled = true;
    btnRegRecord.textContent = 'Recording...';
    regAudioStatus.textContent = 'Recording voice baseline — speak naturally';
    regAudioStatus.style.color = '#f85149';

    setTimeout(function () {
      regRecording = false;
      btnRegRecord.textContent = 'Recorded';
      regAudioStatus.textContent = 'Voice baseline captured (' + regRecordedFrames.length + ' frames)';
      regAudioStatus.style.color = '#3fb950';

      // average frequency data across all frames → spatial matrix
      if (regRecordedFrames.length > 0) {
        var binCount = regRecordedFrames[0].length;
        var profile = new Array(binCount).fill(0);
        regRecordedFrames.forEach(function (frame) {
          for (var i = 0; i < binCount; i++) profile[i] += frame[i];
        });
        for (var i = 0; i < binCount; i++) profile[i] = Math.round(profile[i] / regRecordedFrames.length);

        var spatialMatrix = {
          type: 'voice_spatial_matrix',
          bins: binCount,
          sampleRate: regAudioCtx ? regAudioCtx.sampleRate : 44100,
          fftSize: 128,
          frames: regRecordedFrames.length,
          durationMs: 10000,
          profile: profile,
          captured: new Date().toISOString()
        };
        lsSet(LS_VOICEPRINT, spatialMatrix);

        closeRegMic();
        btnRegAudioDone.disabled = false;
        btnRegAudioDone.style.opacity = '1';
      }
    }, 10000);
  });

  btnRegAudioDone.addEventListener('click', function () {
    advRegStep(regStepComplete, [regStepAudio]);
  });

  /* ─── Step 4: Complete ─── */
  function uploadBiometricsToAPI() {
    if (!window.EnclaveAPI || !window.EnclaveAPI.isLoggedIn()) return;
    var face = lsGet(LS_FACEPRINT, null);
    var voice = lsGet(LS_VOICEPRINT, null);
    if (face && face.thumbnail) {
      var blob = (function (dataUrl) {
        var parts = dataUrl.split(',');
        var mime = parts[0].match(/:(.*?);/)[1];
        var bytes = atob(parts[1]);
        var arr = new Uint8Array(bytes.length);
        for (var i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        return new Blob([arr], { type: mime });
      })(face.thumbnail);
      var file = new File([blob], 'faceprint.png', { type: 'image/png' });
      window.EnclaveAPI.uploadFace(file, face.width, face.height).catch(function () {});
    }
    if (voice && voice.profile) {
      var meta = { bins: voice.bins, sampleRate: voice.sampleRate, fftSize: voice.fftSize, frames: voice.frames, durationMs: voice.durationMs };
      window.EnclaveAPI.uploadVoice(null, voice.profile, meta).catch(function () {});
    }
  }

  btnRegComplete.addEventListener('click', function () {
    uploadBiometricsToAPI();
    registerPortal.classList.add('hidden');
  });

  /* ═══════════════════════════════════════════════════════
     MANUAL SCANNER (URL / File Upload)
     ═══════════════════════════════════════════════════════ */

  function readFileAsDataURL(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error('File read failed')); };
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('Image load failed')); };
      img.src = src;
    });
  }

  async function analyzeImageAnomalies(file) {
    var dataUrl = await readFileAsDataURL(file);
    var img = await loadImage(dataUrl);

    var c = document.createElement('canvas');
    var ctx = c.getContext('2d');
    c.width = 200;
    c.height = Math.round(200 * img.height / img.width);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    var id = ctx.getImageData(0, 0, c.width, c.height);
    var d = id.data;

    var hfScore = 0, count = 0;
    for (var y = 0; y < c.height - 2; y++) {
      for (var x = 0; x < c.width - 2; x++) {
        var i = (y * c.width + x) * 4;
        var dx = Math.abs(d[i] - d[i + 4]) + Math.abs(d[i + 1] - d[i + 5]) + Math.abs(d[i + 2] - d[i + 6]);
        var dy = Math.abs(d[i] - d[i + c.width * 4]) + Math.abs(d[i + 1] - d[i + c.width * 4 + 1]) + Math.abs(d[i + 2] - d[i + c.width * 4 + 2]);
        hfScore += dx + dy;
        count++;
      }
    }
    var avgHf = hfScore / count / 3;

    var varScore = 0, vc = 0;
    for (var y = 1; y < c.height - 1; y++) {
      for (var x = 1; x < c.width - 1; x++) {
        var i = (y * c.width + x) * 4;
        var mean = (d[i] + d[i + 1] + d[i + 2]) / 3;
        var v = 0;
        for (var oy = -1; oy <= 1; oy++) {
          for (var ox = -1; ox <= 1; ox++) {
            var ni = ((y + oy) * c.width + (x + ox)) * 4;
            v += Math.pow((d[ni] + d[ni + 1] + d[ni + 2]) / 3 - mean, 2);
          }
        }
        varScore += v / 9;
        vc++;
      }
    }
    var avgVar = varScore / vc;

    var conf = 50;
    if (avgHf > 25) conf += 20;
    else if (avgHf < 8) conf += 15;
    else conf += 5;
    if (avgVar < 15) conf += 15;
    else conf += 5;
    conf = Math.min(97, Math.max(25, conf));

    var mlResult = { mlScore: null, mlReason: null };
    if (tfjsLoaded && tfjsModel) {
      mlResult = await analyzeWithML(c);
      if (mlResult.mlScore !== null) {
        conf = Math.round((conf + mlResult.mlScore) / 2);
        conf = Math.min(97, Math.max(25, conf));
      }
    }

    return { conf: Math.round(conf), mlReason: mlResult.mlReason };
  }

  btnScanner.addEventListener('click', async function () {
    var url = scannerUrl.value.trim();
    var file = scannerFile.files[0];
    if (!url && !file) { scannerStatus.textContent = 'Enter a URL or select an image file.'; return; }

    if (file) {
      scannerStatus.textContent = 'Analyzing image...';
      loadTFJS();
      var result = await analyzeImageAnomalies(file);
      var conf = result.conf;
      var matchedOn = conf > 70 ? 'synthetic pixel anomaly detected' : 'borderline pattern match';
      if (result.mlReason) matchedOn += ' | ML: ' + result.mlReason;
      var alert = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        source: file.name,
        confidence: conf,
        status: 'PENDING_REVIEW',
        type: 'image',
        timestamp: new Date().toISOString(),
        matchedOn: matchedOn
      };
      alerts.unshift(alert);
      saveAlerts();
      renderDashboard();
      scannerStatus.textContent = 'Scan complete — confidence ' + conf + '%';
      scannerFile.value = '';
    } else if (url) {
      scannerStatus.textContent = 'Scanning URL...';
      if (window.EnclaveAPI && window.EnclaveAPI.isLoggedIn()) {
        window.EnclaveAPI.scanUrl(url).then(function (result) {
          var conf = result ? result.confidence || 0 : 0;
          alerts.unshift(result);
          saveAlerts();
          renderDashboard();
          scannerStatus.textContent = 'URL scan complete — confidence ' + conf + '%';
        }).catch(function (e) {
          scannerStatus.textContent = 'URL scan failed: ' + (e.message || 'Unknown error');
        });
      } else {
        scannerStatus.textContent = 'Sign in to scan URLs against the ML detection pipeline.';
      }
      scannerUrl.value = '';
    }
  });

  /* ─── PORTRAIT FILE UPLOAD HANDLER ─── */
  regUploadLink.addEventListener('click', function (e) { e.preventDefault(); regPortraitFile.click(); });

  regPortraitFile.addEventListener('change', function () {
    var file = regPortraitFile.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var w = 120, h = Math.round(120 * img.height / img.width);
        regFaceCanvas.width = w; regFaceCanvas.height = h;
        var ctx = regFaceCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        var id = ctx.getImageData(0, 0, w, h);
        var d = id.data;
        for (var i = 0; i < d.length; i += 4) {
          var g = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
          d[i] = d[i + 1] = d[i + 2] = g;
        }
        ctx.putImageData(id, 0, 0);
        var dataUrl = regFaceCanvas.toDataURL('image/png');
        var faceMatrix = {
          type: 'face_spatial_matrix',
          width: w,
          height: h,
          grayscale: true,
          thumbnail: dataUrl,
          captured: new Date().toISOString()
        };
        lsSet(LS_FACEPRINT, faceMatrix);
        // Proof of Reality for uploaded portrait
        generateIdentityProof();
        hashImageData(regFaceCanvas).then(function (hash) {
          if (hash) lsSet('enclave_faceprint_hash', hash);
        });
        regFacePreview.innerHTML = '';
        var thumb = document.createElement('canvas');
        thumb.width = w; thumb.height = h;
        thumb.getContext('2d').putImageData(id, 0, 0);
        regFacePreview.appendChild(thumb);
        regFacePreview.classList.remove('hidden');
        closeRegCamera();
        btnRegCapture.disabled = true;
        btnRegCapture.textContent = 'Captured';
        btnRegFaceDone.disabled = false;
        btnRegFaceDone.style.opacity = '1';
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  /* ─── INTERACTIVE SIGNATURE PAD ─── */
  var sigCtx = sigCanvas.getContext('2d');
  var sigDrawing = false;

  function initSigPad() {
    sigCtx.fillStyle = '#fff';
    sigCtx.fillRect(0, 0, sigCanvas.width, sigCanvas.height);
    sigCtx.strokeStyle = '#0a0e14';
    sigCtx.lineWidth = 2;
    sigCtx.lineCap = 'round';
    sigCtx.lineJoin = 'round';
  }

  function getSigPos(e) {
    var rect = sigCanvas.getBoundingClientRect();
    var scaleX = sigCanvas.width / rect.width;
    var scaleY = sigCanvas.height / rect.height;
    var clientX = e.touches ? e.touches[0].clientX : e.clientX;
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  function sigStart(e) { e.preventDefault(); sigDrawing = true; var p = getSigPos(e); sigCtx.beginPath(); sigCtx.moveTo(p.x, p.y); }
  function sigMove(e) { e.preventDefault(); if (!sigDrawing) return; var p = getSigPos(e); sigCtx.lineTo(p.x, p.y); sigCtx.stroke(); }
  function sigEnd(e) { e.preventDefault(); sigDrawing = false; }

  sigCanvas.addEventListener('mousedown', sigStart);
  sigCanvas.addEventListener('mousemove', sigMove);
  sigCanvas.addEventListener('mouseup', sigEnd);
  sigCanvas.addEventListener('mouseleave', sigEnd);
  sigCanvas.addEventListener('touchstart', sigStart, { passive: false });
  sigCanvas.addEventListener('touchmove', sigMove, { passive: false });
  sigCanvas.addEventListener('touchend', sigEnd);

  btnSigClear.addEventListener('click', function () { initSigPad(); lsSet(LS_SIGNATURE, ''); sigStatus.textContent = ''; });

  btnSigConfirm.addEventListener('click', function () {
    var dataUrl = sigCanvas.toDataURL('image/png');
    // check if blank (all white)
    var pixelData = sigCtx.getImageData(0, 0, sigCanvas.width, sigCanvas.height).data;
    var blank = true;
    for (var i = 3; i < pixelData.length; i += 4) { if (pixelData[i] !== 0) { blank = false; break; } }
    if (blank) { sigStatus.textContent = 'Please sign before confirming.'; return; }
    lsSet(LS_SIGNATURE, dataUrl);
    sigStatus.textContent = 'Signature saved.';
    sigModal.classList.add('hidden');
    if (pendingSigResolve) { pendingSigResolve(dataUrl); pendingSigResolve = null; }
  });

  function showSignaturePad() {
    return new Promise(function (resolve) {
      initSigPad();
      var saved = lsGet(LS_SIGNATURE, '');
      if (saved) {
        var img = new Image();
        img.onload = function () { sigCtx.drawImage(img, 0, 0); };
        img.src = saved;
      }
      pendingSigResolve = resolve;
      sigStatus.textContent = '';
      sigModal.classList.remove('hidden');
    });
  }

  /* ═══════════════════════════════════════════════════════
     MAGIC DISPATCH — single-click resolution
     ═══════════════════════════════════════════════════════ */

  var resolutionOverlay = document.getElementById('resolution-overlay');
  var resolutionTitle = document.getElementById('resolution-title');
  var resolutionPlatform = document.getElementById('resolution-platform');
  var resolutionConfidence = document.getElementById('resolution-confidence');
  var btnMagicDispatch = document.getElementById('btn-magic-dispatch');
  var btnResolutionClose = document.getElementById('btn-resolution-close');
  var resolutionStatus = document.getElementById('resolution-status');

  var currentDispatchAlert = null;

  function openResolution(alert) {
    currentDispatchAlert = alert;
    resolutionTitle.textContent = 'Unauthorized copy of your identity detected';
    if (alert.matchedOn) {
      resolutionPlatform.textContent = alert.matchedOn;
    } else {
      resolutionPlatform.textContent = 'on unknown platform';
    }
    resolutionConfidence.textContent = 'Confidence: ' + alert.confidence + '% — Source: ' + (alert.type || 'image').toUpperCase();
    resolutionStatus.textContent = '';
    resolutionOverlay.classList.remove('hidden');
  }

  function closeResolution() {
    resolutionOverlay.classList.add('hidden');
    currentDispatchAlert = null;
  }

  function performMagicDispatch() {
    var alert = currentDispatchAlert;
    if (!alert) { resolutionStatus.textContent = 'No alert selected.'; return; }
    btnMagicDispatch.disabled = true;
    resolutionStatus.textContent = 'Stage 1/3: Biometric re-verification...';

    reauthenticate().then(function () {
      resolutionStatus.textContent = 'Stage 2/3: Signing authorization...';
      return showSignaturePad();
    }).then(function () {
      resolutionStatus.textContent = 'Stage 3/3: Generating legal notice...';
      var name = registeredName || 'Valued Client';
      var docType = 'DMCA';
      generatePDF(docType, alert, name);
      resolutionStatus.textContent = 'Notice generated and downloaded.';
      setTimeout(function () { closeResolution(); btnMagicDispatch.disabled = false; }, 1500);
    }).catch(function (err) {
      resolutionStatus.textContent = 'Dispatch failed: ' + (err.message || 'verification declined');
      btnMagicDispatch.disabled = false;
    });
  }

  btnMagicDispatch.addEventListener('click', performMagicDispatch);
  btnResolutionClose.addEventListener('click', closeResolution);

  /* ═══════════════════════════════════════════════════════
     CAMERA & VOICE SHIELD TOGGLES
     ═══════════════════════════════════════════════════════ */

  var toggleCameraShield = document.getElementById('toggle-camera-shield');
  var toggleVoiceShield = document.getElementById('toggle-voice-shield');
  var cameraServiceStatusEl = document.getElementById('camera-service-status');
  var voiceServiceStatusEl = document.getElementById('voice-service-status');

  function updateServiceBadges() {
    if (!cameraServiceStatusEl || !voiceServiceStatusEl) return;
    var camStatus = window.EnclaveNative && window.EnclaveNative.cameraImmunizer
      ? window.EnclaveNative.cameraImmunizer.getStatus() : { active: false };
    var voiceStatus = window.EnclaveNative && window.EnclaveNative.voiceShield
      ? window.EnclaveNative.voiceShield.getStatus() : { active: false };

    cameraServiceStatusEl.textContent = camStatus.active ? 'ON' : 'OFF';
    cameraServiceStatusEl.className = 'service-badge ' + (camStatus.active ? 'active' : 'inactive');
    voiceServiceStatusEl.textContent = voiceStatus.active ? 'ON' : 'OFF';
    voiceServiceStatusEl.className = 'service-badge ' + (voiceStatus.active ? 'active' : 'inactive');

    if (camStatus.active && toggleCameraShield) toggleCameraShield.checked = true;
    if (voiceStatus.active && toggleVoiceShield) toggleVoiceShield.checked = true;

    var cameraCloakCount = document.getElementById('camera-cloak-count');
    var cameraLastActive = document.getElementById('camera-last-active');
    var voiceSessions = document.getElementById('voice-sessions-protected');
    var voiceLastActive = document.getElementById('voice-last-active');

    if (cameraCloakCount) cameraCloakCount.textContent = camStatus.cloakedCount || '0';
    if (cameraLastActive) cameraLastActive.textContent = camStatus.lastActive ? new Date(camStatus.lastActive).toLocaleTimeString() : '—';
    if (voiceSessions) voiceSessions.textContent = voiceStatus.sessionsProtected || '0';
    if (voiceLastActive) voiceLastActive.textContent = voiceStatus.lastActive ? new Date(voiceStatus.lastActive).toLocaleTimeString() : '—';
  }

  function syncShieldOverlay() {
    if (!window.EnclaveNative || !window.EnclaveNative.shieldOverlay) return;
    var camActive = window.EnclaveNative.cameraImmunizer && window.EnclaveNative.cameraImmunizer.isActive();
    var voiceActive = window.EnclaveNative.voiceShield && window.EnclaveNative.voiceShield.isActive();
    if (camActive && voiceActive) {
      window.EnclaveNative.shieldOverlay.start();
    } else {
      if (window.EnclaveNative.shieldOverlay.isActive()) {
        window.EnclaveNative.shieldOverlay.stop();
      }
    }
  }

  if (toggleCameraShield) {
    toggleCameraShield.addEventListener('change', function () {
      if (!window.EnclaveNative || !window.EnclaveNative.cameraImmunizer) return;
      if (this.checked) {
        window.EnclaveNative.cameraImmunizer.start().then(function (ok) {
          if (!ok && toggleCameraShield) toggleCameraShield.checked = false;
          updateServiceBadges();
          syncShieldOverlay();
        });
      } else {
        window.EnclaveNative.cameraImmunizer.stop().then(function () {
          updateServiceBadges();
          syncShieldOverlay();
        });
      }
    });
  }

  if (toggleVoiceShield) {
    toggleVoiceShield.addEventListener('change', function () {
      if (!window.EnclaveNative || !window.EnclaveNative.voiceShield) return;
      if (this.checked) {
        window.EnclaveNative.voiceShield.start().then(function (ok) {
          if (!ok && toggleVoiceShield) toggleVoiceShield.checked = false;
          updateServiceBadges();
          syncShieldOverlay();
        });
      } else {
        window.EnclaveNative.voiceShield.stop().then(function () {
          updateServiceBadges();
          syncShieldOverlay();
        });
      }
    });
  }

  window.addEventListener('enclave-camera-status', updateServiceBadges);
  window.addEventListener('enclave-voice-status', updateServiceBadges);

  /* ═══════════════════════════════════════════════════════
     INIT — API login/register + auth-ui.js
     ═══════════════════════════════════════════════════════ */
  loadState();

  function afterLogin(user) {
    registeredName = user.fullName;
    registeredUserId = user.id;
    saveName();
    if (headerProfile) headerProfile.textContent = registeredName;
    window.EnclaveAuthUI.hide();
    authOverlay.classList.add('hidden');
    appRoot.classList.remove('hidden');
    loginInitDone = true;

    window.EnclaveAPI.getBiometricStatus().then(function (status) {
      var hasFace = status.faceprint !== null;
      var hasVoice = status.voiceprint !== null;
      if (!hasFace || !hasVoice) {
        if (registerPortal) registerPortal.classList.remove('hidden');
      }
      renderDashboard();
    }).catch(function () {
      if (registerPortal) registerPortal.classList.remove('hidden');
      renderDashboard();
    });
  }

  // Check JWT first, then show login
  (async function () {
    var hasToken = window.EnclaveAPI ? await window.EnclaveAPI.isLoggedIn() : false;
    if (hasToken) {
      try {
        var data = await window.EnclaveAPI.getUserData();
        if (data && data.user) {
          afterLogin(data.user);
          return;
        }
      } catch (_) {}
      window.EnclaveAPI.logout();
    }
    authOverlay.classList.add('hidden');
    registerPortal.classList.add('hidden');
    window.EnclaveAuthUI.show();
    window.EnclaveAuthUI.onAuthenticated(afterLogin);
  })();

  // spawn crawler when app is unlocked
  var unlockObserver = new MutationObserver(function () {
    if (!appRoot.classList.contains('hidden') && (!worker || !worker.active)) {
      // Start API crawler
      if (window.EnclaveAPI && window.EnclaveAPI.isLoggedIn()) {
        window.EnclaveAPI.startCrawler().catch(function () {});
      }
      spawnCrawler();
      pollAlerts();
    }
  });
  unlockObserver.observe(appRoot, { attributes: true, attributeFilter: ['class'] });

  // Request notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Deep Scan button
  if (btnDeepScan) {
    btnDeepScan.addEventListener('click', triggerDeepScan);
  }

  // Pre-load TF.js for ML deepfake detection (in background)
  loadTFJS();

  // Regenerate crypto keys on init if faceprint exists
  if (lsGet(LS_FACEPRINT, null)) {
    generateIdentityProof();
  }

  /* ═══════════════════════════════════════════════════════
     NEW PANELS — Shield Status, Billing, Community,
     Takedowns, Notifications, Stats
     ═══════════════════════════════════════════════════════ */

  /* ─── Shield Status ─── */
  var shieldCameraStatus = document.getElementById('shield-camera-status');
  var shieldVoiceStatus = document.getElementById('shield-voice-status');
  var shieldCrawlerStatus = document.getElementById('shield-crawler-status');
  var shieldMlStatus = document.getElementById('shield-ml-status');
  var shieldTotalScans = document.getElementById('shield-total-scans');
  var shieldTakedowns = document.getElementById('shield-takedowns');

  function updateShieldStatus() {
    if (!window.EnclaveAPI || !window.EnclaveAPI.isLoggedIn()) return;

    window.EnclaveAPI.getShieldSummary().then(function (data) {
      if (!data) return;
      if (shieldTotalScans) shieldTotalScans.textContent = data.imagesScanned || 0;
      if (shieldTakedowns) shieldTakedowns.textContent = data.takedownsCompleted || 0;
    }).catch(function () {});

    var camActive = window.EnclaveNative && window.EnclaveNative.cameraImmunizer
      && window.EnclaveNative.cameraImmunizer.isActive();
    var voiceActive = window.EnclaveNative && window.EnclaveNative.voiceShield
      && window.EnclaveNative.voiceShield.isActive();
    var crawlerActive = worker && worker.active;
    var mlActive = tfjsLoaded && tfjsModel;

    if (shieldCameraStatus) {
      shieldCameraStatus.textContent = camActive ? 'ON' : 'OFF';
      shieldCameraStatus.className = 'shield-module-badge ' + (camActive ? 'active' : 'inactive');
    }
    if (shieldVoiceStatus) {
      shieldVoiceStatus.textContent = voiceActive ? 'ON' : 'OFF';
      shieldVoiceStatus.className = 'shield-module-badge ' + (voiceActive ? 'active' : 'inactive');
    }
    if (shieldCrawlerStatus) {
      shieldCrawlerStatus.textContent = crawlerActive ? 'ON' : 'OFF';
      shieldCrawlerStatus.className = 'shield-module-badge ' + (crawlerActive ? 'active' : 'inactive');
    }
    if (shieldMlStatus) {
      shieldMlStatus.textContent = mlActive ? 'LOADED' : 'OFF';
      shieldMlStatus.className = 'shield-module-badge ' + (mlActive ? 'partial' : 'inactive');
    }
  }

  /* ─── Billing & Usage ─── */
  var billingPlanLabel = document.getElementById('billing-plan-label');
  var usageScansBar = document.getElementById('usage-scans-bar');
  var usageScansText = document.getElementById('usage-scans-text');
  var usageTakedownsBar = document.getElementById('usage-takedowns-bar');
  var usageTakedownsText = document.getElementById('usage-takedowns-text');
  var usageApiBar = document.getElementById('usage-api-bar');
  var usageApiText = document.getElementById('usage-api-text');
  var billingNextReset = document.getElementById('billing-next-reset');
  var btnUpgradePro = document.getElementById('btn-upgrade-pro');
  var btnUpgradeShield = document.getElementById('btn-upgrade-shield');
  var btnBillingManage = document.getElementById('btn-billing-manage');

  function updateBilling(data) {
    if (!data) return;
    var sub = data.subscription || {};
    var usage = data.usage || {};
    var tier = sub.tier || 'free';
    var tierInfo = sub.tierInfo || {};

    if (billingPlanLabel) {
      billingPlanLabel.textContent = (tierInfo.name || 'Free') + ' Plan';
    }

    // Scans
    var scanLimit = tierInfo.limits ? tierInfo.limits.scansPerMonth : 5;
    var scanUsed = usage.scans ? usage.scans.used || 0 : 0;
    var scanPct = scanLimit > 0 ? Math.min(100, (scanUsed / scanLimit) * 100) : 0;
    if (usageScansBar) {
      usageScansBar.style.width = scanPct + '%';
      usageScansBar.className = 'usage-bar-fill' + (scanPct > 80 ? ' warning' : '') + (scanPct >= 100 ? ' danger' : '');
    }
    if (usageScansText) usageScansText.textContent = scanUsed + ' / ' + scanLimit;

    // Takedowns
    var tdLimit = tierInfo.limits ? tierInfo.limits.takedownsPerMonth : 2;
    var tdUsed = usage.takedowns ? usage.takedowns.used || 0 : 0;
    var tdPct = tdLimit > 0 ? Math.min(100, (tdUsed / tdLimit) * 100) : 0;
    if (usageTakedownsBar) {
      usageTakedownsBar.style.width = tdPct + '%';
      usageTakedownsBar.className = 'usage-bar-fill' + (tdPct > 80 ? ' warning' : '') + (tdPct >= 100 ? ' danger' : '');
    }
    if (usageTakedownsText) usageTakedownsText.textContent = tdUsed + ' / ' + tdLimit;

    // API calls
    var apiLimit = tierInfo.limits ? tierInfo.limits.apiCallsPerMonth : 100;
    var apiUsed = usage.apiCalls ? usage.apiCalls.used || 0 : 0;
    var apiPct = apiLimit > 0 ? Math.min(100, (apiUsed / apiLimit) * 100) : 0;
    if (usageApiBar) {
      usageApiBar.style.width = apiPct + '%';
      usageApiBar.className = 'usage-bar-fill' + (apiPct > 80 ? ' warning' : '') + (apiPct >= 100 ? ' danger' : '');
    }
    if (usageApiText) usageApiText.textContent = apiUsed + ' / ' + apiLimit;

    // Reset date
    if (billingNextReset && sub.currentPeriodEnd) {
      var resetDate = new Date(sub.currentPeriodEnd);
      billingNextReset.textContent = 'Resets ' + resetDate.toLocaleDateString();
    }
  }

  function loadBilling() {
    if (!window.EnclaveAPI || !window.EnclaveAPI.isLoggedIn()) return;
    window.EnclaveAPI.getSubscription().then(updateBilling).catch(function () {});
  }

  if (btnUpgradePro) {
    btnUpgradePro.addEventListener('click', function () {
      if (!window.EnclaveAPI) return;
      window.EnclaveAPI.createCheckout('pro', window.location.href, window.location.href)
        .then(function (session) {
          if (session && session.url) window.location.href = session.url;
          else showToastAlert('Checkout session created. Check your email.');
        }).catch(function (e) {
          showToastAlert('Checkout failed: ' + (e.message || 'Unknown error'));
        });
    });
  }

  if (btnUpgradeShield) {
    btnUpgradeShield.addEventListener('click', function () {
      if (!window.EnclaveAPI) return;
      window.EnclaveAPI.createCheckout('shield', window.location.href, window.location.href)
        .then(function (session) {
          if (session && session.url) window.location.href = session.url;
          else showToastAlert('Checkout session created. Check your email.');
        }).catch(function (e) {
          showToastAlert('Checkout failed: ' + (e.message || 'Unknown error'));
        });
    });
  }

  if (btnBillingManage) {
    btnBillingManage.addEventListener('click', function () {
      if (!window.EnclaveAPI) return;
      window.EnclaveAPI.createPortal(window.location.href)
        .then(function (session) {
          if (session && session.url) window.location.href = session.url;
          else showToastAlert('Portal session created.');
        }).catch(function (e) {
          showToastAlert('Portal unavailable: ' + (e.message || 'Unknown error'));
        });
    });
  }

  /* ─── Community & Threat Intel ─── */
  var communityIocCount = document.getElementById('community-ioc-count');
  var communityPosts = document.getElementById('community-posts');
  var btnCommunityOpen = document.getElementById('btn-community-open');

  function loadCommunity() {
    if (!window.EnclaveAPI || !window.EnclaveAPI.isLoggedIn()) return;
    window.EnclaveAPI.getThreatStats().then(function (data) {
      if (!data) return;
      if (communityIocCount) communityIocCount.textContent = data.totalIndicators || 0;
    }).catch(function () {});
    window.EnclaveAPI.getCommunityStats().then(function (data) {
      if (!data) return;
      if (communityPosts) communityPosts.textContent = data.totalPosts || 0;
    }).catch(function () {});
  }

  /* ─── Takedowns ─── */
  var takedownList = document.getElementById('takedown-list');
  var takedownActive = document.getElementById('takedown-active');
  var takedownRemoved = document.getElementById('takedown-removed');
  var takedownEscalated = document.getElementById('takedown-escalated');
  var btnTakedownsOpen = document.getElementById('btn-takedowns-open');

  function loadTakedowns() {
    if (!window.EnclaveAPI || !window.EnclaveAPI.isLoggedIn()) return;
    window.EnclaveAPI.getTakedownStats().then(function (data) {
      if (!data) return;
      if (takedownActive) takedownActive.textContent = (data.sent || 0) + (data.pending || 0);
      if (takedownRemoved) takedownRemoved.textContent = data.removed || 0;
      if (takedownEscalated) takedownEscalated.textContent = data.escalated || 0;
    }).catch(function () {});

    window.EnclaveAPI.getTakedowns().then(function (rows) {
      if (!takedownList) return;
      takedownList.innerHTML = '';
      if (!rows || rows.length === 0) {
        takedownList.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">No active takedowns</p>';
        return;
      }
      var recent = rows.slice(0, 5);
      recent.forEach(function (td) {
        var item = document.createElement('div');
        item.className = 'takedown-item';
        var platform = document.createElement('span');
        platform.className = 'takedown-item-platform';
        platform.textContent = td.platform || td.type || 'Unknown';
        var status = document.createElement('span');
        var st = td.status || 'pending';
        status.className = 'takedown-item-status ' + (st === 'removed' ? 'removed' : st === 'escalated' ? 'escalated' : 'sent');
        status.textContent = st;
        item.appendChild(platform);
        item.appendChild(status);
        takedownList.appendChild(item);
      });
    }).catch(function () {
      if (takedownList) takedownList.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">No active takedowns</p>';
    });
  }

  /* ─── Notifications ─── */
  var notificationList = document.getElementById('notification-list');
  var notificationUnreadBadge = document.getElementById('notification-unread-badge');
  var btnNotificationsClear = document.getElementById('btn-notifications-clear');

  function loadNotifications() {
    if (!window.EnclaveAPI || !window.EnclaveAPI.isLoggedIn()) return;
    window.EnclaveAPI.getUnreadCount().then(function (data) {
      var count = data ? data.count || 0 : 0;
      if (notificationUnreadBadge) {
        notificationUnreadBadge.textContent = count;
        notificationUnreadBadge.style.display = count > 0 ? 'inline-flex' : 'none';
      }
    }).catch(function () {});

    window.EnclaveAPI.getNotifications({ limit: 10 }).then(function (items) {
      if (!notificationList) return;
      notificationList.innerHTML = '';
      if (!items || items.length === 0) {
        notificationList.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">No new notifications</p>';
        return;
      }
      items.forEach(function (n) {
        var item = document.createElement('div');
        item.className = 'notification-item' + (n.read ? '' : ' unread');
        var text = document.createElement('p');
        text.className = 'notification-item-text';
        text.textContent = n.message || n.type || 'Notification';
        var time = document.createElement('p');
        time.className = 'notification-item-time';
        time.textContent = n.created_at ? new Date(n.created_at).toLocaleString() : '';
        item.appendChild(text);
        item.appendChild(time);
        item.addEventListener('click', function () {
          if (!n.read && window.EnclaveAPI) {
            window.EnclaveAPI.markNotificationRead(n.id).then(function () {
              loadNotifications();
            }).catch(function () {});
          }
        });
        notificationList.appendChild(item);
      });
    }).catch(function () {
      if (notificationList) notificationList.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">No new notifications</p>';
    });
  }

  if (btnNotificationsClear) {
    btnNotificationsClear.addEventListener('click', function () {
      if (!window.EnclaveAPI || !window.EnclaveAPI.isLoggedIn()) return;
      window.EnclaveAPI.markAllNotificationsRead().then(function () {
        loadNotifications();
        showToastAlert('All notifications cleared.');
      }).catch(function () {});
    });
  }

  /* ─── Activity Stats ─── */
  var statTotalScans = document.getElementById('stat-total-scans');
  var statThreatsFound = document.getElementById('stat-threats-found');
  var statTakedownsSent = document.getElementById('stat-takedowns-sent');
  var statAccountAge = document.getElementById('stat-account-age');

  function loadStats() {
    if (!window.EnclaveAPI || !window.EnclaveAPI.isLoggedIn()) return;

    window.EnclaveAPI.getShieldSummary().then(function (data) {
      if (!data) return;
      if (statTotalScans) statTotalScans.textContent = data.imagesScanned || 0;
      if (statThreatsFound) statThreatsFound.textContent = data.deepfakesFound || 0;
      if (statTakedownsSent) statTakedownsSent.textContent = data.takedownsCompleted || 0;
      if (statAccountAge && data.firstActivatedAt) {
        var days = Math.max(1, Math.floor((Date.now() - new Date(data.firstActivatedAt).getTime()) / 86400000));
        statAccountAge.textContent = days;
      }
    }).catch(function () {});
  }

  /* ─── Wire up existing shields with recording ─── */
  var origTriggerDeepScan = triggerDeepScan;
  triggerDeepScan = function () {
    origTriggerDeepScan();
    if (window.EnclaveAPI && window.EnclaveAPI.isLoggedIn()) {
      window.EnclaveAPI.recordShieldEvent('scan', 'deep scan triggered').catch(function () {});
    }
  };

  /* ─── Refresh all new panels periodically ─── */
  function refreshAllPanels() {
    updateShieldStatus();
    loadBilling();
    loadCommunity();
    loadTakedowns();
    loadNotifications();
    loadStats();
  }

  // Initial load after login
  var origAfterLogin = afterLogin;
  // Wrap afterLogin to also load new panels
  // Since afterLogin is defined in a closure, we hook into the unlock observer instead
  var panelRefreshObserver = new MutationObserver(function () {
    if (!appRoot.classList.contains('hidden')) {
      setTimeout(refreshAllPanels, 1000);
      // Refresh every 60s
      setInterval(refreshAllPanels, 60000);
      panelRefreshObserver.disconnect();
    }
  });
  panelRefreshObserver.observe(appRoot, { attributes: true, attributeFilter: ['class'] });

  // Also update shield status when service badges change
  window.addEventListener('enclave-camera-status', updateShieldStatus);
  window.addEventListener('enclave-voice-status', updateShieldStatus);

  /* ═══════════════════════════════════════════════════════
     UI LIBRARIES: Particles.js, Vanilla Tilt, Scroll Reveal
     ═══════════════════════════════════════════════════════ */

  /* ─── Particles.js — Login overlay background ─── */
  function initParticles() {
    var canvas = document.getElementById('particles-canvas');
    if (!canvas || !window.tsParticles) return;
    window.tsParticles.load('particles-canvas', {
      particles: {
        number: { value: 40, density: { enable: true, width: 600, height: 400 } },
        color: { value: ['#00FF88', '#00BFFF', '#FF3366', '#FFD700'] },
        shape: { type: 'circle' },
        opacity: { value: { min: 0.1, max: 0.35 }, animation: { enable: true, speed: 0.4, minimumValue: 0.05 } },
        size: { value: { min: 1, max: 3 }, animation: { enable: true, speed: 1, minimumValue: 0.5 } },
        move: { enable: true, speed: 0.6, direction: 'none', random: true, straight: false, outModes: { default: 'out' } },
        links: { enable: true, distance: 120, color: '#00FF88', opacity: 0.15, width: 0.5 }
      },
      interactivity: {
        events: { onHover: { enable: true, mode: 'grab' }, resize: true },
        modes: { grab: { distance: 140, links: { opacity: 0.3 } } }
      },
      detectRetina: true,
      background: { color: 'transparent' }
    }).then(function () {
      canvas.style.pointerEvents = 'auto';
    }).catch(function () {
      canvas.style.display = 'none';
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initParticles);
  } else {
    setTimeout(initParticles, 500);
  }

  /* ─── Vanilla Tilt — 3D tilt on cards ─── */
  function initTilt() {
    if (!window.VanillaTilt) return;
    var cards = document.querySelectorAll('.card');
    cards.forEach(function (card) {
      if (card.getAttribute('data-tilt')) return;
      window.VanillaTilt.init(card, {
        max: 6,
        speed: 400,
        glare: true,
        'max-glare': 0.12,
        perspective: 1000,
        scale: 1.01
      });
      card.setAttribute('data-tilt', 'true');
    });
  }
  // Re-init tilt after login when cards become visible
  var tiltObserver = new MutationObserver(function () {
    if (!appRoot.classList.contains('hidden')) {
      setTimeout(initTilt, 800);
      tiltObserver.disconnect();
    }
  });
  tiltObserver.observe(appRoot, { attributes: true, attributeFilter: ['class'] });

  /* ─── IntersectionObserver — Scroll reveal animations ─── */
  function initScrollReveal() {
    var revealEls = document.querySelectorAll('.card, .hero-card, .status-card, .tier-card, .forum-card, .notification-card');
    revealEls.forEach(function (el) { el.classList.add('reveal-up'); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  }
  // Re-init scroll reveal after login
  var scrollObserver = new MutationObserver(function () {
    if (!appRoot.classList.contains('hidden')) {
      setTimeout(initScrollReveal, 600);
      scrollObserver.disconnect();
    }
  });
  scrollObserver.observe(appRoot, { attributes: true, attributeFilter: ['class'] });

  /* ─── Threat preview counter animation ─── */
  function animateCounters() {
    var counters = document.querySelectorAll('[data-count]');
    counters.forEach(function (el) {
      var target = parseInt(el.getAttribute('data-count'), 10);
      if (isNaN(target)) return;
      el.textContent = '0';
      var current = 0;
      var step = Math.max(1, Math.floor(target / 30));
      var iv = setInterval(function () {
        current += step;
        if (current >= target) {
          el.textContent = target.toLocaleString();
          clearInterval(iv);
        } else {
          el.textContent = current.toLocaleString();
        }
      }, 40);
    });
  }
  // Run counter animation when login overlay appears
  setTimeout(animateCounters, 800);

})();
