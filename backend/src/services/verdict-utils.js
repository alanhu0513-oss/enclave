/* ─── Shared verdict normalization and ensemble scoring ─── */

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

/* Provider reliability weights (higher = more trusted) */
const PROVIDER_WEIGHTS = {
  'cerebras': 0.85,
  'groq': 0.85,
  'openrouter': 0.80,
  'mistral': 0.80,
  'siliconflow': 0.75,
  'github-models': 0.80,
  'gemini': 0.90,
  'anthropic': 0.92,
  'xceptionnet': 0.88,
  'local-heuristic': 0.50,
};

/**
 * Weighted ensemble: combine multiple detection results into a single score.
 * @param {Array<{confidence: number, provider: string}>} results
 * @returns {{confidence: number, verdict: string, consensus: string, providers: string[]}}
 */
function weightedEnsemble(results) {
  if (!results || results.length === 0) {
    return { confidence: 0, verdict: 'UNKNOWN', consensus: 'no_data', providers: [] };
  }

  if (results.length === 1) {
    const r = results[0];
    return {
      confidence: r.confidence,
      verdict: normalizeVerdict(r.confidence),
      consensus: 'single_provider',
      providers: [r.provider],
    };
  }

  let totalWeight = 0;
  let weightedSum = 0;
  const providers = [];

  for (const r of results) {
    const weight = PROVIDER_WEIGHTS[r.provider] || 0.70;
    weightedSum += r.confidence * weight;
    totalWeight += weight;
    providers.push(r.provider);
  }

  const ensembleConfidence = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const clamped = clampConfidence(ensembleConfidence);

  // Consensus analysis
  const scores = results.map(r => r.confidence);
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const spread = max - min;

  let consensus = 'strong';
  if (spread > 40) consensus = 'weak';
  else if (spread > 20) consensus = 'moderate';

  return {
    confidence: clamped,
    verdict: normalizeVerdict(clamped),
    consensus,
    providers,
    spread,
  };
}

module.exports = { normalizeVerdict, clampConfidence, weightedEnsemble, PROVIDER_WEIGHTS };
