const express = require('express');
const { success, error } = require('../utils/response');
const { authenticate } = require('../middleware/auth');
const shield = require('../services/account-shield');

const router = express.Router();
router.use(authenticate);

/** List watched accounts */
router.get('/accounts', async (req, res) => {
  try {
    const accounts = await shield.listAccounts(req.user.userId);
    return success(res, { accounts });
  } catch (e) {
    return error(res, e.message || 'Failed to list accounts', 500);
  }
});

/** Add an account to the watchlist */
router.post('/accounts', async (req, res) => {
  try {
    const { site, identifier, label } = req.body;
    const account = await shield.addAccount(req.user.userId, { site, identifier, label });
    return success(res, { account }, 'Account added to shield', 201);
  } catch (e) {
    return error(res, e.message || 'Failed to add account', 400);
  }
});

/** Remove an account from the watchlist */
router.delete('/accounts/:id', async (req, res) => {
  try {
    const result = await shield.removeAccount(req.user.userId, req.params.id);
    return success(res, result, 'Account removed from shield');
  } catch (e) {
    return error(res, e.message || 'Failed to remove account', 400);
  }
});

/** Run a monitoring scan against an account */
router.post('/accounts/:id/scan', async (req, res) => {
  try {
    const result = await shield.scanAccount(req.user.userId, req.params.id);
    return success(res, result, 'Scan complete');
  } catch (e) {
    return error(res, e.message || 'Scan failed', 400);
  }
});

/** List breach findings (optionally per account) */
router.get('/breaches', async (req, res) => {
  try {
    const { accountId } = req.query;
    const breaches = await shield.listBreaches(req.user.userId, accountId);
    return success(res, { breaches });
  } catch (e) {
    return error(res, e.message || 'Failed to list breaches', 500);
  }
});

/** Mark a breach finding as resolved */
router.patch('/breaches/:id/resolve', async (req, res) => {
  try {
    const result = await shield.resolveBreach(req.user.userId, req.params.id);
    return success(res, result, 'Breach marked resolved');
  } catch (e) {
    return error(res, e.message || 'Failed to resolve breach', 400);
  }
});

/** Account shield summary (score, counts) */
router.get('/summary', async (req, res) => {
  try {
    const summary = await shield.accountSummary(req.user.userId);
    return success(res, summary);
  } catch (e) {
    return error(res, e.message || 'Failed to load summary', 500);
  }
});

/** Available account sites */
router.get('/sites', async (req, res) => {
  return success(res, { sites: shield.SITES });
});

module.exports = router;