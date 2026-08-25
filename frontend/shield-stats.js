/**
 * Shield Statistics Service
 * Tracks all shield activity: scans, detections, watermarks, C2PA embeddings,
 * voice enrollments, voice verifications, takedowns, and threats blocked.
 * Uses localStorage for persistence across sessions.
 */

var EnclaveShieldStats = (function () {

  var STORAGE_KEY = 'enclave_shield_stats';

  var DEFAULT_STATS = {
    imagesScanned: 0,
    deepfakesDetected: 0,
    deepfakesFound: 0,
    watermarksEmbedded: 0,
    c2paCredentialsEmbedded: 0,
    voiceEnrollments: 0,
    voiceVerifications: 0,
    voiceMatches: 0,
    voiceRejections: 0,
    takedownsInitiated: 0,
    takedownsCompleted: 0,
    alertsGenerated: 0,
    threatsBlocked: 0,
    crawlerRuns: 0,
    urlsScanned: 0,
    faceMatches: 0,
    sessionsProtected: 0,
    shieldActivations: 0,
    cameraImmunizerStarts: 0,
    voiceShieldStarts: 0,
    lastScanAt: null,
    lastDetectionAt: null,
    lastTakedownAt: null,
    firstActivatedAt: null,
    scanHistory: [],
    dailyStats: {},
    recentActivity: []
  };

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        // Merge with defaults to handle schema evolution
        var merged = {};
        for (var key in DEFAULT_STATS) {
          merged[key] = parsed[key] !== undefined ? parsed[key] : DEFAULT_STATS[key];
        }
        return merged;
      }
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT_STATS));
  }

  function save(stats) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch (e) {}
  }

  function getTodayKey() {
    return new Date().toISOString().split('T')[0];
  }

  function incrementDaily(stats, field) {
    var today = getTodayKey();
    if (!stats.dailyStats[today]) {
      stats.dailyStats[today] = {};
    }
    stats.dailyStats[today][field] = (stats.dailyStats[today][field] || 0) + 1;

    // Clean up old daily stats (keep last 90 days)
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    var cutoffStr = cutoff.toISOString().split('T')[0];
    for (var key in stats.dailyStats) {
      if (key < cutoffStr) delete stats.dailyStats[key];
    }
  }

  function addRecentActivity(stats, type, detail, status) {
    stats.recentActivity.unshift({
      type: type,
      detail: detail || '',
      status: status || 'success',
      timestamp: new Date().toISOString()
    });
    // Keep last 50 activities
    if (stats.recentActivity.length > 50) {
      stats.recentActivity = stats.recentActivity.slice(0, 50);
    }
  }

  var api = {
    /** Record an image scan */
    recordScan: function (result) {
      var stats = load();
      stats.imagesScanned++;
      stats.lastScanAt = new Date().toISOString();
      incrementDaily(stats, 'scans');
      if (result) {
        addRecentActivity(stats, 'scan', result.url || 'image', result.threat ? 'threat' : 'safe');
      }
      save(stats);
    },

    /** Record a deepfake detection */
    recordDetection: function (isDeepfake, score) {
      var stats = load();
      stats.deepfakesDetected++;
      if (isDeepfake) {
        stats.deepfakesFound++;
        stats.threatsBlocked++;
        stats.lastDetectionAt = new Date().toISOString();
        incrementDaily(stats, 'detections');
        addRecentActivity(stats, 'detection', 'deepfake (score: ' + (score * 100).toFixed(1) + '%)', 'blocked');
      } else {
        incrementDaily(stats, 'clean');
        addRecentActivity(stats, 'detection', 'clean image', 'safe');
      }
      save(stats);
    },

    /** Record watermark embedding */
    recordWatermark: function () {
      var stats = load();
      stats.watermarksEmbedded++;
      incrementDaily(stats, 'watermarks');
      addRecentActivity(stats, 'watermark', 'embedded', 'success');
      save(stats);
    },

    /** Record C2PA credential embedding */
    recordC2PA: function () {
      var stats = load();
      stats.c2paCredentialsEmbedded++;
      incrementDaily(stats, 'c2pa');
      addRecentActivity(stats, 'c2pa', 'credentials embedded', 'success');
      save(stats);
    },

    /** Record voice enrollment */
    recordVoiceEnrollment: function () {
      var stats = load();
      stats.voiceEnrollments++;
      incrementDaily(stats, 'voiceEnrollments');
      addRecentActivity(stats, 'voice', 'voiceprint enrolled', 'success');
      save(stats);
    },

    /** Record voice verification */
    recordVoiceVerification: function (matched) {
      var stats = load();
      stats.voiceVerifications++;
      if (matched) {
        stats.voiceMatches++;
        addRecentActivity(stats, 'voice', 'voice matched', 'success');
      } else {
        stats.voiceRejections++;
        stats.threatsBlocked++;
        incrementDaily(stats, 'voiceRejections');
        addRecentActivity(stats, 'voice', 'voice rejected', 'blocked');
      }
      save(stats);
    },

    /** Record takedown */
    recordTakedown: function (completed) {
      var stats = load();
      stats.takedownsInitiated++;
      stats.lastTakedownAt = new Date().toISOString();
      if (completed) stats.takedownsCompleted++;
      incrementDaily(stats, 'takedowns');
      addRecentActivity(stats, 'takedown', completed ? 'completed' : 'initiated', 'success');
      save(stats);
    },

    /** Record alert */
    recordAlert: function () {
      var stats = load();
      stats.alertsGenerated++;
      incrementDaily(stats, 'alerts');
      save(stats);
    },

    /** Record URL scan from crawler */
    recordCrawl: function (urlsScanned, detections) {
      var stats = load();
      stats.crawlerRuns++;
      stats.urlsScanned += urlsScanned || 0;
      if (detections) stats.faceMatches += detections;
      incrementDaily(stats, 'crawlerRuns');
      save(stats);
    },

    /** Record shield activation */
    recordShieldActivation: function (shieldType) {
      var stats = load();
      stats.shieldActivations++;
      if (shieldType === 'camera') stats.cameraImmunizerStarts++;
      if (shieldType === 'voice') stats.voiceShieldStarts++;
      incrementDaily(stats, 'shieldActivations');
      save(stats);
    },

    /** Record session protection */
    recordSession: function () {
      var stats = load();
      stats.sessionsProtected++;
      incrementDaily(stats, 'sessions');
      save(stats);
    },

    /** Get full stats */
    getStats: function () {
      return load();
    },

    /** Get summary for dashboard display */
    getSummary: function () {
      var stats = load();
      return {
        imagesScanned: stats.imagesScanned,
        deepfakesFound: stats.deepfakesFound,
        watermarksEmbedded: stats.watermarksEmbedded,
        c2paCredentialsEmbedded: stats.c2paCredentialsEmbedded,
        threatsBlocked: stats.threatsBlocked,
        takedownsCompleted: stats.takedownsCompleted,
        voiceEnrollments: stats.voiceEnrollments,
        sessionsProtected: stats.sessionsProtected,
        firstActivatedAt: stats.firstActivatedAt,
        lastScanAt: stats.lastScanAt,
        lastDetectionAt: stats.lastDetectionAt,
        lastTakedownAt: stats.lastTakedownAt,
        recentActivity: stats.recentActivity.slice(0, 10)
      };
    },

    /** Get daily stats for chart */
    getDailyStats: function (days) {
      days = days || 30;
      var stats = load();
      var result = [];
      for (var i = days - 1; i >= 0; i--) {
        var d = new Date();
        d.setDate(d.getDate() - i);
        var key = d.toISOString().split('T')[0];
        result.push({
          date: key,
          scans: (stats.dailyStats[key] || {}).scans || 0,
          detections: (stats.dailyStats[key] || {}).detections || 0,
          threats: (stats.dailyStats[key] || {}).threats || 0
        });
      }
      return result;
    },

    /** Mark first activation time */
    markFirstActivation: function () {
      var stats = load();
      if (!stats.firstActivatedAt) {
        stats.firstActivatedAt = new Date().toISOString();
        save(stats);
      }
    },

    /** Reset all stats */
    reset: function () {
      save(JSON.parse(JSON.stringify(DEFAULT_STATS)));
    }
  };

  return api;

})();

if (typeof window !== 'undefined') {
  window.EnclaveShieldStats = EnclaveShieldStats;
}
