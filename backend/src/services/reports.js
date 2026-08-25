/**
 * Custom Reports Service
 * PDF/CSV export, scheduled reports, and analytics dashboards.
 */

const { v4: uuidv4 } = require('uuid');
const { table } = require('../db/query');

const REPORT_TYPES = {
  threat_summary: { name: 'Threat Summary', description: 'Overview of detected threats', format: 'pdf' },
  usage_analytics: { name: 'Usage Analytics', description: 'Scan and detection statistics', format: 'pdf' },
  compliance: { name: 'Compliance Report', description: 'GDPR/CCPA compliance status', format: 'pdf' },
  incident: { name: 'Incident Report', description: 'Detailed incident analysis', format: 'pdf' },
  monthly_executive: { name: 'Monthly Executive', description: 'Executive summary for leadership', format: 'pdf' },
  raw_data: { name: 'Raw Data Export', description: 'All data in CSV format', format: 'csv' }
};

/**
 * Generate a report.
 */
async function generateReport(userId, data) {
  const { type, dateRange, filters } = data;
  if (!type || !REPORT_TYPES[type]) return { success: false, reason: 'invalid_report_type' };

  const reportConfig = REPORT_TYPES[type];
  const id = uuidv4();

  // Gather data based on report type
  let reportData = {};

  try {
    const alerts = await table('alerts');
    const allAlerts = await alerts.filter({ user_id: userId });
    const alertList = Array.isArray(allAlerts) ? allAlerts : allAlerts ? [allAlerts] : [];

    if (dateRange) {
      const start = new Date(dateRange.start || Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = new Date(dateRange.end || Date.now());
      reportData.alerts = alertList.filter(a => {
        const d = new Date(a.created_at);
        return d >= start && d <= end;
      });
    } else {
      reportData.alerts = alertList;
    }

    reportData.totalAlerts = reportData.alerts.length;
    reportData.threatsFound = reportData.alerts.filter(a => a.confidence > 0.6).length;
    reportData.uniqueSources = [...new Set(reportData.alerts.map(a => a.source_url))].length;
    reportData.mediaTypes = {};
    reportData.alerts.forEach(a => {
      reportData.mediaTypes[a.media_type] = (reportData.mediaTypes[a.media_type] || 0) + 1;
    });

    // Severity breakdown
    reportData.severityBreakdown = { high: 0, medium: 0, low: 0 };
    reportData.alerts.forEach(a => {
      if (a.confidence > 0.8) reportData.severityBreakdown.high++;
      else if (a.confidence > 0.5) reportData.severityBreakdown.medium++;
      else reportData.severityBreakdown.low++;
    });

  } catch (e) {
    reportData.alerts = [];
    reportData.totalAlerts = 0;
  }

  // Generate CSV content
  if (reportConfig.format === 'csv') {
    reportData.csv = generateCSV(reportData.alerts);
  }

  // Store report record
  try {
    const reports = await table('reports');
    await reports.insert({
      id,
      user_id: userId,
      report_type: type,
      date_range: JSON.stringify(dateRange || {}),
      data_json: JSON.stringify(reportData),
      format: reportConfig.format,
      status: 'completed',
      created_at: new Date().toISOString()
    });
  } catch (_) {}

  return {
    success: true,
    id,
    type,
    format: reportConfig.format,
    data: reportData,
    generatedAt: new Date().toISOString()
  };
}

function generateCSV(alerts) {
  if (!alerts || alerts.length === 0) return 'No data';
  const headers = ['ID', 'Source URL', 'Confidence', 'Status', 'Media Type', 'Created At'];
  const rows = alerts.map(a => [
    a.id, a.source_url, (a.confidence * 100).toFixed(1) + '%',
    a.status, a.media_type, a.created_at
  ]);
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Schedule a recurring report.
 */
async function scheduleReport(userId, data) {
  const { type, frequency, time, dateRange, filters } = data;
  if (!type || !REPORT_TYPES[type]) return { success: false, reason: 'invalid_report_type' };
  if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
    return { success: false, reason: 'invalid_frequency' };
  }

  const id = uuidv4();
  const schedules = await table('report_schedules');

  await schedules.insert({
    id,
    user_id: userId,
    report_type: type,
    frequency,
    time: time || '09:00',
    date_range: JSON.stringify(dateRange || {}),
    filters: JSON.stringify(filters || {}),
    enabled: true,
    last_run: null,
    next_run: calculateNextRun(frequency, time),
    created_at: new Date().toISOString()
  });

  return { success: true, id, frequency, nextRun: calculateNextRun(frequency, time) };
}

function calculateNextRun(frequency, time) {
  const now = new Date();
  const [hours, minutes] = (time || '09:00').split(':').map(Number);
  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);

  if (frequency === 'daily') {
    if (next <= now) next.setDate(next.getDate() + 1);
  } else if (frequency === 'weekly') {
    next.setDate(next.getDate() + (7 - next.getDay()));
    if (next <= now) next.setDate(next.getDate() + 7);
  } else if (frequency === 'monthly') {
    next.setMonth(next.getMonth() + 1, 1);
    if (next <= now) next.setMonth(next.getMonth() + 1, 1);
  }

  return next.toISOString();
}

/**
 * List scheduled reports.
 */
async function listSchedules(userId) {
  const schedules = await table('report_schedules');
  const all = await schedules.filter({ user_id: userId });
  return (Array.isArray(all) ? all : all ? [all] : []).map(s => ({
    id: s.id,
    reportType: s.report_type,
    frequency: s.frequency,
    time: s.time,
    enabled: s.enabled,
    lastRun: s.last_run,
    nextRun: s.next_run,
    createdAt: s.created_at
  }));
}

/**
 * List past reports.
 */
async function listReports(userId, limit) {
  const reports = await table('reports');
  const all = await reports.filter({ user_id: userId });
  const list = (Array.isArray(all) ? all : all ? [all] : []).slice(-(limit || 20));
  return list.map(r => ({
    id: r.id,
    reportType: r.report_type,
    format: r.format,
    status: r.status,
    createdAt: r.created_at
  }));
}

/**
 * Get report by ID.
 */
async function getReport(userId, reportId) {
  const reports = await table('reports');
  const report = await reports.find({ id: reportId, user_id: userId });
  if (!report) return null;
  return {
    id: report.id,
    reportType: report.report_type,
    format: report.format,
    status: report.status,
    data: JSON.parse(report.data_json || '{}'),
    createdAt: report.created_at
  };
}

module.exports = {
  REPORT_TYPES,
  generateReport,
  scheduleReport,
  listSchedules,
  listReports,
  getReport
};
