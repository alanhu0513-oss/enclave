/* ─── Enclave On-Device ML Bridge ───
 * Routes image classification to native Core ML (iOS) or LiteRT (Android),
 * with automatic server fallback for web or when model isn't available.
 */

(function () {
  'use strict';

  var EnclaveNative = window.EnclaveNative = window.EnclaveNative || {};

  var _capabilities = null;
  var _modelLoaded = false;

  /* ─── Capability Detection ─── */

  async function detectCapabilities() {
    if (_capabilities) return _capabilities;

    if (EnclaveNative.isNative && EnclaveNative.isNative()) {
      var platform = navigator.platform.toLowerCase();
      var isIOS = /iphone|ipad|ipod/.test(platform) ||
                  (navigator.userAgent && /iphone|ipad|ipod/.test(navigator.userAgent));
      var isAndroid = /android/.test(platform) ||
                      (navigator.userAgent && /android/.test(navigator.userAgent));

      try {
        var Capacitor = window.Capacitor;
        if (isIOS && Capacitor.Plugins.OnDeviceML) {
          var caps = await Capacitor.Plugins.OnDeviceML.getCapabilities();
          _capabilities = {
            available: caps.available,
            platform: 'ios',
            framework: 'coreml',
            hasNeuralEngine: caps.hasNeuralEngine,
          };
        } else if (isAndroid && Capacitor.Plugins.OnDeviceML) {
          var caps = await Capacitor.Plugins.OnDeviceML.getCapabilities();
          _capabilities = {
            available: caps.available,
            platform: 'android',
            framework: 'ltert',
            hasNNAPI: caps.hasNNAPI,
          };
        }
      } catch (e) {
        console.warn('[OnDeviceML] Capability detection failed:', e);
      }
    }

    if (!_capabilities) {
      _capabilities = {
        available: false,
        platform: 'web',
        framework: 'server',
      };
    }

    return _capabilities;
  }

  /* ─── Model Management ─── */

  async function loadModel(modelName) {
    var caps = await detectCapabilities();
    if (!caps.available) {
      console.log('[OnDeviceML] No native ML available, using server fallback');
      return { loaded: false, fallback: 'server' };
    }

    try {
      var Capacitor = window.Capacitor;
      var result = await Capacitor.Plugins.OnDeviceML.loadModel({
        modelName: modelName || 'xceptionnet',
      });
      _modelLoaded = result.loaded;
      return result;
    } catch (e) {
      console.warn('[OnDeviceML] Model load failed:', e.message);
      return { loaded: false, error: e.message, fallback: 'server' };
    }
  }

  /* ─── Classification ─── */

  async function classifyImage(base64Image) {
    var caps = await detectCapabilities();

    // Try on-device first
    if (caps.available && _modelLoaded) {
      try {
        var Capacitor = window.Capacitor;
        var result = await Capacitor.Plugins.OnDeviceML.classify({
          image: base64Image,
        });
        result.onDevice = true;
        return result;
      } catch (e) {
        console.warn('[OnDeviceML] On-device classify failed, falling back to server:', e.message);
      }
    }

    // Fallback: server
    return serverClassify(base64Image);
  }

  async function classifyFromUrl(imageUrl) {
    var caps = await detectCapabilities();

    if (caps.available && _modelLoaded) {
      try {
        var Capacitor = window.Capacitor;
        var result = await Capacitor.Plugins.OnDeviceML.classifyFromUrl({
          url: imageUrl,
        });
        result.onDevice = true;
        return result;
      } catch (e) {
        console.warn('[OnDeviceML] On-device URL classify failed:', e.message);
      }
    }

    // Fallback: server
    return serverClassifyUrl(imageUrl);
  }

  /* ─── Server Fallback ─── */

  async function serverClassify(base64Image) {
    try {
      var apiBase = localStorage.getItem('enclave_api_base') || 'http://localhost:4000';
      var token = localStorage.getItem('enclave_auth_token');

      // Convert base64 to blob
      var byteString = atob(base64Image.split(',')[1] || base64Image);
      var ab = new ArrayBuffer(byteString.length);
      var ia = new Uint8Array(ab);
      for (var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      var blob = new Blob([ab], { type: 'image/jpeg' });

      var formData = new FormData();
      formData.append('image', blob, 'image.jpg');

      var headers = {};
      if (token) headers['Authorization'] = 'Bearer ' + token;

      var res = await fetch(apiBase + '/api/detect/image', {
        method: 'POST',
        headers: headers,
        body: formData,
      });

      if (!res.ok) throw new Error('Server returned ' + res.status);
      var data = await res.json();
      var result = data.data || data;
      result.onDevice = false;
      result.source = 'server';
      return result;
    } catch (e) {
      return { confidence: 0, verdict: 'ERROR', error: e.message, onDevice: false };
    }
  }

  async function serverClassifyUrl(imageUrl) {
    try {
      var apiBase = localStorage.getItem('enclave_api_base') || 'http://localhost:4000';
      var token = localStorage.getItem('enclave_auth_token');

      var headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;

      var res = await fetch(apiBase + '/api/detect/url', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ url: imageUrl }),
      });

      if (!res.ok) throw new Error('Server returned ' + res.status);
      var data = await res.json();
      var result = data.data || data;
      result.onDevice = false;
      result.source = 'server';
      return result;
    } catch (e) {
      return { confidence: 0, verdict: 'ERROR', error: e.message, onDevice: false };
    }
  }

  /* ─── Public API ─── */

  EnclaveNative.onDeviceML = {
    detectCapabilities: detectCapabilities,
    loadModel: loadModel,
    classifyImage: classifyImage,
    classifyFromUrl: classifyFromUrl,
    isModelLoaded: function () { return _modelLoaded; },

    // Auto-load model on native platforms
    init: async function () {
      var caps = await detectCapabilities();
      if (caps.available) {
        console.log('[OnDeviceML] Platform:', caps.platform, '| Framework:', caps.framework);
        var result = await loadModel('xceptionnet');
        if (result.loaded) {
          console.log('[OnDeviceML] Model loaded on-device');
        } else {
          console.log('[OnDeviceML] Model not bundled, using server fallback');
        }
        return result;
      } else {
        console.log('[OnDeviceML] Web platform, using server');
        return { loaded: false, fallback: 'server' };
      }
    },
  };

})();
