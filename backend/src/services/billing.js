/**
 * Stripe Billing Service
 * Handles subscription management, checkout sessions, and webhooks.
 * In development, uses a mock Stripe mode (no real charges).
 * Set STRIPE_SECRET_KEY to use real Stripe.
 */

const { v4: uuidv4 } = require('uuid');

const TABLES = { table: null };

const TIERS = {
  free: {
    id: 'free', name: 'Free', price: 0,
    scanLimit: 3, alertLimit: 10, takedownLimit: 0,
    deepScanLimit: 1, crawlerAccess: false, apiAccess: false,
    // Shield flagship — the Security Shield is the core product. Every tier
    // carries a shield; higher tiers widen the wall and add the intelligence
    // layers that turn monitoring into a barrier.
    shield: {
      watchedAccounts: 3,
      lockdownsPerMonth: 1,
      breachCorpus: true,
      credentialVault: true,
      stealerLogs: false,
      autoSweep: false,
      blastRadius: false,
      containAll: false,
    },
    features: [
      'Watch 3 accounts (pwned + breach check)',
      'Encrypted credential vault',
      '1 lockdown playbook',
      '3 deepfake scans/month',
      'Email alerts',
    ]
  },
  pro: {
    id: 'pro', name: 'Pro', price: 999,
    scanLimit: 50, alertLimit: 500, takedownLimit: 2,
    deepScanLimit: 20, crawlerAccess: true, apiAccess: false,
    shield: {
      watchedAccounts: 25,
      lockdownsPerMonth: 10,
      breachCorpus: true,
      credentialVault: true,
      stealerLogs: true,
      autoSweep: true,
      blastRadius: true,
      containAll: true,
    },
    features: [
      'Watch 25 accounts across the breach + stealer corpus',
      '6-hour auto-sweep — 24/7 barrier coverage',
      'Stealer-log intelligence (infostealer malware)',
      'Blast-radius contamination mapping',
      'Contain-all one-tap lockdowns',
      '10 lockdown playbooks/mo',
      '50 deepfake scans + web/paste monitoring',
    ]
  },
  shield: {
    id: 'shield', name: 'Shield', price: 1999,
    scanLimit: 200, alertLimit: -1, takedownLimit: 10,
    deepScanLimit: -1, crawlerAccess: true, apiAccess: false,
    shield: {
      watchedAccounts: 250,
      lockdownsPerMonth: -1,
      breachCorpus: true,
      credentialVault: true,
      stealerLogs: true,
      autoSweep: true,
      blastRadius: true,
      containAll: true,
    },
    features: [
      'Watch 250 accounts — the full barrier',
      '6-hour auto-sweep across breach + stealer corpora',
      'Unlimited lockdown playbooks + contain-all',
      'Exploitability scoring per account',
      'Dark web monitoring (Ahmia)',
      '10 takedowns/mo with filing helpers',
      '200 scans/month + voice authentication',
    ]
  },
  family: {
    id: 'family', name: 'Family', price: 2999,
    scanLimit: 500, alertLimit: -1, takedownLimit: 20,
    deepScanLimit: -1, crawlerAccess: true, apiAccess: false,
    maxMembers: 5,
    shield: {
      watchedAccounts: 1000,
      lockdownsPerMonth: -1,
      breachCorpus: true,
      credentialVault: true,
      stealerLogs: true,
      autoSweep: true,
      blastRadius: true,
      containAll: true,
    },
    features: [
      'Watch 1,000 accounts across 5 members',
      'Everything in Shield, per member',
      'Family dashboard + per-member alerts',
      'Dark web + forums + Telegram monitoring',
      '20 takedowns/mo',
    ]
  },
  business: {
    id: 'business', name: 'Business', price: 4999,
    scanLimit: -1, alertLimit: -1, takedownLimit: -1,
    deepScanLimit: -1, crawlerAccess: true, apiAccess: true,
    shield: {
      watchedAccounts: -1,
      lockdownsPerMonth: -1,
      breachCorpus: true,
      credentialVault: true,
      stealerLogs: true,
      autoSweep: true,
      blastRadius: true,
      containAll: true,
    },
    features: [
      'Unlimited watched accounts, 10 seats',
      '15-min real-time sweep + social monitoring',
      'Unlimited lockdowns + contain-all',
      'Unlimited takedowns',
      'API access (10k calls/mo) + audit logs + SSO',
    ]
  }
};

const STRIPE_PRICES = {
  detection_only: process.env.STRIPE_PRICE_DETECTION_ONLY || 'price_detection_only_monthly',
  pro: process.env.STRIPE_PRICE_PRO || 'price_pro_monthly',
  shield: process.env.STRIPE_PRICE_SHIELD || 'price_shield_monthly',
  family: process.env.STRIPE_PRICE_FAMILY || 'price_family_monthly',
  business: process.env.STRIPE_PRICE_BUSINESS || 'price_business_monthly'
};

let stripe = null;
let useMock = true;

function init() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (key && key.startsWith('sk_')) {
    try {
      stripe = require('stripe')(key);
      useMock = false;
      console.log('[BILLING] Stripe live mode');
    } catch (e) {
      console.warn('[BILLING] Stripe module not found, using mock mode');
      useMock = true;
    }
  } else {
    console.log('[BILLING] Mock mode (no STRIPE_SECRET_KEY)');
    useMock = true;
  }
}

// Mock subscription store for development
const mockSubscriptions = new Map();

function getTier(userId) {
  const sub = mockSubscriptions.get(userId);
  if (sub && sub.status === 'active') {
    return sub.tier || 'free';
  }
  return 'free';
}

