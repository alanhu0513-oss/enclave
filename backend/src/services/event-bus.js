/* ─── Enclave Event Bus ───
 * Centralized EventEmitter for decoupling services.
 * All events flow through here — producers emit, consumers subscribe.
 * Enables WebSocket push, webhook dispatch, and job queue triggers
 * without tight coupling between services.
 */

const EventEmitter = require('eventemitter3');

const bus = new EventEmitter();

/* ─── Event Types ─── */
const Events = {
  // Alerts
  ALERT_CREATED: 'alert:created',
  ALERT_RESOLVED: 'alert:resolved',
  ALERT_DELETED: 'alert:deleted',

  // Scans
  SCAN_STARTED: 'scan:started',
  SCAN_PROGRESS: 'scan:progress',
  SCAN_COMPLETED: 'scan:completed',
  SCAN_FAILED: 'scan:failed',

  // Takedowns
  TAKEDOWN_INITIATED: 'takedown:initiated',
  TAKEDOWN_COMPLETED: 'takedown:completed',
  TAKEDOWN_ESCALATED: 'takedown:escalated',

  // Monitoring
  MONITOR_CYCLE_STARTED: 'monitor:cycle:started',
  MONITOR_CYCLE_COMPLETED: 'monitor:cycle:completed',
  MONITOR_SOURCE_HEALTH: 'monitor:source:health',

  // Crawler
  CRAWLER_THREAT_FOUND: 'crawler:threat:found',
  CRAWLER_SESSION_STARTED: 'crawler:session:started',
  CRAWLER_SESSION_STOPPED: 'crawler:session:stopped',

  // Notifications
  NOTIFICATION_CREATED: 'notification:created',

  // Community
  COMMUNITY_POST: 'community:post',
  COMMUNITY_THREAT_SHARED: 'community:threat:shared',

  // Billing / usage
  USAGE_LIMIT_REACHED: 'usage:limit:reached',
  SUBSCRIPTION_CHANGED: 'subscription:changed',

  // Passport
  PASSPORT_VERIFIED: 'passport:verified',
  PASSPORT_REVOKED: 'passport:revoked',

  // ML
  ML_MODEL_TRAINED: 'ml:model:trained',
  ML_MODEL_DEPLOYED: 'ml:model:deployed',
};

/* ─── Typed Emit Helpers ─── */

function emitAlertCreated(userId, alert) {
  bus.emit(Events.ALERT_CREATED, { userId, alert });
}

function emitAlertResolved(userId, alertId) {
  bus.emit(Events.ALERT_RESOLVED, { userId, alertId });
}

function emitScanStarted(userId, scanType, metadata = {}) {
  bus.emit(Events.SCAN_STARTED, { userId, scanType, ...metadata });
}

function emitScanProgress(userId, scanId, progress) {
  bus.emit(Events.SCAN_PROGRESS, { userId, scanId, ...progress });
}

function emitScanCompleted(userId, scanType, result) {
  bus.emit(Events.SCAN_COMPLETED, { userId, scanType, result });
}

function emitScanFailed(userId, scanType, error) {
  bus.emit(Events.SCAN_FAILED, { userId, scanType, error: error.message || String(error) });
}

function emitNotificationCreated(userId, notification) {
  bus.emit(Events.NOTIFICATION_CREATED, { userId, notification });
}

function emitTakedownInitiated(userId, takedown) {
  bus.emit(Events.TAKEDOWN_INITIATED, { userId, takedown });
}

function emitTakedownCompleted(userId, takedown) {
  bus.emit(Events.TAKEDOWN_COMPLETED, { userId, takedown });
}

function emitMonitorCycleCompleted(userId, result) {
  bus.emit(Events.MONITOR_CYCLE_COMPLETED, { userId, result });
}

module.exports = {
  bus,
  Events,
  emitAlertCreated,
  emitAlertResolved,
  emitScanStarted,
  emitScanProgress,
  emitScanCompleted,
  emitScanFailed,
  emitNotificationCreated,
  emitTakedownInitiated,
  emitTakedownCompleted,
  emitMonitorCycleCompleted,
};
