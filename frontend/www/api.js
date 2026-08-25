/* ─── Enclave API Client ───
 * JWT stored in @capacitor-community/secure-storage (native) / sessionStorage (PWA fallback).
 * All methods return Promises.
 */
(function () {
  'use strict';

  var API_BASE = window.sessionStorage.getItem('enclave_api_url') || 'http://localhost:4000/api';
  var TOKEN_KEY = 'enclave_jwt';

  // ─── Secure Storage Adapter ───
  var secureStore = null;

  async function initSecureStore() {
    if (secureStore) return secureStore;
    try {
      if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        var mod = await import('@capacitor-community/secure-storage');
        secureStore = mod.SecureStorage;
      }
    } catch (_) {}
    secureStore = secureStore || null;
    return secureStore;
  }

  async function getToken() {
    var store = await initSecureStore();
    if (store) {
      try { var r = await store.get({ key: TOKEN_KEY }); return r.value; }
      catch (_) { return null; }
    }
    return window.sessionStorage.getItem(TOKEN_KEY);
  }

  async function setToken(val) {
    var store = await initSecureStore();
    if (store) {
      try { await store.set({ key: TOKEN_KEY, value: val }); return; }
      catch (_) {}
    }
    if (val) window.sessionStorage.setItem(TOKEN_KEY, val);
    else window.sessionStorage.removeItem(TOKEN_KEY);
  }

  async function removeToken() {
    var store = await initSecureStore();
    if (store) {
      try { await store.remove({ key: TOKEN_KEY }); return; }
      catch (_) {}
    }
    window.sessionStorage.removeItem(TOKEN_KEY);
  }

  async function isLoggedIn() {
    var t = await getToken();
    return !!t;
  }

  // ─── Core fetch wrapper ───
  async function apiFetch(path, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    var token = await getToken();
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (!opts.headers['Content-Type'] && !(opts.body instanceof FormData)) {
      opts.headers['Content-Type'] = 'application/json';
    }
    var res = await fetch(API_BASE + path, opts);
    var body = await res.json();
    if (!body.success) throw new Error(body.message || 'API Error');
    return body.data;
  }

  async function apiFetchBlob(path) {
    var token = await getToken();
    var headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    var res = await fetch(API_BASE + path, { headers: headers });
    if (!res.ok) throw new Error('API Error');
    return res.blob();
  }

  // ─── Public API ───
  window.EnclaveAPI = {
    // Config
    setBaseUrl: function (url) { API_BASE = url; window.sessionStorage.setItem('enclave_api_url', url); },
    getBaseUrl: function () { return API_BASE; },
    getToken: getToken,
    isLoggedIn: isLoggedIn,
    logout: removeToken,
    setToken: setToken,

    // Auth
    register: function (email, password, fullName) {
      return apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: email, password: password, fullName: fullName })
      });
    },
    login: function (email, password) {
      return apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email, password: password })
      });
    },

    // Biometrics
    uploadFace: function (file, width, height) {
      var fd = new FormData();
      fd.append('face', file);
      fd.append('width', String(width || 64));
      fd.append('height', String(height || 48));
      return apiFetch('/biometrics/face', { method: 'POST', body: fd });
    },
    uploadVoice: function (file, profile, meta) {
      var fd = new FormData();
      if (file) fd.append('voice', file);
      fd.append('profile', JSON.stringify(profile || []));
      fd.append('bins', String(meta.bins || 64));
      fd.append('sampleRate', String(meta.sampleRate || 44100));
      fd.append('fftSize', String(meta.fftSize || 128));
      fd.append('frames', String(meta.frames || 0));
      fd.append('durationMs', String(meta.durationMs || 10000));
      return apiFetch('/biometrics/voice', { method: 'POST', body: fd });
    },
    uploadSignature: function (file) {
      var fd = new FormData();
      fd.append('signature', file);
      return apiFetch('/biometrics/signature', { method: 'POST', body: fd });
    },
    getBiometricStatus: function () {
      return apiFetch('/biometrics/status');
    },

    // Detection
    detectImage: function (file) {
      var fd = new FormData();
      fd.append('image', file);
      return apiFetch('/detect/image', { method: 'POST', body: fd });
    },
    detectUrl: function (url) {
      return apiFetch('/detect/url', {
        method: 'POST',
        body: JSON.stringify({ url: url })
      });
    },

    // Alerts
    getAlerts: function () { return apiFetch('/alerts'); },
    scanUrl: function (url) {
      return apiFetch('/alerts/scan/url', {
        method: 'POST',
        body: JSON.stringify({ url: url })
      });
    },
    scanImage: function (file) {
      var fd = new FormData();
      fd.append('image', file);
      return apiFetch('/alerts/scan/image', { method: 'POST', body: fd });
    },
    deepScan: function () { return apiFetch('/alerts/deep-scan', { method: 'POST' }); },
    whitelistAlert: function (id) { return apiFetch('/alerts/' + id + '/whitelist', { method: 'PATCH' }); },
    generateDocument: function (alertId, type) {
      return apiFetch('/alerts/' + alertId + '/document', {
        method: 'POST',
        body: JSON.stringify({ type: type || 'dmca' })
      });
    },
    deleteAlert: function (id) { return apiFetch('/alerts/' + id, { method: 'DELETE' }); },

    // Crawler
    getCrawlerStatus: function () { return apiFetch('/crawler/status'); },
    startCrawler: function () { return apiFetch('/crawler/start', { method: 'POST' }); },
    stopCrawler: function () { return apiFetch('/crawler/stop', { method: 'POST' }); },

    // User
    getUserData: function () { return apiFetch('/user/data'); },
    deleteUserData: function () { return apiFetch('/user/data', { method: 'DELETE' }); },
    updateProfile: function (fullName) {
      return apiFetch('/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ fullName: fullName })
      });
    },

    // Health
    getHealth: function () { return apiFetch('/health'); }
  };
})();