async function createCheckoutSession(userId, tier, email, successUrl, cancelUrl) {
  if (useMock) {
    const sessionId = 'mock_sess_' + uuidv4();
    mockSubscriptions.set(userId, {
      tier, status: 'active', sessionId,
      createdAt: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });
    return {
      sessionId,
      url: successUrl || '#mock-checkout',
      mock: true
    };
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [{ price: STRIPE_PRICES[tier], quantity: 1 }],
      success_url: successUrl || `${process.env.APP_URL || 'http://localhost:4000'}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.APP_URL || 'http://localhost:4000'}/billing/cancel`,
      metadata: { userId, tier }
    });
    return { sessionId: session.id, url: session.url };
  } catch (e) {
    throw new Error('Failed to create checkout session: ' + e.message);
  }
}

async function createPortalSession(userId, returnUrl) {
  if (useMock) {
    return { url: returnUrl || '#mock-portal', mock: true };
  }

  try {
    const users = await (await require('../db/query').table('users'));
    const user = await users.find({ id: userId });
    if (!user || !user.stripe_customer_id) {
      throw new Error('No Stripe customer found');
    }

    const session = await stripe.billingPortal.create({
      customer: user.stripe_customer_id,
      return_url: returnUrl || `${process.env.APP_URL || 'http://localhost:4000'}/dashboard`
    });
    return { url: session.url };
  } catch (e) {
    throw new Error('Failed to create portal session: ' + e.message);
  }
}

async function handleWebhook(event) {
  if (useMock) return { handled: false };

  try {
    const { type, data } = event;
    const obj = data.object;

    switch (type) {
      case 'checkout.session.completed': {
        const { userId, tier } = obj.metadata;
        const users = await (await require('../db/query').table('users'));
        await users.update({ id: userId }, {
          subscription_tier: tier,
          stripe_customer_id: obj.customer,
          stripe_subscription_id: obj.subscription,
          subscription_status: 'active',
          subscription_current_period_end: new Date(obj.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString()
        });
        return { handled: true, action: 'activated', tier };
      }

      case 'invoice.paid': {
        const users = await (await require('../db/query').table('users'));
        const result = await users.find({ stripe_subscription_id: obj.subscription });
        if (result) {
          await users.update({ id: result.id }, {
            subscription_status: 'active',
            subscription_current_period_end: new Date(obj.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString()
          });
        }
        return { handled: true, action: 'renewed' };
      }

      case 'customer.subscription.deleted': {
        const users = await (await require('../db/query').table('users'));
        const result = await users.find({ stripe_subscription_id: obj.id });
        if (result) {
          await users.update({ id: result.id }, {
            subscription_tier: 'free',
            subscription_status: 'cancelled',
            stripe_subscription_id: null,
            updated_at: new Date().toISOString()
          });
        }
        return { handled: true, action: 'cancelled' };
      }

      default:
        return { handled: false, reason: 'unhandled_event_type' };
    }
  } catch (e) {
    return { handled: false, error: e.message };
  }
}

async function getSubscriptionStatus(userId) {
  const users = await (await require('../db/query').table('users'));
  const user = await users.find({ id: userId });
  if (!user) return { tier: 'free', status: 'none' };

  // Mock mode
  if (useMock) {
    const sub = mockSubscriptions.get(userId);
    if (sub) {
      return {
        tier: sub.tier,
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd,
        mock: true
      };
    }
    return { tier: 'free', status: 'active', tierInfo: TIERS.free };
  }

  // Live mode
  if (user.subscription_status === 'active' && user.stripe_subscription_id) {
    try {
      const sub = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
      return {
        tier: user.subscription_tier || 'free',
        status: sub.status,
        currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: sub.cancel_at_period_end
      };
    } catch (e) {
      return { tier: 'free', status: 'error', error: e.message };
    }
  }

  return { tier: user.subscription_tier || 'free', status: user.subscription_status || 'none' };
}

function getTierInfo(tier) {
  const t = TIERS[tier] || TIERS.free;
  return {
    ...t,
    limits: {
      scansPerMonth: t.scanLimit,
      takedownsPerMonth: t.takedownLimit,
      deepScansPerMonth: t.deepScanLimit,
    },
  };
}

function getShieldLimits(tier) {
  const t = TIERS[tier] || TIERS.free;
  return {
    watchedAccounts: t.shield?.watchedAccounts ?? 0,
    lockdownsPerMonth: t.shield?.lockdownsPerMonth ?? 0,
    stealerLogs: !!t.shield?.stealerLogs,
    autoSweep: !!t.shield?.autoSweep,
    blastRadius: !!t.shield?.blastRadius,
    containAll: !!t.shield?.containAll,
    breachCorpus: !!t.shield?.breachCorpus,
    credentialVault: !!t.shield?.credentialVault,
  };
}

function getTierLimits(tier) {
  const t = TIERS[tier] || TIERS.free;
  return {
    scanLimit: t.scanLimit,
    alertLimit: t.alertLimit,
    takedownLimit: t.takedownLimit,
    deepScanLimit: t.deepScanLimit,
    crawlerAccess: t.crawlerAccess,
    apiAccess: t.apiAccess,
    shield: getShieldLimits(tier),
  };
}

module.exports = {
  init,
  get useMock() { return useMock; },
  TIERS,
  createCheckoutSession,
  createPortalSession,
  handleWebhook,
  getSubscriptionStatus,
  getTierInfo,
  getShieldLimits,
  getTierLimits,
  getTier
};
