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

/** Re-run the pwned-password sweep on all stored credentials */
router.post('/accounts/recheck', async (req, res) => {
  try {
    const result = await shield.recheckCredentials(req.user.userId);
    return success(res, { changed: result }, 'Credential re-sweep complete');
  } catch (e) {
    return error(res, e.message || 'Re-sweep failed', 400);
  }
});

/** Contain all breached / at-risk accounts with lockdown playbooks at once */
router.post('/accounts/contain-all', async (req, res) => {
  try {
    const result = await shield.containAll(req.user.userId);
    return success(res, result, 'Full containment initiated');
  } catch (e) {
    return error(res, e.message || 'Containment failed', 400);
  }
});

/** Barrier intelligence: exploitability scores + contamination graph */
router.get('/intelligence', async (req, res) => {
  try {
    const result = await shield.getIntelligence(req.user.userId);
    return success(res, result);
  } catch (e) {
    return error(res, e.message || 'Failed to load intelligence', 500);
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

/** Provider hardening guide (steps + links) for a site */
router.get('/sites/:site/guide', async (req, res) => {
  const guide = shield.getSiteGuide(req.params.site);
  return success(res, { site: req.params.site, guide });
});

/** Set / harden the credential for a watched account */
router.put('/accounts/:id/credential', async (req, res) => {
  try {
    const { password, mfaEnabled } = req.body;
    const result = await shield.setCredential(req.user.userId, req.params.id, { password, mfaEnabled });
    return success(res, result, 'Credential hardened and stored');
  } catch (e) {
    return error(res, e.message || 'Failed to store credential', 400);
  }
});

/** Credential defense status for a watched account */
router.get('/accounts/:id/credential', async (req, res) => {
  try {
    const result = await shield.getCredentialStatus(req.user.userId, req.params.id);
    return success(res, result);
  } catch (e) {
    return error(res, e.message || 'Failed to load credential status', 400);
  }
});

/** Escalate a suspected breach into a lockdown playbook */
router.post('/accounts/:id/lockdown', async (req, res) => {
  try {
    const result = await shield.lockdownAccount(req.user.userId, req.params.id);
    return success(res, result, 'Lockdown initiated — recovery steps sent');
  } catch (e) {
    return error(res, e.message || 'Failed to initiate lockdown', 400);
  }
});

/** List lockdown playbooks for the user */
router.get('/lockdowns', async (req, res) => {
  try {
    const lockdowns = await shield.listLockdowns(req.user.userId);
    return success(res, { lockdowns });
  } catch (e) {
    return error(res, e.message || 'Failed to list lockdowns', 500);
  }
});

/** Mark a lockdown playbook as completed */
router.patch('/lockdowns/:id/complete', async (req, res) => {
  try {
    const result = await shield.completeLockdown(req.user.userId, req.params.id);
    return success(res, result, 'Lockdown marked complete');
  } catch (e) {
    return error(res, e.message || 'Failed to complete lockdown', 400);
  }
});

module.exports = router;