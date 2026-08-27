const express = require('express');
const { success, error } = require('../utils/response');
const { authenticate } = require('../middleware/auth');
const reports = require('../services/reports');

const router = express.Router();

router.use(authenticate);

/** Report types catalog. */
router.get('/types', (req, res) => {
  return success(res, reports.REPORT_TYPES);
});

/** Generate a report (Phase 3.2). */
router.post('/generate', async (req, res) => {
  try {
    const result = await reports.generateReport(req.user.userId, req.body);
    if (!result.success) return error(res, result.reason || 'Unable to generate report', 400);
    return success(res, result, 'Report generated');
  } catch (e) {
    return error(res, e.message);
  }
});

/** Download a report's content (PDF/CSV payload). */
router.get('/:id/download', async (req, res) => {
  try {
    const report = await reports.getReport(req.user.userId, req.params.id);
    if (!report) return error(res, 'Report not found', 404);

    let body;
    let contentType;
    if (report.format === 'csv') {
      body = report.data.csv || 'No data';
      contentType = 'text/csv';
    } else {
      body = JSON.stringify(report.data, null, 2);
      contentType = 'application/json';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="enclave-${report.reportType}-${report.id}.${report.format === 'csv' ? 'csv' : 'json'}"`
    );
    return res.send(body);
  } catch (e) {
    return error(res, e.message);
  }
});

/** Schedule a recurring report (Phase 3.3). */
router.post('/schedule', async (req, res) => {
  try {
    const result = await reports.scheduleReport(req.user.userId, req.body);
    if (!result.success) return error(res, result.reason || 'Unable to schedule report', 400);
    return success(res, result, 'Report scheduled');
  } catch (e) {
    return error(res, e.message);
  }
});

/** List schedules. */
router.get('/schedules', async (req, res) => {
  try {
    const schedules = await reports.listSchedules(req.user.userId);
    return success(res, schedules, 'Schedules');
  } catch (e) {
    return error(res, e.message);
  }
});

/** List past reports. */
router.get('/', async (req, res) => {
  try {
    const list = await reports.listReports(req.user.userId, parseInt(req.query.limit) || 20);
    return success(res, list, 'Reports');
  } catch (e) {
    return error(res, e.message);
  }
});

/** Get a single report. */
router.get('/:id', async (req, res) => {
  try {
    const report = await reports.getReport(req.user.userId, req.params.id);
    if (!report) return error(res, 'Report not found', 404);
    return success(res, report, 'Report');
  } catch (e) {
    return error(res, e.message);
  }
});

module.exports = router;
