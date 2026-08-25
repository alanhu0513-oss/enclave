/**
 * Referral System
 * Unique referral links, tracking, and reward management.
 * Reward: 1 month of Pro for every 3 referrals.
 */

const { v4: uuidv4 } = require('uuid');
const { table } = require('../db/query');

function generateReferralCode(userId) {
  const hash = require('crypto').createHash('sha256').update(userId + 'enclave_ref').digest('hex');
  return hash.slice(0, 8).toUpperCase();
}

async function getOrCreateReferralCode(userId) {
  try {
    const referrals = await table('referrals');
    const existing = await referrals.find({ referrer_id: userId });
    if (existing) return existing.code;

    const code = generateReferralCode(userId);
    await referrals.insert({
      id: uuidv4(),
      referrer_id: userId,
      code,
      referral_count: 0,
      reward_claimed: 0,
      created_at: new Date().toISOString()
    });
    return code;
  } catch (e) {
    return generateReferralCode(userId);
  }
}

async function getReferralStats(userId) {
  try {
    const referrals = await table('referrals');
    const record = await referrals.find({ referrer_id: userId });
    if (!record) {
      return { code: null, referralCount: 0, rewardClaimed: 0, pendingRewards: 0 };
    }

    const pendingRewards = Math.floor(record.referral_count / 3) - record.reward_claimed;

    return {
      code: record.code,
      referralCount: record.referral_count || 0,
      rewardClaimed: record.reward_claimed || 0,
      pendingRewards: Math.max(0, pendingRewards),
      referralLink: `${process.env.APP_URL || 'http://localhost:4000'}/ref/${record.code}`
    };
  } catch (e) {
    return { code: null, referralCount: 0, rewardClaimed: 0, pendingRewards: 0 };
  }
}

async function applyReferral(code, newUserId) {
  try {
    const referrals = await table('referrals');
    const record = await referrals.find({ code });
    if (!record) return { success: false, reason: 'invalid_code' };
    if (record.referrer_id === newUserId) return { success: false, reason: 'self_referral' };

    // Check if already referred by someone
    const referred = await table('referral_redemptions');
    const existing = await referred.find({ referred_user_id: newUserId });
    if (existing) return { success: false, reason: 'already_referred' };

    const newCount = (record.referral_count || 0) + 1;
    await referrals.update({ id: record.id }, {
      referral_count: newCount,
      updated_at: new Date().toISOString()
    });

    await referred.insert({
      id: uuidv4(),
      referrer_id: record.referrer_id,
      referred_user_id: newUserId,
      code,
      created_at: new Date().toISOString()
    });

    const newRewards = Math.floor(newCount / 3);
    const pendingRewards = newRewards - record.reward_claimed;

    return {
      success: true,
      referrerId: record.referrer_id,
      referralCount: newCount,
      pendingRewards
    };
  } catch (e) {
    return { success: false, reason: 'error', message: e.message };
  }
}

async function claimReward(userId) {
  try {
    const referrals = await table('referrals');
    const record = await referrals.find({ referrer_id: userId });
    if (!record) return { success: false, reason: 'no_referral_code' };

    const totalRewards = Math.floor((record.referral_count || 0) / 3);
    if (totalRewards <= record.reward_claimed) {
      return { success: false, reason: 'no_pending_rewards' };
    }

    await referrals.update({ id: record.id }, {
      reward_claimed: totalRewards,
      updated_at: new Date().toISOString()
    });

    return {
      success: true,
      rewardType: 'pro_month',
      referralCount: record.referral_count,
      totalRewardsClaimed: totalRewards
    };
  } catch (e) {
    return { success: false, reason: 'error', message: e.message };
  }
}

module.exports = {
  getOrCreateReferralCode,
  getReferralStats,
  applyReferral,
  claimReward,
  generateReferralCode
};
