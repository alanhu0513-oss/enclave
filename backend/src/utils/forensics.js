/**
 * ForensicReasoning Engine
 * Maps ML pipeline results to human-readable forensic reasons.
 */

function getForensicReason(result) {
  if (!result || result.error) return "Analysis unavailable";

  const verdict = result.final_verdict || result.verdict;
  const confidence = result.confidence;
  const details = result.details || {};
  const heuristic = result.heuristic || {};
  const identity = result.identity || {};
  const fusion = details.fusion || {};

  if (verdict === 'LIKELY_NATURAL' || verdict === 'SUSPICIOUS' && (confidence || 0) < 40) {
    return "No manipulation detected.";
  }

  const reasons = [];

  // 1. Identity context (never suppresses fake signal)
  if (identity.match === true) {
    reasons.push(`Identified as an enrolled profile match (similarity ${Math.round((identity.similarity || 0) * 100)}%).`);
  } else if (identity.enrolled === true && identity.match === false) {
    reasons.push("Face does not match the enrolled profile.");
  }

  // 2. Fusion signal (the authoritative synthesis verdict)
  const fusionScore = fusion.score;
  if (fusionScore != null) {
    if (fusionScore > 0.9) reasons.push(`Strong synthesis signal: fused model score ${(fusionScore * 100).toFixed(1)}%.`);
    else if (fusionScore > 0.6) reasons.push(`Moderate synthesis signal: fused model score ${(fusionScore * 100).toFixed(1)}%.`);
  }

  // 3. Per-model evidence
  const det = details.detectors || {};
  if (det.xceptionnet) {
    const p = det.xceptionnet.fake_probability;
    if (p >= 0.5) reasons.push(`XceptionNet cross-band artifact score ${(p * 100).toFixed(1)}%.`);
    else reasons.push(`XceptionNet cross-band artifacts within normal range (${(p * 100).toFixed(1)}%).`);
  }
  if (det.cnndetection) {
    const p = det.cnndetection.fake_probability;
    if (p >= 0.5) reasons.push(`CNN forensics detector scored ${(p * 100).toFixed(1)}% — manipulation residues present.`);
  }

  // 4. Heuristic / spectral context
  if (heuristic.hf_noise != null) {
    if (heuristic.hf_noise < 0.03) reasons.push("Abnormally low high-frequency noise — trait of generative upscaling.");
    else if (heuristic.hf_noise > 0.25) reasons.push("Elevated high-frequency noise inconsistent with camera capture.");
  }

  if (reasons.length > 0) return reasons.join(" ");

  return `Detected ${String(verdict || 'UNKNOWN').replace(/_/g, ' ').toLowerCase()} at ${confidence}% confidence via ${result.provider || 'forensic ensemble'}.`;
}

module.exports = { getForensicReason };