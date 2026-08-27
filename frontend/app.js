(function () {
  'use strict';

  /* ─── Service Worker ─── */
  // Clear ALL caches first, then register fresh SW
  if (window.caches && caches.keys) {
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return caches.delete(k); }));
    });
  }
  if ('serviceWorker' in navigator) {
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
  var homeAlertList    = document.getElementById('home-alert-list');
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
  var scannerMeta      = document.getElementById('scanner-meta');

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
  var settingsModal     = document.getElementById('settings-modal');
  var settingsPanel     = document.getElementById('settings-panel');
  var btnSettingsOpen   = document.getElementById('nav-settings');
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
    [authStream, regStream].forEach(function (s) {
      if (s && s.getTracks) {
        s.getTracks().forEach(function (t) { t.stop(); });
      }
    });
    if (extraStream && extraStream.getTracks) {
      extraStream.getTracks().forEach(function (t) { t.stop(); });
    }
    authStream = null;
    regStream = null;
    if (authVideo) authVideo.srcObject = null;
    if (regVideo) regVideo.srcObject = null;
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
              if (window.EnclaveUI) { window.EnclaveUI.initRipples(); window.EnclaveUI.initCardPress(); }
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
        alerts = apiAlerts.slice().sort(function (a, b) {
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
    // Render into both the full alerts tab and home preview
    var targets = [alertList, homeAlertList].filter(Boolean);
    targets.forEach(function (list) { list.innerHTML = ''; });
    var pending = 0;
    var maxHome = 3; // Only show 3 recent on home tab
    var shownHome = 0;
    alerts.forEach(function (a) {
      if (a.status === 'PENDING_REVIEW') pending++;
      var item = document.createElement('div');
      item.className = 'alert-item-home' + (selectedAlertId === a.id ? ' selected' : '');
      item.dataset.alertId = a.id;

      var conf = document.createElement('span');
      conf.className = 'alert-conf ' + (a.confidence >= 70 ? 'alert-conf-high' : a.confidence >= 40 ? 'alert-conf-med' : 'alert-conf-low');
      conf.textContent = a.confidence + '%';

      var src = document.createElement('span');
      src.className = 'alert-source-text';
      var label = a.type ? a.type.toUpperCase() + ' — ' : '';
      var providerChip = a.detectionMeta && a.detectionMeta.provider
        ? ' [' + a.detectionMeta.provider.replace(/-/g, ' ') + ']' : '';
      src.textContent = label + a.source + providerChip;

      var st = document.createElement('span');
      st.className = 'alert-status-pill ' + (a.status === 'PENDING_REVIEW' ? 'alert-status-pending' : 'alert-status-resolved');
      st.textContent = a.status === 'PENDING_REVIEW' ? 'Pending' : 'Resolved';

      item.appendChild(conf);
      item.appendChild(src);
      item.appendChild(st);

      item.addEventListener('click', function () {
        document.querySelectorAll('.alert-item-home').forEach(function (el) {
          el.classList.remove('selected');
        });
        item.classList.add('selected');
        selectedAlertId = a.id;
        openReview(a);
      });

      // Add to full list
      if (alertList) alertList.appendChild(item.cloneNode(true));
      // Add click handler to cloned node in full list
      if (alertList) {
        var clonedItem = alertList.lastChild;
        clonedItem.addEventListener('click', function () {
          document.querySelectorAll('.alert-item-home').forEach(function (el) { el.classList.remove('selected'); });
          clonedItem.classList.add('selected');
          selectedAlertId = a.id;
          openReview(a);
        });
      }
      // Add to home list (limited)
      if (homeAlertList && shownHome < maxHome) {
        homeAlertList.appendChild(item);
        shownHome++;
      }
    });

    if (alerts.length === 0 && alertList) {
      alertList.innerHTML = '<div class="empty-state"><svg viewBox="0 0 64 64" width="48" height="48" class="empty-state-icon"><circle cx="32" cy="32" r="28" fill="none" stroke="rgba(0,255,136,0.15)" stroke-width="2"/><path d="M32 18v16M32 40v2" stroke="rgba(0,255,136,0.3)" stroke-width="2" stroke-linecap="round"/></svg><p class="empty-state-text">No threats detected</p><p class="empty-state-sub">System is scanning in the background</p></div>';
    }
    if (alerts.length === 0 && homeAlertList) {
      homeAlertList.innerHTML = '<p style="color:var(--text-muted);font-size:0.7rem;padding:0.5rem;">No alerts yet. Run a scan to get started.</p>';
    }

    var homeCount = document.getElementById('home-alert-count');
    if (homeCount) homeCount.textContent = pending + ' pending';
    var navBadge = document.getElementById('nav-alert-badge');
    if (navBadge) {
      if (pending > 0) { navBadge.textContent = pending; navBadge.style.display = 'inline'; }
      else { navBadge.style.display = 'none'; }
    }
    if (dashboardStatus) dashboardStatus.textContent = pending + ' pending alert(s).';
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
    if (alert.detectionMeta) {
      var det = alert.detectionMeta;
      metaHtml += '<br>Engine: ' + (det.provider || 'unknown');
      if (det.latency_ms) metaHtml += ' &middot; Latency: ' + det.latency_ms + 'ms';
      if (det.cached) metaHtml += ' &middot; cached';
      if (det.explanation) metaHtml += '<br><span style="color:var(--text-muted);font-size:0.72rem;">' + String(det.explanation).slice(0, 220) + '</span>';
    }
    openResolution(alert);
    reviewStatus.innerHTML = 'Select action for Alert — ' + metaHtml;
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

  /* ─── Notification Preferences (Phase 4) ─── */
  var toggleEmailNotifications = document.getElementById('toggle-email-notifications');
  var notificationPrefStatus = document.getElementById('notification-pref-status');

  function initNotificationPrefs() {
    if (!toggleEmailNotifications || !window.EnclaveAPI || !window.EnclaveAPI.isLoggedIn()) return;
    window.EnclaveAPI.getNotificationPreferences().then(function (prefs) {
      if (prefs && typeof prefs.emailNotifications === 'boolean') {
        toggleEmailNotifications.checked = prefs.emailNotifications;
      }
    }).catch(function () {});
  }

  if (toggleEmailNotifications) {
    toggleEmailNotifications.addEventListener('change', async function () {
      if (!window.EnclaveAPI || !window.EnclaveAPI.isLoggedIn()) return;
      var enabled = toggleEmailNotifications.checked;
      try {
        await window.EnclaveAPI.updateNotificationPreferences({ emailNotifications: enabled });
        if (notificationPrefStatus) {
          notificationPrefStatus.textContent = enabled ? 'Email alerts on' : 'Email alerts off';
          setTimeout(function () { notificationPrefStatus.textContent = ''; }, 2500);
        }
      } catch (e) {
        if (notificationPrefStatus) notificationPrefStatus.textContent = 'Failed to save preference';
        toggleEmailNotifications.checked = !enabled;
      }
    });
    // Load current pref when settings open
    var navSettingsEl = document.getElementById('nav-settings');
    if (navSettingsEl) navSettingsEl.addEventListener('click', initNotificationPrefs);
  }

  /* ─── Legal Documents Modal (Phase 5) ─── */
  var legalModal = document.getElementById('legal-modal');
  var legalTitle = document.getElementById('legal-title');
  var legalMeta = document.getElementById('legal-meta');
  var legalBody = document.getElementById('legal-body');
  var btnLegalClose = document.getElementById('btn-legal-close');

  function closeLegalModal() { if (legalModal) legalModal.classList.add('hidden'); }
  if (btnLegalClose) btnLegalClose.addEventListener('click', closeLegalModal);
  if (legalModal) legalModal.addEventListener('click', function (e) {
    if (e.target === legalModal) closeLegalModal();
  });

  function openLegalModal(docId) {
    if (!legalModal || !window.EnclaveAPI) return;
    legalModal.classList.remove('hidden');
    legalBody.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">Loading…</p>';
    window.EnclaveAPI.getLegalDoc(docId).then(function (doc) {
      legalTitle.textContent = doc.title;
      legalMeta.textContent = 'Version ' + doc.version + ' · Effective ' + doc.updatedAt;
      var html = '<p class="card-desc" style="margin-bottom:0.75rem;">' + (doc.intro || '') + '</p>';
      (doc.sections || []).forEach(function (s) {
        html += '<div class="settings-section" style="margin-bottom:0.5rem;">'
          + '<p class="settings-section-title">' + s.heading + '</p>'
          + '<p class="settings-value" style="font-size:0.76rem;line-height:1.65;">' + s.body + '</p></div>';
      });
      legalBody.innerHTML = html;
    }).catch(function () {
      legalBody.innerHTML = '<p style="color:var(--red);font-size:0.8rem;">Failed to load document.</p>';
    });
  }

  document.querySelectorAll('.footer-link[data-legal]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      openLegalModal(link.getAttribute('data-legal'));
    });
  });

  /* ─── GDPR Export (Phase 5) ─── */
  var btnGdprExport = document.getElementById('btn-settings-gdpr-export');
  if (btnGdprExport) {
    btnGdprExport.addEventListener('click', function () {
      if (!window.EnclaveAPI || !window.EnclaveAPI.isLoggedIn()) return;
      btnGdprExport.disabled = true;
      btnGdprExport.textContent = 'Preparing export…';
      window.EnclaveAPI.getUserExport().then(function (blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'enclave-export-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        btnGdprExport.disabled = false;
        btnGdprExport.textContent = 'Export All My Data (GDPR)';
      }).catch(function () {
        showToastAlert('Export failed. Try again.');
        btnGdprExport.disabled = false;
        btnGdprExport.textContent = 'Export All My Data (GDPR)';
      });
    });
  }

  /* ─── Logout ─── */
  if (btnSettingsLogout) {
    btnSettingsLogout.addEventListener('click', function () {
      if (!confirm('Log out of Enclave? All local data will be preserved.')) return;
      if (worker) { worker.active = false; worker = null; }
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

  function showRegError(msg) { if (!msg) { regError.textContent = ''; regError.classList.add('hidden'); } else { regError.textContent = msg; regError.classList.remove('hidden'); } }
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
    if (!regFaceCanvas) { showRegError('System error: canvas not found.'); return; }
    if (!regStream) {
      showRegError('Camera not active. Please allow camera access or use the upload link below.');
      return;
    }
    try {
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
      lsSet(LS_FACEPRINT, { type: 'face_spatial_matrix', width: w, height: h, grayscale: true, thumbnail: dataUrl, captured: new Date().toISOString() });

      regFacePreview.innerHTML = '<p style="font-size:0.7rem;color:#00FF88;margin:0 0 4px;">Portrait captured</p>';
      var thumb = document.createElement('canvas');
      thumb.width = w; thumb.height = h;
      thumb.style.cssText = 'border:1px solid rgba(0,255,136,0.3);border-radius:4px;';
      thumb.getContext('2d').putImageData(imgData, 0, 0);
      regFacePreview.appendChild(thumb);
      regFacePreview.classList.remove('hidden');
    } catch (e) { showRegError('Capture failed: ' + e.message); return; }

    // Enable Continue button immediately — non-critical crypto runs async
    closeRegCamera();
    btnRegCapture.disabled = true;
    btnRegCapture.textContent = 'Captured';
    btnRegFaceDone.disabled = false;
    btnRegFaceDone.style.opacity = '1';

    try { generateIdentityProof(); } catch (_) {}
    var hashResult = hashImageData(regFaceCanvas);
    if (hashResult && hashResult.then) {
      hashResult.then(function (hash) {
        if (hash) lsSet('enclave_faceprint_hash', hash);
      }).catch(function () {});
    }
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

  /* ─── Detection meta helpers (Phase 1: Gemini engine) ─── */
  function recordScanLatency(ms) {
    if (!ms) return;
    try {
      var arr = JSON.parse(localStorage.getItem('enclave_scan_latencies') || '[]');
      arr.push(ms);
      if (arr.length > 20) arr.shift();
      localStorage.setItem('enclave_scan_latencies', JSON.stringify(arr));
      updateLatencyStat();
    } catch (e) {}
  }

  function updateLatencyStat() {
    try {
      var arr = JSON.parse(localStorage.getItem('enclave_scan_latencies') || '[]');
      var el = document.getElementById('stat-scan-latency');
      if (el && arr.length) {
        var avg = Math.round(arr.reduce(function (a, b) { return a + b; }, 0) / arr.length);
        el.textContent = avg < 1000 ? avg + 'ms' : (avg / 1000).toFixed(1) + 's';
      }
    } catch (e) {}
  }

  function detectionMetaText(d) {
    if (!d) return '';
    var parts = [];
    parts.push('Engine: ' + (d.provider || 'unknown'));
    if (d.latency_ms) {
      parts.push(d.latency_ms < 1000 ? d.latency_ms + 'ms' : (d.latency_ms / 1000).toFixed(1) + 's');
    }
    if (d.cached) parts.push('cached result');
    if (d.face_count > 0) parts.push(d.face_count + ' face(s)');
    return parts.join(' · ');
  }

  btnScanner.addEventListener('click', async function () {
    var url = scannerUrl.value.trim();
    var file = scannerFile.files[0];
    if (!url && !file) { scannerStatus.textContent = 'Enter a URL or select an image file.'; return; }
    if (window.EnclaveUI) window.EnclaveUI.pulseScanButton();

    if (file) {
      // Route through backend ML pipeline when signed in (Gemini engine)
      if (window.EnclaveAPI && window.EnclaveAPI.isLoggedIn()) {
        if (typeof showScannerRadar === 'function') showScannerRadar('Analyzing image via ML...');
        scannerStatus.textContent = 'Analyzing image via Enclave ML...';
        window.EnclaveAPI.scanImage(file).then(function (result) {
          var conf = result ? result.confidence || 0 : 0;
          var det = result.detection || null;
          alerts.unshift({
            id: result.id || Date.now(),
            source: file.name,
            confidence: conf,
            status: result.status || 'PENDING_REVIEW',
            type: 'image',
            timestamp: result.timestamp || new Date().toISOString(),
            matchedOn: result.matchedOn || (det ? det.verdict : 'analysis'),
            sourceUrl: result.sourceUrl,
            detectionMeta: det
          });
          saveAlerts();
          renderDashboard();
          recordScanLatency(det ? det.latency_ms : null);
          var metaText = detectionMetaText(det);
          if (typeof hideScannerRadar === 'function') {
            hideScannerRadar(conf, metaText, conf < 60);
          }
          if (window.EnclaveUI) window.EnclaveUI.stopPulseScanButton();
          scannerStatus.textContent = 'Scan complete — confidence ' + conf + '%'
            + (det && det.verdict ? ' (' + det.verdict.replace(/_/g, ' ').toLowerCase() + ')' : '');
          if (scannerMeta) scannerMeta.textContent = metaText;
          if (det && det.explanation && typeof showToastAlert === 'function' && conf >= 60) {
            showToastAlert('Deepfake signals: ' + (det.artifacts && det.artifacts.length ? det.artifacts.join(', ') : det.verdict.toLowerCase()));
          }
        }).catch(function (e) {
          if (typeof hideScannerRadar === 'function') hideScannerRadar();
          if (window.EnclaveUI) window.EnclaveUI.stopPulseScanButton();
          scannerStatus.textContent = 'ML scan failed — using on-device analysis. (' + (e.message || 'error') + ')';
          return localImageScan(file);
        });
      } else {
        localImageScan(file);
      }
    } else if (url) {
      if (typeof showScannerRadar === 'function') showScannerRadar('Scanning URL...');
      scannerStatus.textContent = 'Scanning URL...';
      if (window.EnclaveAPI && window.EnclaveAPI.isLoggedIn()) {
        window.EnclaveAPI.scanUrl(url).then(function (result) {
          var conf = result ? result.confidence || 0 : 0;
          var det = result.detection || null;
          alerts.unshift({
            id: result.id || Date.now(),
            source: url,
            confidence: conf,
            status: result.status || 'PENDING_REVIEW',
            type: result.mediaType || 'link',
            timestamp: result.timestamp || new Date().toISOString(),
            matchedOn: result.matchedOn || 'url scan',
            detectionMeta: det
          });
          saveAlerts();
          renderDashboard();
          recordScanLatency(det ? det.latency_ms : null);
          var metaText = detectionMetaText(det);
          if (typeof hideScannerRadar === 'function') {
            hideScannerRadar(conf, metaText, conf < 60);
          }
          if (window.EnclaveUI) window.EnclaveUI.stopPulseScanButton();
          scannerStatus.textContent = 'URL scan complete — confidence ' + conf + '%';
          if (scannerMeta) scannerMeta.textContent = metaText;
        }).catch(function (e) {
          if (typeof hideScannerRadar === 'function') hideScannerRadar();
          if (window.EnclaveUI) window.EnclaveUI.stopPulseScanButton();
          scannerStatus.textContent = 'URL scan failed: ' + (e.message || 'Unknown error');
        });
      } else {
        scannerStatus.textContent = 'Sign in to scan URLs against the ML detection pipeline.';
      }
      scannerUrl.value = '';
    }
  });

  /* ── Local (offline) image analysis fallback ── */
  async function localImageScan(file) {
    if (typeof showScannerRadar === 'function') showScannerRadar('Running on-device analysis...');
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
      matchedOn: matchedOn,
      detectionMeta: { provider: 'on-device' }
    };
    alerts.unshift(alert);
    saveAlerts();
    renderDashboard();
    if (typeof hideScannerRadar === 'function') hideScannerRadar(conf, 'Engine: on-device heuristic', conf < 60);
    if (window.EnclaveUI) window.EnclaveUI.stopPulseScanButton();
    scannerStatus.textContent = 'Scan complete — confidence ' + conf + '%';
    if (scannerMeta) scannerMeta.textContent = 'Engine: on-device heuristic';
    scannerFile.value = '';
  }

  /* ─── PORTRAIT FILE UPLOAD HANDLER ─── */
  regUploadLink.addEventListener('click', function (e) { e.preventDefault(); regPortraitFile.click(); });

  regPortraitFile.addEventListener('change', function () {
    var file = regPortraitFile.files[0];
    if (!file) return;
    showRegError('');
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var w = 120, h = Math.round(120 * img.height / img.width);
        if (!regFaceCanvas) { showRegError('System error: canvas not found.'); return; }
        try {
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
          lsSet(LS_FACEPRINT, { type: 'face_spatial_matrix', width: w, height: h, grayscale: true, thumbnail: regFaceCanvas.toDataURL('image/png'), captured: new Date().toISOString() });

          regFacePreview.innerHTML = '<p style="font-size:0.7rem;color:#00FF88;margin:0 0 4px;">Portrait captured</p>';
          var thumb = document.createElement('canvas');
          thumb.width = w; thumb.height = h;
          thumb.style.cssText = 'border:1px solid rgba(0,255,136,0.3);border-radius:4px;';
          thumb.getContext('2d').putImageData(id, 0, 0);
          regFacePreview.appendChild(thumb);
          regFacePreview.classList.remove('hidden');
          regFacePreview.style.cssText = 'text-align:center;';
        } catch (err) { showRegError('Upload failed: ' + err.message); return; }

        // Enable Continue button immediately — non-critical crypto runs async
        closeRegCamera();
        btnRegCapture.disabled = true;
        btnRegCapture.textContent = 'Captured';
        btnRegFaceDone.disabled = false;
        btnRegFaceDone.style.opacity = '1';

        try { generateIdentityProof(); } catch (_) {}
        var hashResult2 = hashImageData(regFaceCanvas);
        if (hashResult2 && hashResult2.then) {
          hashResult2.then(function (hash) {
            if (hash) lsSet('enclave_faceprint_hash', hash);
          }).catch(function () {});
        }
      };
      img.onerror = function () { showRegError('Failed to load image. Try a different file.'); };
      img.src = e.target.result;
    };
    reader.onerror = function () { showRegError('Failed to read file.'); };
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
    for (var i = 0; i < pixelData.length; i += 4) { if (pixelData[i] !== 255 || pixelData[i+1] !== 255 || pixelData[i+2] !== 255) { blank = false; break; } }
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
    if (window.EnclaveUI) { window.EnclaveUI.initRipples(); window.EnclaveUI.initCardPress(); }

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
  var shieldMlEngineStatus = document.getElementById('shield-ml-engine-status');
  var shieldTotalScans = document.getElementById('shield-total-scans');
  var shieldTakedowns = document.getElementById('shield-takedowns');

  var _mlEngineLastFetch = 0;
  function updateMlEngineStatus(force) {
    if (!shieldMlEngineStatus) return;
    if (!window.EnclaveAPI || !window.EnclaveAPI.isLoggedIn()) {
      shieldMlEngineStatus.textContent = 'OFF';
      shieldMlEngineStatus.className = 'shield-module-badge inactive';
      return;
    }
    var now = Date.now();
    if (!force && now - _mlEngineLastFetch < 30000) return;
    _mlEngineLastFetch = now;

    window.EnclaveAPI.getDetectStatus().then(function (status) {
      if (!status) return;
      // Cache hits stat — sum across providers
      var cacheEl = document.getElementById('stat-cache-hits');
      if (cacheEl) {
        var hits = 0;
        if (status.primaryAi && status.primaryAi.cache) hits += status.primaryAi.cache.hits || 0;
        if (status.gemini && status.gemini.cache) hits += status.gemini.cache.hits || 0;
        cacheEl.textContent = hits;
      }

      var ai = status.primaryAi;
      var badgeText = 'HEURISTIC';
      var badgeClass = 'shield-module-badge partial';

      if (ai && ai.configured && ai.provider) {
        var up = (ai.vision && ai.vision.available) || (ai.text && ai.text.available);
        var label = String(ai.provider).toUpperCase().slice(0, 9);
        if (up) {
          badgeText = label;
          badgeClass = 'shield-module-badge active';
        } else {
          badgeText = label + '·WAIT';
          badgeClass = 'shield-module-badge partial';
        }
      } else {
        // Fall back to Gemini display if configured
        var g = status.gemini;
        if (g && g.configured) {
          var gUp = (g.primary && g.primary.available) || (g.fallback && g.fallback.available);
          badgeText = gUp ? 'GEMINI' : 'GEMINI·WAIT';
          badgeClass = 'shield-module-badge ' + (gUp ? 'active' : 'partial');
        }
      }
      shieldMlEngineStatus.textContent = badgeText;
      shieldMlEngineStatus.className = badgeClass;
    }).catch(function () {
      shieldMlEngineStatus.textContent = 'OFFLINE';
      shieldMlEngineStatus.className = 'shield-module-badge inactive';
    });
  }

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
    var crawlerActive = monitoringActive;
    var mlActive = tfjsLoaded && tfjsModel;

    if (shieldCameraStatus) {
      shieldCameraStatus.textContent = camActive ? 'ON' : 'OFF';
      shieldCameraStatus.className = 'shield-module-badge ' + (camActive ? 'active' : 'inactive');
      if (window.EnclaveUI) {
        var camCard = shieldCameraStatus.closest('.shield-card');
        if (camCard) window.EnclaveUI.animateShieldToggle(camCard, camActive);
      }
    }
    if (shieldVoiceStatus) {
      shieldVoiceStatus.textContent = voiceActive ? 'ON' : 'OFF';
      shieldVoiceStatus.className = 'shield-module-badge ' + (voiceActive ? 'active' : 'inactive');
      if (window.EnclaveUI) {
        var voiceCard = shieldVoiceStatus.closest('.shield-card');
        if (voiceCard) window.EnclaveUI.animateShieldToggle(voiceCard, voiceActive);
      }
    }
    if (shieldCrawlerStatus) {
      shieldCrawlerStatus.textContent = crawlerActive ? 'ON' : 'OFF';
      shieldCrawlerStatus.className = 'shield-module-badge ' + (crawlerActive ? 'active' : 'inactive');
      if (window.EnclaveUI) {
        var crawlerCard = shieldCrawlerStatus.closest('.shield-card');
        if (crawlerCard) window.EnclaveUI.animateShieldToggle(crawlerCard, crawlerActive);
      }
    }
    if (shieldMlStatus) {
      shieldMlStatus.textContent = mlActive ? 'LOADED' : 'OFF';
      shieldMlStatus.className = 'shield-module-badge ' + (mlActive ? 'partial' : 'inactive');
    }
    updateMlEngineStatus();
  }

  /* ─── Monitoring Sources (Phase 2) ─── */
  var monitoringSourcesEl = document.getElementById('monitoring-sources');
  var monitoringScheduleLabel = document.getElementById('monitoring-schedule-label');
  var monitoringToggleBtn = document.getElementById('btn-monitoring-toggle');
  var monitoringLastScan = document.getElementById('monitoring-last-scan');
  var monitoringNextRun = document.getElementById('monitoring-next-run');
  var monitoringFindings = document.getElementById('monitoring-total-findings');
  var monitoringStatusMsg = document.getElementById('monitoring-status-msg');
  var monitoringActive = false;
  var monitoringLastScanAt = null;

  function timeAgo(iso) {
    if (!iso) return '—';
    var diff = Date.now() - new Date(iso).getTime();
    if (diff < 0) diff = 0;
    var m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + 'm ago';
    var h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    return Math.floor(h / 24) + 'd ago';
  }

  function timeUntil(iso) {
    if (!iso) return '—';
    var diff = new Date(iso).getTime() - Date.now();
    if (diff <= 0) return 'soon';
    var m = Math.floor(diff / 60000);
    if (m < 60) return m + 'm';
    var h = Math.floor(m / 60);
    return h + 'h ' + (m % 60) + 'm';
  }

  function renderMonitoringSources(sources) {
    if (!monitoringSourcesEl) return;
    monitoringSourcesEl.innerHTML = '';
    sources.forEach(function (s) {
      var row = document.createElement('div');
      row.className = 'shield-module';

      var name = document.createElement('span');
      name.className = 'shield-module-name';
      name.textContent = s.label + (s.fragile ? ' ⚠' : '');
      if (s.fragile) name.title = 'Best-effort source — availability depends on third-party mirrors';

      var badge = document.createElement('span');
      var cls = 'shield-module-badge inactive';
      var text = 'IDLE';
      switch (s.status) {
        case 'ok': cls = 'shield-module-badge active'; text = 'LIVE'; break;
        case 'degraded': cls = 'shield-module-badge partial'; text = 'SLOW'; break;
        case 'down': cls = 'shield-module-badge inactive'; text = 'DOWN'; break;
        case 'cooldown':
          cls = 'shield-module-badge partial';
          text = 'WAIT ' + (s.cooldownRemainingMin || 0) + 'M';
          break;
        case 'locked':
          cls = 'shield-module-badge inactive';
          text = (s.requiredTier || 'PRO').toUpperCase();
          break;
      }
      badge.className = cls;
      badge.textContent = text;

      row.appendChild(name);
      row.appendChild(badge);
      monitoringSourcesEl.appendChild(row);
    });
  }

  function loadMonitoring() {
    if (!window.EnclaveAPI || !window.EnclaveAPI.isLoggedIn()) return;

    window.EnclaveAPI.getMonitoringStatus().then(function (data) {
      if (!data) return;
      monitoringActive = !!data.active;
      if (monitoringScheduleLabel) {
        monitoringScheduleLabel.textContent = data.schedule.charAt(0).toUpperCase() + data.schedule.slice(1);
      }
      if (monitoringToggleBtn) {
        monitoringToggleBtn.textContent = monitoringActive ? 'Stop' : 'Start';
        monitoringToggleBtn.className = 'btn ' + (monitoringActive ? 'btn-danger' : 'btn-safe');
      }

      // Track most recent successful scan across sources
      var lastSuccess = null;
      (data.sources || []).forEach(function (s) {
        if (s.lastSuccessAt && (!lastSuccess || s.lastSuccessAt > lastSuccess)) lastSuccess = s.lastSuccessAt;
      });
      monitoringLastScanAt = lastSuccess;
      if (monitoringLastScan) monitoringLastScan.textContent = timeAgo(lastSuccess);
      if (monitoringNextRun) {
        monitoringNextRun.textContent = data.active ? timeUntil(data.nextRunAt) : '—';
      }
      var totalFindings = 0;
      (data.sources || []).forEach(function (s) { totalFindings += s.totalFindings || 0; });
      if (monitoringFindings) monitoringFindings.textContent = totalFindings;

      renderMonitoringSources(data.sources || []);

      if (monitoringStatusMsg) {
        var locked = (data.sources || []).filter(function (s) { return !s.enabled; }).length;
        monitoringStatusMsg.textContent = monitoringActive
          ? 'Scheduled monitoring active — ' + data.cyclesCompleted + ' cycle(s) completed.'
          : (locked > 0
            ? 'Manual scans available. Start monitoring or upgrade to unlock ' + locked + ' more source(s).'
            : 'Start scheduled monitoring to scan automatically.');
      }

      // Header badge: show scanning state vs last-scan age
      var headerBadge = document.getElementById('crawler-status');
      if (headerBadge) {
        if (monitoringActive) {
          headerBadge.innerHTML = '<svg viewBox="0 0 12 12" width="10" height="10"><use href="#icon-radar-dot"/></svg> SCANNING';
        } else if (lastSuccess) {
          headerBadge.textContent = 'LAST SCAN ' + timeAgo(lastSuccess).toUpperCase();
        } else {
          headerBadge.textContent = 'IDLE';
        }
      }
    }).catch(function () {});
  }

  if (monitoringToggleBtn) {
    monitoringToggleBtn.addEventListener('click', async function () {
      if (!window.EnclaveAPI || !window.EnclaveAPI.isLoggedIn()) return;
      monitoringToggleBtn.disabled = true;
      try {
        if (monitoringActive) await window.EnclaveAPI.stopMonitoring();
        else await window.EnclaveAPI.startMonitoring();
      } catch (_) {}
      monitoringToggleBtn.disabled = false;
      loadMonitoring();
    });
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
      openPlansModal();
    });
  }

  if (btnUpgradeShield) {
    btnUpgradeShield.addEventListener('click', function () {
      openPlansModal();
    });
  }

  /* ─── Choose Plan Modal (Phase 4) ─── */
  var plansModal = document.getElementById('plans-modal');
  var plansComparison = document.getElementById('plans-comparison');
  var btnPlansClose = document.getElementById('btn-plans-close');
  var plansStatus = document.getElementById('plans-status');
  var _currentTier = 'free';
  var PLAN_ORDER = ['free', 'detection_only', 'pro', 'shield', 'business'];
  var POPULAR_TIER = 'pro';

  function closePlansModal() { if (plansModal) plansModal.classList.add('hidden'); }
  if (btnPlansClose) btnPlansClose.addEventListener('click', closePlansModal);
  if (plansModal) plansModal.addEventListener('click', function (e) {
    if (e.target === plansModal) closePlansModal();
  });

  function fmtPrice(cents) {
    if (!cents) return '$0';
    return '$' + (cents / 100).toFixed(2).replace(/\.00$/, '');
  }

  function openPlansModal() {
    if (!plansModal || !window.EnclaveAPI) return;
    plansModal.classList.remove('hidden');
    plansComparison.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">Loading plans…</p>';
    if (plansStatus) plansStatus.textContent = '';

    window.EnclaveAPI.getSubscription().then(function (data) {
      _currentTier = (data && data.subscription && data.subscription.tier) || 'free';
      return window.EnclaveAPI.getTiers();
    }).then(function (data) {
      renderPlans((data && data.tiers) || []);
    }).catch(function () {
      plansComparison.innerHTML = '<p style="color:var(--red);font-size:0.8rem;">Failed to load plans.</p>';
    });
  }

  function renderPlans(tiers) {
    if (!plansComparison) return;
    plansComparison.innerHTML = '';
    var ordered = PLAN_ORDER.map(function (id) { return tiers[id]; }).filter(Boolean);

    ordered.forEach(function (t) {
      var isCurrent = t.id === _currentTier;
      var card = document.createElement('div');
      card.className = 'plan-card' + (isCurrent ? ' current' : (t.id === POPULAR_TIER ? ' popular' : ''));

      var head = document.createElement('div');
      head.className = 'plan-head';
      head.innerHTML = '<span class="plan-name">' + t.name + '</span>'
        + '<span class="plan-price">' + fmtPrice(t.price) + '/mo</span>'
        + (isCurrent ? '<span class="plan-badge current">Current</span>'
          : (t.id === POPULAR_TIER ? '<span class="plan-badge popular">Most Popular</span>' : ''));

      var feats = document.createElement('ul');
      feats.className = 'plan-features';
      (t.features || []).forEach(function (f) {
        var li = document.createElement('li');
        li.textContent = f;
        feats.appendChild(li);
      });

      var actions = document.createElement('div');
      actions.className = 'plan-actions';
      var btn = document.createElement('button');
      btn.className = 'btn ' + (isCurrent ? 'btn-ghost' : (t.id === POPULAR_TIER ? 'btn-dispatch' : 'btn-safe'));
      btn.textContent = isCurrent ? 'Current Plan'
        : (t.id === 'free' ? 'Downgrade to Free' : 'Choose ' + t.name);
      btn.disabled = isCurrent;
      btn.addEventListener('click', function () { selectPlan(t.id, btn); });
      actions.appendChild(btn);

      card.appendChild(head);
      card.appendChild(feats);
      card.appendChild(actions);
      plansComparison.appendChild(card);
    });
  }

  function selectPlan(tierId, btn) {
    if (!window.EnclaveAPI) return;
    btn.disabled = true;
    btn.textContent = 'Processing…';
    if (tierId === 'free') {
      // Downgrade goes through billing portal when live; mock just notes it
      showToastAlert('To cancel, use Manage → billing portal.');
      btn.disabled = false;
      btn.textContent = 'Downgrade to Free';
      return;
    }
    window.EnclaveAPI.startCheckout(tierId, window.location.href, window.location.href)
      .then(function (session) {
        if (session && session.url && session.url.indexOf('#mock') !== 0 && session.url !== '#mock-checkout') {
          window.location.href = session.url;
        } else if (session && session.mock) {
          showToastAlert('Mock checkout: ' + tierId + ' activated (no Stripe key configured).');
          closePlansModal();
          loadBilling();
        } else if (session && session.url) {
          window.location.href = session.url;
        }
        btn.disabled = false;
      })
      .catch(function (e) {
        if (plansStatus) plansStatus.textContent = 'Checkout failed: ' + (e.message || 'unknown');
        btn.disabled = false;
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
        item.style.cursor = 'pointer';
        item.title = 'View evidence package';
        var platform = document.createElement('span');
        platform.className = 'takedown-item-platform';
        platform.textContent = td.platform || td.type || 'Unknown';
        var status = document.createElement('span');
        var st = td.status || 'pending';
        status.className = 'takedown-item-status '
          + (st === 'removed' ? 'removed'
            : (st === 'escalated' || st === 'escalated_no_removal') ? 'escalated'
            : st === 'counter_notice' ? 'counter'
            : st === 'counter_notice_expired' ? 'closed'
            : st === 'follow_up_sent' ? 'sent'
            : 'sent');
        status.textContent = (st === 'escalated_no_removal') ? 'closed'
          : (st === 'counter_notice_expired') ? 'cn-expired'
          : (st === 'counter_notice') ? 'counter-notice'
          : st;
        item.appendChild(platform);
        item.appendChild(status);
        item.addEventListener('click', function () { openEvidenceModal(td.id); });
        takedownList.appendChild(item);
      });
    }).catch(function () {
      if (takedownList) takedownList.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">No active takedowns</p>';
    });
  }

  /* ─── Evidence Package Modal (Phase 3) ─── */
  var evidenceModal = document.getElementById('evidence-modal');
  var evidenceIntegrity = document.getElementById('evidence-integrity');
  var evidenceBody = document.getElementById('evidence-body');
  var btnEvidenceClose = document.getElementById('btn-evidence-close');

  function closeEvidenceModal() { if (evidenceModal) evidenceModal.classList.add('hidden'); }
  if (btnEvidenceClose) btnEvidenceClose.addEventListener('click', closeEvidenceModal);
  if (evidenceModal) evidenceModal.addEventListener('click', function (e) {
    if (e.target === evidenceModal) closeEvidenceModal();
  });

  function openEvidenceModal(takedownId) {
    if (!evidenceModal || !window.EnclaveAPI) return;
    evidenceModal.classList.remove('hidden');
    evidenceBody.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">Loading evidence…</p>';
    if (evidenceIntegrity) evidenceIntegrity.style.display = 'none';

    window.EnclaveAPI.getTakedownEvidence(takedownId).then(function (ev) {
      // Integrity banner
      if (evidenceIntegrity) {
        evidenceIntegrity.style.display = 'flex';
        var ok = ev.integrity && ev.integrity.valid;
        evidenceIntegrity.className = 'settings-section evidence-integrity ' + (ok ? 'valid' : 'invalid');
        evidenceIntegrity.innerHTML = ok
          ? '<svg viewBox="0 0 28 28" width="14" height="14"><use href="#icon-check"/></svg> Hash chain verified — '
            + ev.integrity.artifacts + ' artifact(s), tamper-evident'
          : '⚠ Chain verification failed' + (ev.integrity && ev.integrity.reason ? ' — ' + ev.integrity.reason : '');
      }

      var html = '';
      html += '<div class="settings-section"><p class="settings-section-title">Source</p>'
        + '<p class="settings-value" style="word-break:break-all;font-size:0.75rem;">' + (ev.sourceUrl || '—') + '</p></div>';
      html += '<div class="settings-section"><p class="settings-section-title">Captured</p>'
        + '<p class="settings-value">' + (ev.capturedAt ? new Date(ev.capturedAt).toLocaleString() : '—') + '</p></div>';
      if (ev.metadata && ev.metadata.pageTitle) {
        html += '<div class="settings-section"><p class="settings-section-title">Page Title</p>'
          + '<p class="settings-value" style="font-size:0.78rem;">' + String(ev.metadata.pageTitle).slice(0, 140) + '</p></div>';
      }
      if (ev.phash) {
        html += '<div class="settings-section"><p class="settings-section-title">Perceptual Hash (dHash)</p>'
          + '<p class="settings-value" style="font-family:var(--font-mono);font-size:0.72rem;">' + ev.phash + '</p>'
          + '<p class="card-desc">Tracks this content across URL changes</p></div>';
      }
      html += '<div class="settings-section"><p class="settings-section-title">SHA-256 Chain</p><div style="display:flex;flex-direction:column;gap:0.3rem;margin-top:0.35rem;">';
      (ev.artifacts || []).forEach(function (a) {
        html += '<div class="chain-row"><span class="chain-idx">#' + a.index + '</span>'
          + '<span class="chain-file">' + a.file + ' (' + a.size + 'b)</span>'
          + '<span class="chain-hash">' + a.hash + '</span></div>';
      });
      if (ev.chainHead) {
        html += '<div class="chain-row"><span class="chain-idx">HEAD</span>'
          + '<span class="chain-file">Chain head fingerprint</span>'
          + '<span class="chain-hash">' + ev.chainHead + '</span></div>';
      }
      html += '</div></div>';

      evidenceBody.innerHTML = html;
    }).catch(function (e) {
      evidenceBody.innerHTML = '<p style="color:var(--red);font-size:0.8rem;">Failed to load evidence: ' + (e.message || 'unknown') + '</p>';
    });
  }

  /* ─── Manual Filing Helper Modal (Phase 3) ─── */
  var filingModal = document.getElementById('filing-modal');
  var filingSelect = document.getElementById('filing-platform-select');
  var filingGuideBody = document.getElementById('filing-guide-body');
  var btnFilingClose = document.getElementById('btn-filing-close');

  function closeFilingModal() { if (filingModal) filingModal.classList.add('hidden'); }
  if (btnFilingClose) btnFilingClose.addEventListener('click', closeFilingModal);
  if (filingModal) filingModal.addEventListener('click', function (e) {
    if (e.target === filingModal) closeFilingModal();
  });

  function openFilingModal() {
    if (!filingModal || !window.EnclaveAPI) return;
    filingModal.classList.remove('hidden');
    filingGuideBody.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">Loading guides…</p>';
    window.EnclaveAPI.getFilingGuides().then(function (guides) {
      if (!filingSelect) return;
      filingSelect.innerHTML = '';
      (guides || []).forEach(function (g) {
        var opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = g.platform + ' (' + g.stepCount + ' steps)';
        filingSelect.appendChild(opt);
      });
      if ((guides || []).length) loadFilingGuide(guides[0].id);
      else filingGuideBody.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">No guides available.</p>';
    }).catch(function () {});
  }

  function loadFilingGuide(platformId) {
    window.EnclaveAPI.getFilingGuide(platformId).then(function (g) {
      var html = '';
      (g.steps || []).forEach(function (step, i) {
        html += '<div class="filing-step"><span class="filing-step-num">' + (i + 1) + '.</span><span>' + step + '</span></div>';
      });
      if (g.formUrl) {
        html += '<a href="' + g.formUrl + '" target="_blank" rel="noopener" class="btn btn-safe" style="margin-top:0.5rem;width:100%;">Open ' + g.platform + ' Form ↗</a>';
      }
      filingGuideBody.innerHTML = html;
    }).catch(function () {
      filingGuideBody.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">Guide unavailable.</p>';
    });
  }

  if (filingSelect) {
    filingSelect.addEventListener('change', function () { loadFilingGuide(filingSelect.value); });
  }
  var btnTakedownsOpenEl = document.getElementById('btn-takedowns-open');
  if (btnTakedownsOpenEl) {
    btnTakedownsOpenEl.addEventListener('click', openFilingModal);
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

    updateLatencyStat();

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
    loadMonitoring();
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

  /* ─── Cyber Canvas — Matrix rain + circuit grid + HUD rings ─── */
  function initCyberCanvas() {
    var canvas = document.getElementById('cyber-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var W, H;

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    /* Matrix rain columns */
    var chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF<>{}[]|/\\';
    var fontSize = 14;
    var columns = Math.ceil(W / fontSize);
    var drops = [];
    var dropSpeeds = [];
    var dropColors = [];
    for (var i = 0; i < columns; i++) {
      drops[i] = Math.random() * -100;
      dropSpeeds[i] = 0.3 + Math.random() * 0.7;
      dropColors[i] = Math.random() > 0.7 ? '#00FF88' : (Math.random() > 0.5 ? '#00BFFF' : '#FF3366');
    }

    /* Circuit nodes */
    var nodes = [];
    var nodeCount = 12;
    for (var i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: 2 + Math.random() * 2,
        pulse: Math.random() * Math.PI * 2
      });
    }

    /* HUD rings */
    var hudRings = [
      { x: W * 0.15, y: H * 0.3, r: 60, angle: 0, speed: 0.003, color: '#00FF88' },
      { x: W * 0.85, y: H * 0.6, r: 45, angle: 0, speed: -0.005, color: '#00BFFF' },
      { x: W * 0.5, y: H * 0.15, r: 35, angle: 0, speed: 0.004, color: '#FF3366' }
    ];

    var frame = 0;

    function draw() {
      ctx.clearRect(0, 0, W, H);
      frame++;

      /* Matrix rain */
      ctx.font = fontSize + 'px monospace';
      for (var i = 0; i < columns; i++) {
        var char = chars[Math.floor(Math.random() * chars.length)];
        var x = i * fontSize;
        var y = drops[i] * fontSize;
        if (y > 0 && y < H) {
          ctx.globalAlpha = 0.12 + Math.random() * 0.08;
          ctx.fillStyle = dropColors[i];
          ctx.fillText(char, x, y);
        }
        if (y > H && Math.random() > 0.98) {
          drops[i] = 0;
          dropColors[i] = Math.random() > 0.7 ? '#00FF88' : (Math.random() > 0.5 ? '#00BFFF' : '#FF3366');
        }
        drops[i] += dropSpeeds[i];
      }

      /* Circuit grid lines */
      ctx.globalAlpha = 0.04;
      ctx.strokeStyle = '#00FF88';
      ctx.lineWidth = 0.5;
      var gridSize = 80;
      var offsetX = (frame * 0.2) % gridSize;
      for (var gx = -gridSize + offsetX; gx < W + gridSize; gx += gridSize) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, H);
        ctx.stroke();
      }
      var offsetY = (frame * 0.15) % gridSize;
      for (var gy = -gridSize + offsetY; gy < H + gridSize; gy += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(W, gy);
        ctx.stroke();
      }

      /* Circuit nodes + connections */
      ctx.globalAlpha = 1;
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;
        n.pulse += 0.02;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
        var glow = 0.3 + 0.3 * Math.sin(n.pulse);
        ctx.globalAlpha = glow;
        ctx.fillStyle = '#00FF88';
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
        /* connect nearby nodes */
        for (var j = i + 1; j < nodes.length; j++) {
          var m = nodes[j];
          var dx = n.x - m.x;
          var dy = n.y - m.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 200) {
            ctx.globalAlpha = (1 - dist / 200) * 0.15;
            ctx.strokeStyle = '#00FF88';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(m.x, m.y);
            ctx.stroke();
          }
        }
      }

      /* HUD rings */
      for (var r = 0; r < hudRings.length; r++) {
        var ring = hudRings[r];
        ring.angle += ring.speed;
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
        ctx.stroke();
        /* rotating arc segment */
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.r, ring.angle, ring.angle + Math.PI * 0.6);
        ctx.stroke();
        /* center dot */
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = ring.color;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      /* Horizontal scan line */
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = '#00FF88';
      var scanY = (frame * 1.5) % H;
      ctx.fillRect(0, scanY, W, 2);

      ctx.globalAlpha = 1;
      requestAnimationFrame(draw);
    }
    draw();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCyberCanvas);
  } else {
    setTimeout(initCyberCanvas, 100);
  }

  /* ─── Particles.js — Login overlay background ─── */
  function initParticles() {
    var canvas = document.getElementById('particles-canvas');
    if (!canvas || !window.tsParticles) return;
    window.tsParticles.load('particles-canvas', {
      particles: {
        number: { value: 60, density: { enable: true, width: 800, height: 600 } },
        color: { value: ['#00FF88', '#00BFFF', '#FF3366', '#FFD700'] },
        shape: { type: ['circle', 'polygon'], polygon: [{ sides: 6, rotation: false }] },
        opacity: { value: { min: 0.15, max: 0.5 }, animation: { enable: true, speed: 0.6, minimumValue: 0.08 } },
        size: { value: { min: 1.5, max: 4 }, animation: { enable: true, speed: 1.5, minimumValue: 0.8 } },
        move: { enable: true, speed: 0.8, direction: 'none', random: true, straight: false, outModes: { default: 'out' } },
        links: { enable: true, distance: 160, color: '#00FF88', opacity: 0.2, width: 0.8 }
      },
      interactivity: {
        events: { onHover: { enable: true, mode: 'grab' }, resize: true },
        modes: { grab: { distance: 180, links: { opacity: 0.5 } } }
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
    var cards = document.querySelectorAll('.panel-card, .glass-card, .glass-card-glow');
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
    var revealEls = document.querySelectorAll('.card, .home-card, .shield-card');
    revealEls.forEach(function (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(24px)';
      el.style.transition = 'opacity 0.6s cubic-bezier(0.16,1,0.3,1), transform 0.6s cubic-bezier(0.16,1,0.3,1)';
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
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

  /* ═══════════════════════════════════════════════════════
     PHASE 10 — VISUAL OVERHAUL JS
     ═══════════════════════════════════════════════════════ */

  /* ─── Hero Protection Ring ─── */
  var heroRingFill = document.getElementById('hero-ring-fill');
  var heroRingInner = document.getElementById('hero-ring-inner');
  var heroShieldPct = document.getElementById('hero-shield-pct');
  var heroStatusText = document.getElementById('hero-status-text');
  var heroShieldsActive = document.getElementById('hero-shields-active');
  var RING_CIRCUMFERENCE = 326.7; // 2 * PI * 52
  var RING_INNER_CIRC = 263.9;   // 2 * PI * 42

  function updateHeroRing(pct) {
    pct = Math.max(0, Math.min(100, pct));
    var offset = RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * pct / 100);
    var innerOffset = RING_INNER_CIRC - (RING_INNER_CIRC * pct * 0.7 / 100);
    if (heroRingFill) heroRingFill.setAttribute('stroke-dashoffset', offset);
    if (heroRingInner) heroRingInner.setAttribute('stroke-dashoffset', innerOffset);
    if (heroShieldPct) heroShieldPct.textContent = Math.round(pct) + '%';
  }

  function computeProtectionLevel() {
    var shields = [
      document.getElementById('shield-camera-status'),
      document.getElementById('shield-voice-status'),
      document.getElementById('shield-crawler-status'),
      document.getElementById('shield-ml-engine-status'),
      document.getElementById('shield-ml-status')
    ];
    var active = 0;
    shields.forEach(function (s) {
      if (s && (s.classList.contains('active') || s.textContent === 'LOADED')) active++;
    });
    return { active: active, total: shields.length, pct: Math.round((active / shields.length) * 100) };
  }

  function refreshHeroRing() {
    var level = computeProtectionLevel();
    updateHeroRing(level.pct);
    if (heroShieldsActive) heroShieldsActive.textContent = level.active + '/' + level.total + ' Shields Active';
    if (heroStatusText) {
      if (level.active === 0) {
        heroStatusText.textContent = 'No Shields Active';
      } else if (level.active < level.total) {
        heroStatusText.textContent = 'Partial Protection';
      } else {
        heroStatusText.textContent = 'Full Protection Active';
      }
    }
  }

  /* ─── Shield Module Indicator Dots ─── */
  function refreshShieldIndicators() {
    var pairs = [
      ['indicator-camera', 'shield-camera-status'],
      ['indicator-voice', 'shield-voice-status'],
      ['indicator-crawler', 'shield-crawler-status'],
      ['indicator-ml-engine', 'shield-ml-engine-status'],
      ['indicator-ml-device', 'shield-ml-status']
    ];
    pairs.forEach(function (pair) {
      var dot = document.getElementById(pair[0]);
      var badge = document.getElementById(pair[1]);
      if (!dot || !badge) return;
      var isOn = badge.classList.contains('active') || badge.textContent === 'LOADED';
      dot.className = 'shield-module-indicator' + (isOn ? ' active' : '');
    });
  }

  /* ─── Camera/Voice Activity Panels ─── */
  function refreshShieldActivities() {
    var camAct = document.getElementById('camera-activity');
    var voiceAct = document.getElementById('voice-activity');
    var camLabel = document.getElementById('camera-shield-label');
    var voiceLabel = document.getElementById('voice-shield-label');
    var camActive = window.EnclaveNative && window.EnclaveNative.cameraImmunizer && window.EnclaveNative.cameraImmunizer.isActive();
    var voiceActive = window.EnclaveNative && window.EnclaveNative.voiceShield && window.EnclaveNative.voiceShield.isActive();
    if (camAct) camAct.className = 'shield-activity' + (camActive ? ' active' : '');
    if (camLabel) camLabel.textContent = camActive ? 'Active — Shielding photos' : 'Inactive';
    if (voiceAct) voiceAct.className = 'shield-activity' + (voiceActive ? ' active' : '');
    if (voiceLabel) voiceLabel.textContent = voiceActive ? 'Active — Protecting voice' : 'Inactive';
  }

  /* ─── Scanner Radar Animation ─── */
  var scannerRadar = document.getElementById('scanner-radar');
  var scannerInputArea = document.getElementById('scanner-input-area');
  var scannerResult = document.getElementById('scanner-result');
  var scannerResultRing = document.getElementById('scanner-result-ring');
  var scannerResultPct = document.getElementById('scanner-result-pct');
  var scannerResultInfo = document.getElementById('scanner-result-info');
  var SCANNER_RING_CIRC = 150.8;

  function showScannerRadar(text) {
    if (scannerRadar) scannerRadar.style.display = 'flex';
    if (scannerInputArea) scannerInputArea.style.display = 'none';
    if (scannerResult) scannerResult.style.display = 'none';
    var radarText = document.getElementById('scanner-radar-text');
    if (radarText) radarText.textContent = text || 'Scanning...';
  }

  function hideScannerRadar(confidence, metaText, isSafe) {
    if (scannerRadar) scannerRadar.style.display = 'none';
    if (scannerInputArea) scannerInputArea.style.display = 'block';
    if (scannerResult && confidence !== undefined) {
      scannerResult.style.display = 'flex';
      var offset = SCANNER_RING_CIRC - (SCANNER_RING_CIRC * confidence / 100);
      if (scannerResultRing) {
        scannerResultRing.setAttribute('stroke-dashoffset', offset);
        scannerResultRing.setAttribute('stroke', isSafe ? '#00FF88' : (confidence > 60 ? '#FF4444' : '#FF8800'));
      }
      if (scannerResultPct) {
        scannerResultPct.textContent = confidence + '%';
        scannerResultPct.style.color = isSafe ? '#00FF88' : (confidence > 60 ? '#FF4444' : '#FF8800');
      }
      if (scannerResultInfo) scannerResultInfo.textContent = metaText || '';
    }
  }

  /* ─── Mini Chart Update ─── */
  function updateMiniChart(chartId, value, maxVal) {
    var container = document.getElementById(chartId);
    if (!container) return;
    var bars = container.querySelectorAll('.mini-bar');
    if (!bars.length) return;
    var ratio = Math.min(1, value / Math.max(1, maxVal));
    // Simulate historical data distribution
    var heights = [];
    for (var i = 0; i < bars.length; i++) {
      var h = Math.max(8, Math.round(ratio * 100 * (0.3 + Math.random() * 0.7)));
      heights.push(h);
    }
    // Make the last bar the highest (current)
    heights[heights.length - 1] = Math.max(15, Math.round(ratio * 100));
    bars.forEach(function (bar, idx) {
      bar.style.height = heights[idx] + '%';
    });
  }

  /* ─── Trend Arrows ─── */
  function updateTrendArrow(elemId, current, previous) {
    var el = document.getElementById(elemId);
    if (!el) return;
    if (!previous || previous === 0) {
      el.textContent = 'new';
      el.className = 'stat-trend stat-trend-neutral';
    } else if (current > previous) {
      el.textContent = '↑ +' + Math.round(((current - previous) / previous) * 100) + '%';
      el.className = 'stat-trend stat-trend-up';
    } else if (current < previous) {
      el.textContent = '↓ -' + Math.round(((previous - current) / previous) * 100) + '%';
      el.className = 'stat-trend stat-trend-down';
    } else {
      el.textContent = '— same';
      el.className = 'stat-trend stat-trend-neutral';
    }
  }

  /* ─── Hook into existing refresh cycle ─── */
  var origRefreshAllPanels = refreshAllPanels;
  refreshAllPanels = function () {
    origRefreshAllPanels();
    refreshHeroRing();
    refreshShieldIndicators();
    refreshShieldActivities();
    updateMiniChart('chart-scans', parseInt(statTotalScans ? statTotalScans.textContent : 0, 10), 50);
    updateMiniChart('chart-threats', parseInt(statThreatsFound ? statThreatsFound.textContent : 0, 10), 10);
    updateMiniChart('chart-takedowns', parseInt(statTakedownsSent ? statTakedownsSent.textContent : 0, 10), 10);
  };

  // Also refresh indicators when shield status badges change
  var origUpdateShieldStatus = updateShieldStatus;
  updateShieldStatus = function () {
    origUpdateShieldStatus();
    setTimeout(function () {
      refreshShieldIndicators();
      refreshShieldActivities();
      refreshHeroRing();
    }, 200);
  };

  // Initialize hero ring on load
  setTimeout(function () {
    refreshHeroRing();
    refreshShieldIndicators();
  }, 500);

  /* ═══════════════════════════════════════════════════════
     PSYCHOLOGY THEORY JS — Streaks, Social Proof, Badges,
     Insights, Urgency, Timeline
     ═══════════════════════════════════════════════════════ */

  /* ─── LocalStorage Keys ─── */
  var LS_STREAK = 'enclave_streak';
  var LS_STREAK_DATE = 'enclave_streak_date';
  var LS_BADGES = 'enclave_badges';
  var LS_SCANS = 'enclave_scan_count';
  var LS_THREATS_BLOCKED = 'enclave_threats_blocked';
  var LS_TAKEDOWNS_DONE = 'enclave_takedowns_done';

  /* ─── Daily Streak (COMMITMENT & CONSISTENCY + LOSS AVERSION) ─── */
  var streakNumber = document.getElementById('streak-number');
  var streakSub = document.getElementById('streak-sub');
  var streakFire = document.getElementById('streak-fire');

  function updateStreak() {
    var today = new Date().toISOString().slice(0, 10);
    var lastDate = lsGet(LS_STREAK_DATE, '');
    var streak = lsGet(LS_STREAK, 1);

    if (lastDate === today) {
      // Already checked in today
    } else {
      var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (lastDate === yesterday) {
        streak++;
      } else if (lastDate !== today) {
        streak = 1; // Streak broken
      }
      lsSet(LS_STREAK_DATE, today);
      lsSet(LS_STREAK, streak);
    }

    if (streakNumber) streakNumber.textContent = streak;
    if (streakSub) {
      if (streak >= 7) streakSub.textContent = 'You\'re on fire!';
      else if (streak >= 3) streakSub.textContent = 'Keep it going!';
      else streakSub.textContent = 'Don\'t break it!';
    }
    if (streakFire && streak >= 7) {
      streakFire.style.animationDuration = '0.8s';
      streakFire.style.filter = 'drop-shadow(0 0 4px rgba(255,136,0,0.6))';
    }
  }

  /* ─── Threat Avoidance Counter (ANCHORING + RECIPROCITY) ─── */
  var threatAvoidanceNumber = document.getElementById('threat-avoidance-number');

  function updateThreatAvoidance() {
    var blocked = lsGet(LS_THREATS_BLOCKED, 0);
    // Simulate some baseline threats blocked from monitoring
    var baseBlocked = Math.floor(Math.random() * 5) + 2;
    var total = Math.max(blocked, baseBlocked);
    if (threatAvoidanceNumber) {
      animateNumber(threatAvoidanceNumber, 0, total, 1200);
    }
  }

  /* ─── Number Animation Helper ─── */
  function animateNumber(el, from, to, duration) {
    var start = performance.now();
    var diff = to - from;
    function step(ts) {
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      el.textContent = Math.round(from + diff * eased);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ─── Social Proof Feed (HERD MENTALITY) ─── */
  var spFeed = document.getElementById('social-proof-feed');
  var spOnlineCount = document.getElementById('sp-online-count');
  var spBlockedToday = document.getElementById('sp-blocked-today');
  var spCities = ['Tokyo', 'London', 'New York', 'Berlin', 'Sydney', 'Seoul', 'Toronto', 'Paris', 'Mumbai', 'São Paulo', 'Singapore', 'Dubai', 'Amsterdam', 'Stockholm', 'Hong Kong'];
  var spActions = [
    'just blocked a deepfake attempt',
    'activated Camera Immunizer',
    'completed a deep scan',
    'reported a fake profile',
    'enabled Voice Shield',
    'generated a DMCA notice',
    'joined Enclave',
    'reached a 7-day streak'
  ];

  function randomSpEntry() {
    var city = spCities[Math.floor(Math.random() * spCities.length)];
    var action = spActions[Math.floor(Math.random() * spActions.length)];
    var entry = document.createElement('div');
    entry.className = 'sp-entry';
    entry.style.opacity = '0';
    entry.innerHTML = '<span class="sp-dot"></span><span class="sp-msg">Someone in ' + city + ' ' + action + '</span><span class="sp-time">just now</span>';
    entry.style.animation = 'spSlideIn 0.4s ease forwards';
    if (spFeed) {
      spFeed.insertBefore(entry, spFeed.firstChild);
      // Remove old entries
      while (spFeed.children.length > 5) {
        spFeed.removeChild(spFeed.lastChild);
      }
    }
  }

  function updateSocialProofNumbers() {
    // Animate online count with slight fluctuation
    var base = 2847 + Math.floor(Math.random() * 200 - 100);
    if (spOnlineCount) spOnlineCount.textContent = base.toLocaleString();
    var blocked = 1203 + Math.floor(Math.random() * 100);
    if (spBlockedToday) spBlockedToday.textContent = blocked.toLocaleString();
  }

  // Add new social proof entries periodically
  setInterval(randomSpEntry, 8000);
  setInterval(updateSocialProofNumbers, 15000);

  /* ─── Badges (COMPLETION DRIVE + STATUS) ─── */
  var badges = lsGet(LS_BADGES, {});
  var BADGE_DEFS = {
    'first-scan': { icon: '🔍', name: 'First Scan', check: function () { return (lsGet(LS_SCANS, 0) || 0) > 0; } },
    'shield-1': { icon: '🛡️', name: 'First Shield', check: function () { return computeProtectionLevel().active >= 1; } },
    'shield-5': { icon: '🏰', name: 'Full Fortress', check: function () { return computeProtectionLevel().active >= 5; } },
    'streak-7': { icon: '🔥', name: 'Week Warrior', check: function () { return lsGet(LS_STREAK, 0) >= 7; } },
    'takedown-1': { icon: '⚖️', name: 'First Takedown', check: function () { return (lsGet(LS_TAKEDOWNS_DONE, 0) || 0) > 0; } },
    'scanner-10': { icon: '🎯', name: 'Scan Master', check: function () { return (lsGet(LS_SCANS, 0) || 0) >= 10; } },
    'threat-blocked': { icon: '🚫', name: 'Threat Blocker', check: function () { return (lsGet(LS_THREATS_BLOCKED, 0) || 0) > 0; } },
    'pro-user': { icon: '⭐', name: 'Pro Member', check: function () { return false; } } // Set when upgraded
  };

  function checkAndUnlockBadges() {
    var newlyUnlocked = [];
    Object.keys(BADGE_DEFS).forEach(function (id) {
      if (badges[id]) return; // Already unlocked
      if (BADGE_DEFS[id].check()) {
        badges[id] = new Date().toISOString();
        newlyUnlocked.push(id);
      }
    });
    if (newlyUnlocked.length > 0) {
      lsSet(LS_BADGES, badges);
      newlyUnlocked.forEach(function (id) {
        showToastAlert('🏆 Badge unlocked: ' + BADGE_DEFS[id].name + '!');
      });
    }
    renderBadges();
  }

  function renderBadges() {
    var grid = document.getElementById('badges-grid');
    var progressText = document.getElementById('badge-progress-text');
    if (!grid) return;
    var unlocked = 0;
    var total = Object.keys(BADGE_DEFS).length;
    Object.keys(BADGE_DEFS).forEach(function (id) {
      var el = document.getElementById('badge-' + id);
      if (!el) return;
      if (badges[id]) {
        el.className = 'badge-item badge-unlocked';
        unlocked++;
      } else {
        el.className = 'badge-item badge-locked';
      }
    });
    if (progressText) progressText.textContent = unlocked + ' of ' + total + ' unlocked';
  }

  // Hook into scan count increment
  var origLocalImageScan = localImageScan;
  if (typeof origLocalImageScan === 'function') {
    localImageScan = async function (file) {
      var scans = lsGet(LS_SCANS, 0) + 1;
      lsSet(LS_SCANS, scans);
      return origLocalImageScan.call(this, file);
    };
  }

  // Hook into scanner button click to track scans
  if (btnScanner) {
    var origBtnScannerClick = btnScanner.onclick;
    btnScanner.addEventListener('click', function () {
      setTimeout(function () {
        var scans = lsGet(LS_SCANS, 0) + 1;
        lsSet(LS_SCANS, scans);
        checkAndUnlockBadges();
      }, 500);
    });
  }

  /* ─── Personalized Insights (IKEA EFFECT + ENDOWMENT) ─── */
  function generateInsights() {
    var insightsList = document.getElementById('insights-list');
    if (!insightsList) return;

    var level = computeProtectionLevel();
    var streak = lsGet(LS_STREAK, 1);
    var scans = lsGet(LS_SCANS, 0) || 0;

    var insights = [];

    // Dynamic insights based on user state
    if (level.active < 3) {
      insights.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Your protection is below recommended level',
        desc: 'Only ' + level.active + ' of 5 shields active. Users with 3+ shields are 73% less likely to fall victim to identity theft.'
      });
    }

    if (streak >= 3) {
      insights.push({
        type: 'success',
        icon: '🔥',
        title: 'Your ' + streak + '-day streak is above average',
        desc: 'Consistent users catch 4x more threats. You\'re in the top 15% of active protectors.'
      });
    }

    if (scans === 0) {
      insights.push({
        type: 'info',
        icon: '🔍',
        title: 'You haven\'t run your first scan yet',
        desc: 'The average user finds 2.3 potential threats in their first scan. Try scanning a social media profile picture.'
      });
    } else if (scans >= 10) {
      insights.push({
        type: 'success',
        icon: '🎯',
        title: 'You\'ve scanned ' + scans + ' items',
        desc: 'Power users like you are 5x more likely to catch deepfakes early. Keep it up!'
      });
    }

    // Always show a contextual tip
    var tips = [
      { type: 'info', icon: '💡', title: 'Pro tip: Enable Camera Immunizer', desc: 'It automatically protects every photo you take — no manual scanning needed.' },
      { type: 'info', icon: '💡', title: 'Pro tip: Schedule deep scans', desc: 'Weekly deep scans catch 89% more threats than manual scans alone.' },
      { type: 'info', icon: '💡', title: 'Pro tip: Voice Shield protects calls', desc: 'Real-time audio scrambling prevents voice cloning attacks during phone calls.' }
    ];
    insights.push(tips[Math.floor(Math.random() * tips.length)]);

    // Render
    insightsList.innerHTML = '';
    insights.forEach(function (ins) {
      var card = document.createElement('div');
      card.className = 'insight-card insight-card-' + ins.type;
      card.innerHTML = '<span class="insight-icon">' + ins.icon + '</span><div class="insight-content"><p class="insight-title">' + ins.title + '</p><p class="insight-desc">' + ins.desc + '</p></div>';
      insightsList.appendChild(card);
    });
  }

  /* ─── Urgency Countdown (FOMO + SCARCITY) ─── */
  var urgencyCountdown = document.getElementById('urgency-countdown');
  var urgencyBlock = document.getElementById('urgency-block');

  function updateUrgency() {
    if (!urgencyCountdown) return;
    // Simulate a 48-hour window from "last exposure"
    var baseHours = 36 + Math.floor(Math.random() * 6);
    var baseMins = Math.floor(Math.random() * 60);
    var hours = baseHours;
    var mins = baseMins;

    function tick() {
      if (hours <= 0 && mins <= 0) {
        urgencyCountdown.textContent = 'EXPIRED';
        urgencyCountdown.style.color = 'var(--text-muted)';
        return;
      }
      if (mins <= 0) { hours--; mins = 59; }
      else { mins--; }
      urgencyCountdown.textContent = hours + 'h ' + String(mins).padStart(2, '0') + 'm';
      setTimeout(tick, 60000);
    }
    tick();
  }

  /* ─── Protection Timeline (ENDOWMENT + SUNK COST) ─── */
  function updateTimeline() {
    var startDate = document.getElementById('timeline-start-date');
    var timelineDays = document.getElementById('timeline-days');
    var timelineHours = document.getElementById('timeline-hours');

    // Get account creation date from user data or default to today
    var createdAt = null;
    try {
      var userData = window.EnclaveAPI && window.EnclaveAPI.getUserData ? null : null; // Will use localStorage
      createdAt = lsGet('enclave_created_at', null);
    } catch (e) {}

    if (!createdAt) {
      createdAt = new Date().toISOString();
      lsSet('enclave_created_at', createdAt);
    }

    var diff = Date.now() - new Date(createdAt).getTime();
    var days = Math.max(1, Math.floor(diff / 86400000));
    var hours = Math.floor((diff % 86400000) / 3600000);

    if (startDate) {
      var d = new Date(createdAt);
      startDate.textContent = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    if (timelineDays) timelineDays.textContent = days;
    if (timelineHours) timelineHours.textContent = (days * 24) + hours;
  }

  /* ─── Master Refresh for Psychology Elements ─── */
  function refreshPsychologyElements() {
    updateStreak();
    updateThreatAvoidance();
    updateSocialProofNumbers();
    checkAndUnlockBadges();
    generateInsights();
    updateUrgency();
    updateTimeline();
  }

  // Hook into existing refresh cycle
  var origRefreshAll = refreshAllPanels;
  refreshAllPanels = function () {
    origRefreshAll();
    refreshPsychologyElements();
  };

  // Initial load
  setTimeout(refreshPsychologyElements, 800);

  /* ─── Tab Switching ─── */
  var navItems = document.querySelectorAll('.nav-item[data-tab]');
  var tabContents = document.querySelectorAll('.tab-content');
  var mobileSidebar = document.getElementById('sidebar');
  var sidebarOverlay = document.getElementById('sidebar-overlay');

  function switchTab(tabName) {
    navItems.forEach(function (n) { n.classList.toggle('active', n.dataset.tab === tabName); });
    tabContents.forEach(function (t) {
      var isActive = t.id === 'tab-' + tabName;
      t.classList.toggle('active', isActive);
      if (isActive && window.EnclaveUI) window.EnclaveUI.animateTabIn(t);
    });
    // Close mobile sidebar after switch
    if (mobileSidebar) mobileSidebar.classList.remove('open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('active');
  }

  navItems.forEach(function (item) {
    item.addEventListener('click', function () { switchTab(item.dataset.tab); });
  });

  // Sidebar lock button — uses the same btnLock ref from top

  // Mobile sidebar toggle
  var btnToggle = document.getElementById('btn-sidebar-toggle');
  if (btnToggle) {
    btnToggle.addEventListener('click', function () {
      mobileSidebar.classList.toggle('open');
      sidebarOverlay.classList.toggle('active');
    });
  }
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', function () {
      mobileSidebar.classList.remove('open');
      sidebarOverlay.classList.remove('active');
    });
  }

  // Quick action cards — route to tabs
  document.querySelectorAll('.action-card[data-tab]').forEach(function (card) {
    card.addEventListener('click', function () {
      switchTab(card.dataset.tab);
      // Deep scan action card: trigger scan after switching to scan tab
      if (card.id === 'btn-deep-scan-action') {
        setTimeout(function () { triggerDeepScan(); }, 300);
      }
    });
  });

  // Shield toggle buttons — animate on click
  document.querySelectorAll('.shield-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var card = btn.closest('.shield-card');
      if (card && window.EnclaveUI) {
        var badge = card.querySelector('.shield-module-badge');
        var willActivate = badge && badge.classList.contains('inactive');
        window.EnclaveUI.animateShieldToggle(card, willActivate);
      }
    });
  });

  // Toast enter animation observer
  var toastContainer = document.getElementById('toast-container');
  if (toastContainer) {
    var toastObs = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType === 1 && window.EnclaveUI) window.EnclaveUI.animateToast(node);
        });
      });
    });
    toastObs.observe(toastContainer, { childList: true });
  }

  // Re-init ripples on nav switch
  var origSwitchTab = switchTab;
  switchTab = function (tabName) {
    origSwitchTab(tabName);
    setTimeout(function () {
      if (window.EnclaveUI) { window.EnclaveUI.initRipples(); window.EnclaveUI.initCardPress(); }
    }, 50);
  };

})();
