const express = require('express');
const { success, error } = require('../utils/response');
const { authenticate } = require('../middleware/auth');
const referrals = require('../services/referrals');

const router = express.Router();

router.use(authenticate);

/** Get or create the user's referral code (Phase 6.3). */
router.get('/code', async (req, res) => {
  try {
    const code = await referrals.getOrCreateReferralCode(req.user.userId);
    const stats = await referrals.getReferralStats(req.user.userId);
    return success(res, { code, ...stats }, 'Referral code');
  } catch (e) {
    return error(res, e.message);
  }
});

/** Referral stats for dashboard. */
router.get('/stats', async (req, res) => {
  try {
    const stats = await referrals.getReferralStats(req.user.userId);
    return success(res, stats, 'Referral stats');
  } catch (e) {
    return error(res, e.message);
  }
});

/** Apply a referral code (used at signup / account linking). */
router.post('/apply', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return error(res, 'Referral code required', 400);
    const result = await referrals.applyReferral(code, req.user.userId);
    if (!result.success) return error(res, result.reason || 'Unable to apply referral', 400);
    return success(res, result, 'Referral applied');
  } catch (e) {
    return error(res, e.message);
  }
});

/** Claim pending reward (1 month Pro per 3 referrals). */
router.post('/claim', async (req, res) => {
  try {
    const result = await referrals.claimReward(req.user.userId);
    if (!result.success) return error(res, result.reason || 'Unable to claim reward', 400);
    return success(res, result, 'Reward claimed');
  } catch (e) {
    return error(res, e.message);
  }
});

module.exports = router;
