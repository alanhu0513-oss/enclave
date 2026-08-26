/* ─── Enclave API Client ───
 * JWT stored in @capacitor-community/secure-storage (native) / sessionStorage (PWA fallback).
 * All methods return Promises.
 */
(function () {
  'use strict';

  var API_BASE = window.sessionStorage.getItem('enclave_api_url')
    || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:4000/api'
      : window.location.origin + '/api');
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
    forgotPassword: function (email) {
      return apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email })
      });
    },
    resetPassword: function (email, code, newPassword) {
      return apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: email, code: code, newPassword: newPassword })
      });
    },
    googleAuth: function (credential) {
      return apiFetch('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential: credential })
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
    detectText: function (text) {
      return apiFetch('/detect/text', {
        method: 'POST',
        body: JSON.stringify({ text: text })
      });
    },
    getDetectStatus: function () {
      return apiFetch('/detect/status');
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

    // Monitoring (Phase 2)
    getMonitoringStatus: function () { return apiFetch('/monitoring/status'); },
    startMonitoring: function () { return apiFetch('/monitoring/start', { method: 'POST' }); },
    stopMonitoring: function () { return apiFetch('/monitoring/stop', { method: 'POST' }); },
    runMonitoringOnce: function () { return apiFetch('/monitoring/run-once', { method: 'POST' }); },

    // User
    getUserData: function () { return apiFetch('/user/data'); },
    deleteUserData: function () { return apiFetch('/user/data', { method: 'DELETE' }); },
    updateProfile: function (fullName) {
      return apiFetch('/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ fullName: fullName })
      });
    },

    // Notifications
    getNotifications: function (opts) {
      var params = [];
      if (opts && opts.unreadOnly) params.push('unread=true');
      if (opts && opts.limit) params.push('limit=' + opts.limit);
      var qs = params.length ? '?' + params.join('&') : '';
      return apiFetch('/notifications' + qs);
    },
    getUnreadCount: function () { return apiFetch('/notifications/unread-count'); },
    markNotificationRead: function (id) { return apiFetch('/notifications/' + id + '/read', { method: 'PATCH' }); },
    markAllNotificationsRead: function () { return apiFetch('/notifications/read-all', { method: 'POST' }); },
    getNotificationPreferences: function () { return apiFetch('/notifications/preferences'); },
    updateNotificationPreferences: function (prefs) {
      return apiFetch('/notifications/preferences', {
        method: 'PATCH',
        body: JSON.stringify(prefs)
      });
    },

    // Legal (Phase 5)
    getLegalDoc: function (id) { return apiFetch('/legal/' + id); },

    // GDPR export — returns a Blob
    getUserExport: async function () {
      var token = await getToken();
      var headers = {};
      if (token) headers['Authorization'] = 'Bearer ' + token;
      var res = await fetch(API_BASE + '/user/export', { headers: headers });
      if (!res.ok) throw new Error('Export failed');
      return res.blob();
    },

    // Takedowns
    getTakedowns: function () { return apiFetch('/takedowns'); },
    getTakedown: function (id) { return apiFetch('/takedowns/' + id); },
    initiateTakedown: function (alertId, type, sendEmail) {
      return apiFetch('/takedowns/' + alertId + '/initiate', {
        method: 'POST',
        body: JSON.stringify({ type: type || 'dmca', sendEmail: sendEmail !== false })
      });
    },
    getTakedownStats: function () { return apiFetch('/takedowns/stats/summary'); },
    getTakedownEvidence: function (id) { return apiFetch('/takedowns/' + id + '/evidence'); },
    getVerification: function (id) { return apiFetch('/takedowns/' + id + '/verification'); },
    recordCounterNotice: function (id, details) {
      return apiFetch('/takedowns/' + id + '/counter-notice', {
        method: 'POST',
        body: JSON.stringify({ details: details || '' })
      });
    },
    getFilingGuides: function () { return apiFetch('/takedowns/filing-guides'); },
    getFilingGuide: function (platform) { return apiFetch('/takedowns/filing-guides/' + platform); },

    // Billing & Subscription
    getSubscription: function () { return apiFetch('/billing/subscription'); },
    getTiers: function () { return apiFetch('/billing/tiers'); },
    startCheckout: function (tier, successUrl, cancelUrl) {
      return apiFetch('/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ tier: tier, successUrl: successUrl, cancelUrl: cancelUrl })
      });
    },
    createCheckout: function (tier, successUrl, cancelUrl) {
      return apiFetch('/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ tier: tier, successUrl: successUrl, cancelUrl: cancelUrl })
      });
    },
    createPortal: function (returnUrl) {
      return apiFetch('/billing/portal', {
        method: 'POST',
        body: JSON.stringify({ returnUrl: returnUrl })
      });
    },
    getUsage: function () { return apiFetch('/billing/usage'); },
    getReferrals: function () { return apiFetch('/billing/referrals'); },
    claimReferral: function () { return apiFetch('/billing/referrals/claim', { method: 'POST' }); },

    // Shields & Stats
    getShieldStats: function () { return apiFetch('/shields/stats'); },
    getShieldSummary: function () { return apiFetch('/shields/summary'); },
    recordShieldEvent: function (type, detail, status) {
      return apiFetch('/shields/record', {
        method: 'POST',
        body: JSON.stringify({ type: type, detail: detail, status: status })
      });
    },

    // Community
    getThreatShares: function (opts) {
      var params = [];
      if (opts && opts.limit) params.push('limit=' + opts.limit);
      if (opts && opts.type) params.push('iocType=' + opts.type);
      var qs = params.length ? '?' + params.join('&') : '';
      return apiFetch('/community/threats' + qs);
    },
    shareThreat: function (data) {
      return apiFetch('/community/threats/share', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    voteThreat: function (id, vote) {
      return apiFetch('/community/threats/' + id + '/vote', {
        method: 'POST',
        body: JSON.stringify({ vote: vote })
      });
    },
    getForumPosts: function (opts) {
      var params = [];
      if (opts && opts.limit) params.push('limit=' + opts.limit);
      if (opts && opts.category) params.push('category=' + opts.category);
      var qs = params.length ? '?' + params.join('&') : '';
      return apiFetch('/community/forum/posts' + qs);
    },
    createForumPost: function (data) {
      return apiFetch('/community/forum/posts', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    getCommunityStats: function () { return apiFetch('/community/forum/stats'); },
    getThreatStats: function () { return apiFetch('/community/threats/stats'); },

    // Health
    getHealth: function () { return apiFetch('/health'); }
  };
})();
