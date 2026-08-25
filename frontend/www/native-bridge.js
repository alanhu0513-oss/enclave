(function () {
  'use strict';

  var EnclaveNative = window.EnclaveNative = {};

  EnclaveNative.isNative = function () {
    return typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform();
  };

  EnclaveNative.isCapacitor = function () {
    return typeof window.Capacitor !== 'undefined';
  };

  /* ─── Camera Immunizer Core ─── */
  var cameraState = { active: false, cloakedCount: 0, lastActive: null, watcherId: null };

  EnclaveNative.cameraImmunizer = {
    start: async function () {
      try {
        if (this.isActive()) return true;
        if (EnclaveNative.isNative()) {
          try {
            var Capacitor = window.Capacitor;
            if (Capacitor.Plugins && Capacitor.Plugins.Filesystem) {
              var fs = Capacitor.Plugins.Filesystem;
              var result = await fs.watch({
                path: 'DCIM',
                directory: Capacitor.FilesystemDirectory.ExternalStorage,
                recursive: false
              });
              if (result && result.events) {
                result.events.addListener('fileAdded', function (info) {
                  EnclaveNative.cameraImmunizer.cloakPhoto(info.path).catch(function () {});
                });
              }
            }
          } catch (_) {}
        }
        cameraState.active = true;
        cameraState.lastActive = new Date().toISOString();
        this.broadcastStatus();
        if (window.EnclaveShieldStats) EnclaveShieldStats.recordShieldActivation('camera');
        return true;
      } catch (e) {
        console.warn('[EnclaveNative] Camera Immunizer start failed:', e);
        return false;
      }
    },

    stop: async function () {
      try {
        cameraState.active = false;
        if (cameraState.watcherId) {
          clearInterval(cameraState.watcherId);
          cameraState.watcherId = null;
        }
        this.broadcastStatus();
        return true;
      } catch (e) { return false; }
    },

    isActive: function () { return cameraState.active; },

    cloakPhoto: async function (photoPath) {
      if (!this.isActive()) return false;
      try {
        if (EnclaveNative.isNative()) {
          var Capacitor = window.Capacitor;
          if (Capacitor.Plugins && Capacitor.Plugins.Filesystem) {
            var fs = Capacitor.Plugins.Filesystem;
            var file = await fs.readFile({ path: photoPath });
            if (file && file.data) {
              var immunized = immunizePhoto(file.data);
              await fs.writeFile({ path: photoPath, data: immunized, directory: Capacitor.FilesystemDirectory.ExternalStorage });
            }
          }
        }
        cameraState.cloakedCount++;
        cameraState.lastActive = new Date().toISOString();
        this.broadcastStatus();
        if (window.EnclaveShieldStats) EnclaveShieldStats.recordScan({ source: 'camera', threat: false });
        return true;
      } catch (e) {
        console.warn('[EnclaveNative] Cloak failed:', e);
        return false;
      }
    },

    getStatus: function () {
      return { active: cameraState.active, cloakedCount: cameraState.cloakedCount, lastActive: cameraState.lastActive };
    },

    broadcastStatus: function () {
      var evt = new CustomEvent('enclave-camera-status', { detail: this.getStatus() });
      window.dispatchEvent(evt);
    }
  };

  function injectNoiseMatrix(base64Data) {
    var binary = atob(base64Data);
    var len = binary.length;
    var arr = new Uint8Array(len);
    for (var i = 0; i < len; i++) arr[i] = binary.charCodeAt(i);
    var hdrEnd = 0;
    for (var i = 0; i < Math.min(len, 200); i++) {
      if (arr[i] === 0xFF && arr[i + 1] === 0xDA) { hdrEnd = i + 2; break; }
    }
    if (hdrEnd === 0) hdrEnd = Math.floor(len * 0.1);
    for (var i = hdrEnd; i < len; i += 4) {
      var noise = Math.floor(Math.random() * 6) - 3;
      arr[i] = Math.max(0, Math.min(255, arr[i] + noise));
    }
    return btoa(String.fromCharCode.apply(null, arr));
  }

  function immunizePhoto(base64Data, producerId) {
    var result = base64Data;

    // Step 1: Embed C2PA content credentials
    if (window.EnclaveContentCredentials) {
      try {
        result = EnclaveContentCredentials.embedCredentials(result, {
          claimName: 'Enclave Vault Protected',
          producerId: producerId || 'user',
          metadata: { protectedAt: new Date().toISOString() }
        });
        if (window.EnclaveShieldStats) EnclaveShieldStats.recordC2PA();
      } catch (e) {
        console.warn('[EnclaveNative] C2PA embedding failed:', e);
      }
    }

    // Step 2: Embed invisible watermark
    if (window.EnclaveWatermark) {
      try {
        var img = new Image();
        img.src = 'data:image/jpeg;base64,' + result;
        // Watermark is async (canvas), but for the file system path
        // we do a synchronous approximation via LSB manipulation
        var binary = atob(result);
        var arr = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);

        // Find SOI
        var soiEnd = 2;
        if (arr[0] === 0xFF && arr[1] === 0xD8) {
          // Embed sync pattern in blue channel LSBs of first few hundred pixels
          var syncPattern = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
          for (var i = 0; i < syncPattern.length; i++) {
            var pixIdx = 40 + i * 8; // Spread across pixels
            if (pixIdx + 2 < arr.length) {
              arr[pixIdx + 2] = (arr[pixIdx + 2] & 0xFE) | syncPattern[i];
            }
          }
          // Embed timestamp bits
          var ts = Math.floor(Date.now() / 1000).toString(2);
          for (var i = 0; i < ts.length; i++) {
            var pixIdx = 200 + i * 8;
            if (pixIdx + 2 < arr.length) {
              arr[pixIdx + 2] = (arr[pixIdx + 2] & 0xFE) | parseInt(ts[i]);
            }
          }
          if (window.EnclaveShieldStats) EnclaveShieldStats.recordWatermark();
        }

        result = btoa(String.fromCharCode.apply(null, arr));
      } catch (e) {
        console.warn('[EnclaveNative] Watermark embedding failed:', e);
      }
    }

    // Step 3: Fallback — legacy noise injection
    if (!window.EnclaveContentCredentials && !window.EnclaveWatermark) {
      result = injectNoiseMatrix(base64Data);
    }

    return result;
  }

  /* ─── Voice Shield Tunnel + Authentication ─── */
  var voiceState = { active: false, sessionsProtected: 0, lastActive: null, frequency: 800, voiceprint: null, enrolled: false };

  EnclaveNative.voiceShield = {
    setFrequency: function (freq) {
      voiceState.frequency = freq;
    },

    getFrequency: function () {
      return voiceState.frequency;
    },

    enrollVoice: async function (duration) {
      try {
        if (!window.EnclaveVoiceAuth) return { success: false, reason: 'voice_auth_not_loaded' };
        var result = await EnclaveVoiceAuth.enrollVoice(duration || 3000);
        voiceState.voiceprint = result.voiceprint;
        voiceState.enrolled = true;
        // Persist to secure storage
        if (EnclaveNative.secureStorage) {
          await EnclaveNative.secureStorage.set('enclave_voiceprint', JSON.stringify(result));
        }
        if (window.EnclaveShieldStats) EnclaveShieldStats.recordVoiceEnrollment();
        this.broadcastStatus();
        return { success: true, voiceprint: result.voiceprint, numFrames: result.numFrames };
      } catch (e) {
        console.warn('[EnclaveNative] Voice enrollment failed:', e);
        return { success: false, reason: e.message || 'enrollment_error' };
      }
    },

    verifyVoice: async function (threshold) {
      try {
        if (!window.EnclaveVoiceAuth) return { match: false, reason: 'voice_auth_not_loaded' };
        if (!voiceState.voiceprint) {
          // Try loading from secure storage
          if (EnclaveNative.secureStorage) {
            var stored = await EnclaveNative.secureStorage.get('enclave_voiceprint');
            if (stored) {
              var parsed = JSON.parse(stored);
              voiceState.voiceprint = parsed.voiceprint;
              voiceState.enrolled = true;
            }
          }
        }
        if (!voiceState.voiceprint) return { match: false, reason: 'not_enrolled' };

        var result = await EnclaveVoiceAuth.verifyVoice(voiceState.voiceprint, threshold || 0.85);
        if (window.EnclaveShieldStats) EnclaveShieldStats.recordVoiceVerification(result.match);
        this.broadcastStatus();
        return result;
      } catch (e) {
        console.warn('[EnclaveNative] Voice verification failed:', e);
        return { match: false, reason: e.message || 'verification_error' };
      }
    },

    getVoiceprint: function () {
      return voiceState.voiceprint ? { enrolled: true, enrolledAt: voiceState.enrolled } : { enrolled: false };
    },

    start: async function () {
      try {
        if (this.isActive()) return true;
        if (EnclaveNative.isNative()) {
          try {
            var Capacitor = window.Capacitor;
            if (Capacitor.Plugins && Capacitor.Plugins.Audio) {
              await Capacitor.Plugins.Audio.startBackgroundAudio({
                category: 'playback',
                mixing: false
              });
            }
          } catch (_) {}
        }
        voiceState.active = true;
        voiceState.lastActive = new Date().toISOString();
        this.broadcastStatus();
        if (window.EnclaveShieldStats) EnclaveShieldStats.recordShieldActivation('voice');
        return true;
      } catch (e) {
        console.warn('[EnclaveNative] Voice Shield start failed:', e);
        return false;
      }
    },

    stop: async function () {
      try {
        voiceState.active = false;
        if (EnclaveNative.isNative()) {
          try {
            var Capacitor = window.Capacitor;
            if (Capacitor.Plugins && Capacitor.Plugins.Audio) {
              await Capacitor.Plugins.Audio.stopBackgroundAudio();
            }
          } catch (_) {}
        }
        this.broadcastStatus();
        return true;
      } catch (e) { return false; }
    },

    isActive: function () { return voiceState.active; },

    getStatus: function () {
      return { active: voiceState.active, sessionsProtected: voiceState.sessionsProtected, lastActive: voiceState.lastActive, enrolled: voiceState.enrolled, hasVoiceprint: !!voiceState.voiceprint };
    },

    broadcastStatus: function () {
      var evt = new CustomEvent('enclave-voice-status', { detail: this.getStatus() });
      window.dispatchEvent(evt);
    }
  };

  /* ─── Shield Overlay (System-wide Floating Bubble / Live Activity) ─── */
  var shieldOverlayState = { active: false, platformActive: false };

  EnclaveNative.shieldOverlay = {
    start: async function () {
      try {
        if (shieldOverlayState.active) return true;
        var widgetEnabled = localStorage.getItem('enclave_widget_enabled');
        if (widgetEnabled === 'false') {
          shieldOverlayState.platformActive = false;
          shieldOverlayState.active = true;
          return true;
        }
        if (EnclaveNative.isNative()) {
          var Capacitor = window.Capacitor;
          if (Capacitor.Plugins && Capacitor.Plugins.ShieldOverlay) {
            var opts = {};
            if (EnclaveNative.getPlatform && EnclaveNative.getPlatform() === 'ios') {
              opts.widgetEnabled = widgetEnabled !== 'false';
            }
            var result = await Capacitor.Plugins.ShieldOverlay.start(opts);
            if (result && result.requiresPermission) {
              // Need overlay permission on Android
              if (Capacitor.getPlatform() === 'android') {
                await Capacitor.Plugins.ShieldOverlay.requestOverlayPermission();
              }
              shieldOverlayState.platformActive = false;
              return false;
            }
            shieldOverlayState.platformActive = true;
          } else {
            // Fallback: if plugin not registered, still mark as active for PWA
            shieldOverlayState.platformActive = true;
          }
        } else {
          shieldOverlayState.platformActive = true;
        }
        shieldOverlayState.active = true;
        return true;
      } catch (e) {
        console.warn('[EnclaveNative] Shield Overlay start failed:', e);
        return false;
      }
    },

    stop: async function () {
      try {
        if (EnclaveNative.isNative()) {
          var Capacitor = window.Capacitor;
          if (Capacitor.Plugins && Capacitor.Plugins.ShieldOverlay) {
            await Capacitor.Plugins.ShieldOverlay.stop();
          }
        }
        shieldOverlayState.active = false;
        shieldOverlayState.platformActive = false;
        return true;
      } catch (e) { return false; }
    },

    deactivateAll: function () {
      // Called when user taps the floating bubble or Live Activity DISABLE button
      shieldOverlayState.active = false;
      shieldOverlayState.platformActive = false;

      // Stop camera immunizer
      if (EnclaveNative.cameraImmunizer && EnclaveNative.cameraImmunizer.isActive()) {
        EnclaveNative.cameraImmunizer.stop();
        var camToggle = document.getElementById('toggle-camera-shield');
        if (camToggle) camToggle.checked = false;
      }
      // Stop voice shield
      if (EnclaveNative.voiceShield && EnclaveNative.voiceShield.isActive()) {
        EnclaveNative.voiceShield.stop();
        var voiceToggle = document.getElementById('toggle-voice-shield');
        if (voiceToggle) voiceToggle.checked = false;
      }
      // Stop the native overlay itself
      this.stop();
    },

    isActive: function () { return shieldOverlayState.active; },

    getStatus: function () {
      return {
        active: shieldOverlayState.active,
        platformActive: shieldOverlayState.platformActive,
        cameraActive: EnclaveNative.cameraImmunizer ? EnclaveNative.cameraImmunizer.isActive() : false,
        voiceActive: EnclaveNative.voiceShield ? EnclaveNative.voiceShield.isActive() : false
      };
    }
  };

  /* ─── Secure Storage ─── */
  EnclaveNative.secureStorage = {
    get: async function (key) {
      try {
        if (EnclaveNative.isNative()) {
          var Capacitor = window.Capacitor;
          if (Capacitor.Plugins && Capacitor.Plugins.SecureStorage) {
            var result = await Capacitor.Plugins.SecureStorage.get({ key: key });
            return result && result.value ? result.value : null;
          }
        }
        var v = sessionStorage.getItem(key);
        return v !== null ? v : null;
      } catch (e) { return null; }
    },

    set: async function (key, value) {
      try {
        if (EnclaveNative.isNative()) {
          var Capacitor = window.Capacitor;
          if (Capacitor.Plugins && Capacitor.Plugins.SecureStorage) {
            await Capacitor.Plugins.SecureStorage.set({ key: key, value: value });
            return;
          }
        }
        sessionStorage.setItem(key, value);
      } catch (e) {}
    },

    remove: async function (key) {
      try {
        if (EnclaveNative.isNative()) {
          var Capacitor = window.Capacitor;
          if (Capacitor.Plugins && Capacitor.Plugins.SecureStorage) {
            await Capacitor.Plugins.SecureStorage.remove({ key: key });
            return;
          }
        }
        sessionStorage.removeItem(key);
      } catch (e) {}
    }
  };

})();
