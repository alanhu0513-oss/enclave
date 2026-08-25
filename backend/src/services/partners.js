/**
 * Partner Program Service
 * Revenue sharing, co-marketing, referral partnerships, and integration marketplace.
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { table } = require('../db/query');

const PARTNER_TIERS = {
  starter: {
    name: 'Starter',
    revenueShare: 0.15,
    minReferrals: 0,
    features: ['Referral tracking', 'Basic analytics', '10% discount for referrals']
  },
  growth: {
    name: 'Growth',
    revenueShare: 0.25,
    minReferrals: 10,
    features: ['25% revenue share', 'Co-marketing materials', 'Priority support', '20% discount for referrals']
  },
  enterprise: {
    name: 'Enterprise',
    revenueShare: 0.35,
    minReferrals: 50,
    features: ['35% revenue share', 'Custom integrations', 'Dedicated account manager', 'White-label option', '30% discount for referrals']
  }
};

function generatePartnerCode(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
  const rand = crypto.randomBytes(3).toString('hex');
  return `P-${slug}-${rand}`;
}

/**
 * Apply to become a partner.
 */
async function applyPartner(userId, data) {
  const { companyName, website, description, expectedReferrals, integrationType } = data;
  if (!companyName) return { success: false, reason: 'company_name_required' };

  const partners = await table('partners');
  const existing = await partners.find({ user_id: userId });
  if (existing) return { success: false, reason: 'already_partner' };

  const code = generatePartnerCode(companyName);
  const id = uuidv4();

  await partners.insert({
    id,
    user_id: userId,
    company_name: companyName,
    website: website || null,
    description: description || '',
    partner_code: code,
    tier: 'starter',
    status: 'pending',
    total_referrals: 0,
    total_revenue: 0,
    revenue_owed: 0,
    revenue_paid: 0,
    expected_referrals: expectedReferrals || 0,
    integration_type: integrationType || null,
    created_at: new Date().toISOString()
  });

  return {
    success: true,
    id,
    code,
    tier: 'starter',
    status: 'pending',
    referralLink: `${process.env.APP_URL || 'http://localhost:4000'}/partner/${code}`
  };
}

/**
 * Get partner status.
 */
async function getPartnerStatus(userId) {
  const partners = await table('partners');
  const partner = await partners.find({ user_id: userId });
  if (!partner) return { isPartner: false };

  const tierInfo = PARTNER_TIERS[partner.tier] || PARTNER_TIERS.starter;
  return {
    isPartner: true,
    id: partner.id,
    company: partner.company_name,
    code: partner.partner_code,
    tier: partner.tier,
    tierInfo,
    status: partner.status,
    totalReferrals: partner.total_referrals || 0,
    totalRevenue: partner.total_revenue || 0,
    revenueOwed: partner.revenue_owed || 0,
    revenuePaid: partner.revenue_paid || 0,
    referralLink: `${process.env.APP_URL || 'http://localhost:4000'}/partner/${partner.partner_code}`,
    createdAt: partner.created_at
  };
}

/**
 * Record a partner referral conversion.
 */
async function recordConversion(partnerCode, referredUserId, amount) {
  const partners = await table('partners');
  const partner = await partners.find({ partner_code: partnerCode });
  if (!partner) return { success: false, reason: 'invalid_partner_code' };

  const newCount = (partner.total_referrals || 0) + 1;
  const newRevenue = (partner.total_revenue || 0) + (amount || 0);
  const tierInfo = PARTNER_TIERS[partner.tier] || PARTNER_TIERS.starter;
  const revenueOwed = partner.revenue_owed || 0 + (amount || 0) * tierInfo.revenueShare;

  // Auto-upgrade tier
  let newTier = partner.tier;
  if (newCount >= PARTNER_TIERS.enterprise.minReferrals) newTier = 'enterprise';
  else if (newCount >= PARTNER_TIERS.growth.minReferrals) newTier = 'growth';

  await partners.update({ id: partner.id }, {
    total_referrals: newCount,
    total_revenue: newRevenue,
    revenue_owed: revenueOwed,
    tier: newTier,
    updated_at: new Date().toISOString()
  });

  // Log the conversion
  try {
    const conversions = await table('partner_conversions');
    await conversions.insert({
      id: uuidv4(),
      partner_id: partner.id,
      referred_user_id: referredUserId,
      amount: amount || 0,
      revenue_share: (amount || 0) * tierInfo.revenueShare,
      created_at: new Date().toISOString()
    });
  } catch (_) {}

  return {
    success: true,
    conversionId: partnerCode,
    newReferralCount: newCount,
    tier: newTier,
    tierUpgraded: newTier !== partner.tier
  };
}

/**
 * Get partner earnings summary.
 */
async function getEarnings(userId) {
  const partners = await table('partners');
  const partner = await partners.find({ user_id: userId });
  if (!partner) return { earnings: null };

  const conversions = await table('partner_conversions');
  const allConv = await conversions.filter({ partner_id: partner.id });
  const convList = Array.isArray(allConv) ? allConv : allConv ? [allConv] : [];

  const last30Days = convList.filter(c => {
    const d = new Date(c.created_at);
    return (Date.now() - d.getTime()) < 30 * 24 * 60 * 60 * 1000;
  });

  return {
    totalRevenue: partner.total_revenue || 0,
    totalOwed: partner.revenue_owed || 0,
    totalPaid: partner.revenue_paid || 0,
    pendingPayout: (partner.revenue_owed || 0) - (partner.revenue_paid || 0),
    last30DaysRevenue: last30Days.reduce((sum, c) => sum + (c.amount || 0), 0),
    last30DaysConversions: last30Days.length,
    conversionHistory: convList.slice(-10).map(c => ({
      amount: c.amount,
      revenueShare: c.revenue_share,
      date: c.created_at
    }))
  };
}

/**
 * List all partners (admin).
 */
async function listAllPartners() {
  const partners = await table('partners');
  const all = await partners.all();
  return (Array.isArray(all) ? all : all ? [all] : []).map(p => ({
    id: p.id,
    company: p.company_name,
    code: p.partner_code,
    tier: p.tier,
    status: p.status,
    totalReferrals: p.total_referrals || 0,
    totalRevenue: p.total_revenue || 0,
    createdAt: p.created_at
  }));
}

module.exports = {
  PARTNER_TIERS,
  applyPartner,
  getPartnerStatus,
  recordConversion,
  getEarnings,
  listAllPartners,
  generatePartnerCode
};
