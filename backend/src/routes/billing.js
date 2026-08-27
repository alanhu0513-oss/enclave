const express = require('express');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');
const billing = require('../services/billing');
const usage = require('../services/usage');
const referrals = require('../services/referrals');
const digest = require('../services/digest');

const router = express.Router();

// ─── Billing / Subscription ───

router.get('/subscription', authenticate, async (req, res) => {
  try {
    const status = await billing.getSubscriptionStatus(req.user.userId);
    const tierInfo = billing.getTierInfo(status.tier);
    const usageSummary = await usage.getUsageSummary(req.user.userId, status.tier);
    return success(res, { subscription: { ...status, tierInfo }, usage: usageSummary });
  } catch (e) {
    return error(res, e.message);
  }
});

router.get('/tiers', (req, res) => {
  return success(res, { tiers: billing.TIERS });
});

router.post('/checkout', authenticate, async (req, res) => {
  try {
    const { tier, successUrl, cancelUrl } = req.body;
    if (!tier || !billing.TIERS[tier]) return error(res, 'Invalid tier', 400);
    if (tier === 'free') return error(res, 'Free tier requires no checkout', 400);

    const users = await (await require('../db/query').table('users'));
    const user = await users.find({ id: req.user.userId });

    const session = await billing.createCheckoutSession(
      req.user.userId, tier, user.email, successUrl, cancelUrl
    );
    return success(res, session);
  } catch (e) {
    return error(res, e.message);
  }
});

router.post('/portal', authenticate, async (req, res) => {
  try {
    const { returnUrl } = req.body;
    const session = await billing.createPortalSession(req.user.userId, returnUrl);
    return success(res, session);
  } catch (e) {
    return error(res, e.message);
  }
});

// ─── Usage ───

router.get('/usage', authenticate, async (req, res) => {
  try {
    const status = await billing.getSubscriptionStatus(req.user.userId);
    const summary = await usage.getUsageSummary(req.user.userId, status.tier);
    return success(res, summary);
  } catch (e) {
    return error(res, e.message);
  }
});

router.get('/usage/history', authenticate, async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 12;
    const history = await usage.getUsageHistory(req.user.userId, months);
    return success(res, { history });
  } catch (e) {
    return error(res, e.message);
  }
});

router.post('/usage/check', authenticate, async (req, res) => {
  try {
    const { type } = req.body;
    if (!type) return error(res, 'Usage type required', 400);
    const status = await billing.getSubscriptionStatus(req.user.userId);
    const check = await usage.checkLimit(req.user.userId, type, status.tier);
    return success(res, check);
  } catch (e) {
    return error(res, e.message);
  }
});

// ─── Referrals ───

router.get('/referrals', authenticate, async (req, res) => {
  try {
    const stats = await referrals.getReferralStats(req.user.userId);
    return success(res, stats);
  } catch (e) {
    return error(res, e.message);
  }
});

router.post('/referrals/claim', authenticate, async (req, res) => {
  try {
    const result = await referrals.claimReward(req.user.userId);
    return success(res, result);
  } catch (e) {
    return error(res, e.message);
  }
});

router.get('/ref/:code', async (req, res) => {
  try {
    const { code } = req.params;
    // Redirect to app with referral code
    const appUrl = process.env.APP_URL || 'http://localhost:4000';
    res.redirect(`${appUrl}/?ref=${code}`);
  } catch (e) {
    return error(res, e.message);
  }
});

router.post('/referrals/apply', authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return error(res, 'Referral code required', 400);
    const result = await referrals.applyReferral(code, req.user.userId);
    return success(res, result);
  } catch (e) {
    return error(res, e.message);
  }
});

// ─── Digest / Reports ───

router.post('/digest/send', authenticate, async (req, res) => {
  try {
    const { period } = req.body;
    const result = await digest.sendDigest(req.user.userId, period || 'weekly');
    return success(res, result);
  } catch (e) {
    return error(res, e.message);
  }
});

router.post('/digest/send-all', authenticate, async (req, res) => {
  try {
    if (!req.user.isAdmin) return error(res, 'Admin access required', 403);
    const { period } = req.body;
    const result = await digest.sendDigestToAllUsers(period || 'weekly');
    return success(res, result);
  } catch (e) {
    return error(res, e.message);
  }
});

// Raw webhook handler for mounting in index.js (before express.json)
const webhookRaw = async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    let event;

    if (!billing.useMock && sig) {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
      } catch (e) {
        return error(res, `Webhook signature verification failed: ${e.message}`, 400);
      }
    } else {
      event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }

    const result = await billing.handleWebhook(event);
    return success(res, result);
  } catch (e) {
    return error(res, e.message);
  }
};

module.exports = router;
module.exports.webhookRaw = webhookRaw;
