/**
 * Threat Intelligence Sharing Service
 * Allows users to share and consume community-sourced threat indicators.
 * Supports IoC (Indicators of Compromise) sharing: URLs, hashes, faceprints, domains.
 */

const { v4: uuidv4 } = require('uuid');
const { table } = require('../db/query');

const IOC_TYPES = {
  url: { label: 'Malicious URL', severity: 'high' },
  domain: { label: 'Suspicious Domain', severity: 'medium' },
  image_hash: { label: 'Known Deepfake Hash', severity: 'critical' },
  face_hash: { label: 'Stolen Face Embedding', severity: 'critical' },
  email: { label: 'Abuse Contact Email', severity: 'info' },
  keyword: { label: 'Known Nudifier Keyword', severity: 'high' },
  platform: { label: 'Abusive Platform', severity: 'high' }
};

const SEVERITY_WEIGHT = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

/**
 * Share a threat indicator with the community.
 */
async function shareIndicator(userId, data) {
  const { iocType, iocValue, sourceAlertId, severity, description, tags } = data;

  if (!iocType || !iocValue) return { success: false, reason: 'missing_fields' };
  if (!IOC_TYPES[iocType]) return { success: false, reason: 'invalid_ioc_type' };

  const id = uuidv4();
  const shares = await table('threat_shares');

  // Check for duplicate
  const existing = await shares.find({ ioc_type: iocType, ioc_value: iocValue });
  if (existing) {
    // Increment confidence and community votes
    await shares.update({ id: existing.id }, {
      confidence: Math.min(1, (existing.confidence || 0.5) + 0.1),
      community_votes: (existing.community_votes || 0) + 1,
      last_seen_at: new Date().toISOString()
    });
    return { success: true, id: existing.id, merged: true, communityVotes: (existing.community_votes || 0) + 1 };
  }

  await shares.insert({
    id,
    user_id: userId,
    ioc_type: iocType,
    ioc_value: iocValue,
    source_alert_id: sourceAlertId || null,
    severity: severity || IOC_TYPES[iocType].severity,
    confidence: 0.5,
    description: description || '',
    tags: JSON.stringify(tags || []),
    community_votes: 1,
    verified: false,
    last_seen_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  });

  return { success: true, id, merged: false };
}

/**
 * Get shared threat indicators with optional filters.
 */
async function getIndicators(filters) {
  filters = filters || {};
  const shares = await table('threat_shares');
  const all = await shares.all();
  let results = Array.isArray(all) ? all : all ? [all] : [];

  if (filters.iocType) {
    results = results.filter(r => r.ioc_type === filters.iocType);
  }
  if (filters.severity) {
    results = results.filter(r => r.severity === filters.severity);
  }
  if (filters.minConfidence) {
    results = results.filter(r => (r.confidence || 0) >= filters.minConfidence);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(r =>
      (r.ioc_value && r.ioc_value.toLowerCase().includes(q)) ||
      (r.description && r.description.toLowerCase().includes(q))
    );
  }

  // Sort by severity weight descending, then confidence
  results.sort((a, b) => {
    const wa = SEVERITY_WEIGHT[a.severity] || 0;
    const wb = SEVERITY_WEIGHT[b.severity] || 0;
    if (wb !== wa) return wb - wa;
    return (b.confidence || 0) - (a.confidence || 0);
  });

  // Paginate
  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const start = (page - 1) * limit;
  const paged = results.slice(start, start + limit);

  return {
    indicators: paged,
    total: results.length,
    page,
    limit,
    hasMore: start + limit < results.length
  };
}

/**
 * Vote on a threat indicator (confirm or dispute).
 */
async function voteIndicator(shareId, userId, vote) {
  if (!['confirm', 'dispute'].includes(vote)) return { success: false, reason: 'invalid_vote' };

  const shares = await table('threat_shares');
  const existing = await shares.find({ id: shareId });
  if (!existing) return { success: false, reason: 'not_found' };

  // Check if already voted
  const votes = await table('threat_votes');
  const existingVote = await votes.find({ share_id: shareId, user_id: userId });
  if (existingVote) {
    if (existingVote.vote === vote) return { success: true, alreadyVoted: true };
    // Change vote
    await votes.update({ id: existingVote.id }, { vote, updated_at: new Date().toISOString() });
  } else {
    await votes.insert({
      id: uuidv4(), share_id: shareId, user_id: userId, vote,
      created_at: new Date().toISOString()
    });
  }

  // Update confidence based on votes
  const allVotes = await votes.filter({ share_id: shareId });
  const voteList = Array.isArray(allVotes) ? allVotes : allVotes ? [allVotes] : [];
  const confirms = voteList.filter(v => v.vote === 'confirm').length;
  const disputes = voteList.filter(v => v.vote === 'dispute').length;
  const total = confirms + disputes;
  const confidence = total > 0 ? confirms / total : 0.5;

  await shares.update({ id: shareId }, {
    confidence: Math.round(confidence * 100) / 100,
    community_votes: total,
    updated_at: new Date().toISOString()
  });

  return { success: true, confidence, totalVotes: total };
}

/**
 * Check if a value matches any known threat indicators.
 */
async function checkAgainstThreatDB(value, type) {
  const shares = await table('threat_shares');
  const match = await shares.find({ ioc_value: value });
  if (!match) return { known: false };

  const isHighConfidence = (match.confidence || 0) >= 0.7;
  return {
    known: true,
    shareId: match.id,
    iocType: match.ioc_type,
    severity: match.severity,
    confidence: match.confidence,
    highConfidence: isHighConfidence,
    description: match.description,
    communityVotes: match.community_votes
  };
}

/**
 * Get community threat stats.
 */
async function getStats() {
  const shares = await table('threat_shares');
  const all = await shares.all();
  const indicators = Array.isArray(all) ? all : all ? [all] : [];

  const byType = {};
  const bySeverity = {};
  let totalConfidence = 0;

  indicators.forEach(ind => {
    byType[ind.ioc_type] = (byType[ind.ioc_type] || 0) + 1;
    bySeverity[ind.severity] = (bySeverity[ind.severity] || 0) + 1;
    totalConfidence += (ind.confidence || 0);
  });

  return {
    totalIndicators: indicators.length,
    byType,
    bySeverity,
    averageConfidence: indicators.length > 0 ? Math.round(totalConfidence / indicators.length * 100) / 100 : 0,
    verifiedCount: indicators.filter(i => i.verified).length
  };
}

module.exports = {
  IOC_TYPES,
  SEVERITY_WEIGHT,
  shareIndicator,
  getIndicators,
  voteIndicator,
  checkAgainstThreatDB,
  getStats
};
