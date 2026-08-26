/* ─── Shared verdict normalization for AI detection clients ─── */

function normalizeVerdict(score) {
  if (score >= 60) return 'LIKELY_SYNTHETIC';
  if (score >= 35) return 'SUSPICIOUS';
  return 'LIKELY_NATURAL';
}

function clampConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n * 10) / 10));
}

module.exports = { normalizeVerdict, clampConfidence };
