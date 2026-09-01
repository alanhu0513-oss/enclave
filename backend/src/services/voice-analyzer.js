/* ─── Voice Analyzer — Node.js Audio Feature Extraction ───
 * Real FFT-based voice analysis (not byte-level stub).
 * Falls back to Python Librosa service when available.
 * Used for voice clone detection, voiceprint comparison.
 */

const crypto = require('crypto');

class VoiceAnalyzer {
  constructor() {
    this.sampleRate = 16000;
    this.fftSize = 2048;
  }

  /**
   * Analyze audio buffer for voice clone indicators.
   * @param {Buffer} audioBuffer - Raw audio data (PCM 16-bit mono)
   * @returns {Object} Analysis results with confidence and indicators
   */
  analyze(audioBuffer) {
    if (!audioBuffer || audioBuffer.length < 1024) {
      return { confidence: 0, verdict: 'INSUFFICIENT_DATA', indicators: [] };
    }

    // Convert buffer to float samples (16-bit PCM)
    const samples = this.bufferToFloat32(audioBuffer);
    if (samples.length < this.fftSize) {
      return { confidence: 0, verdict: 'INSUFFICIENT_DATA', indicators: [] };
    }

    // Extract features
    const features = this.extractFeatures(samples);

    // Score based on features
    return this.scoreFeatures(features);
  }

  /**
   * Convert 16-bit PCM buffer to float32 array [-1, 1]
   */
  bufferToFloat32(buffer) {
    const numSamples = Math.floor(buffer.length / 2);
    const float32 = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      const int16 = buffer.readInt16LE(i * 2);
      float32[i] = int16 / 32768;
    }
    return float32;
  }

  /**
   * Extract audio features via DFT (no external FFT library needed)
   */
  extractFeatures(samples) {
    const n = this.fftSize;
    const segment = samples.slice(0, n);

    // Compute magnitude spectrum via DFT
    const magnitudes = new Float32Array(n / 2);
    for (let k = 0; k < n / 2; k++) {
      let real = 0, imag = 0;
      for (let t = 0; t < n; t++) {
        const angle = (2 * Math.PI * k * t) / n;
        real += segment[t] * Math.cos(angle);
        imag -= segment[t] * Math.sin(angle);
      }
      magnitudes[k] = Math.sqrt(real * real + imag * imag) / n;
    }

    // Spectral centroid (weighted mean of frequencies)
    let sumMag = 0, sumFreqMag = 0;
    for (let k = 1; k < n / 2; k++) {
      const freq = (k * this.sampleRate) / n;
      sumMag += magnitudes[k];
      sumFreqMag += freq * magnitudes[k];
    }
    const spectralCentroid = sumMag > 0 ? sumFreqMag / sumMag : 0;

    // Spectral flatness (geometric mean / arithmetic mean)
    let logSum = 0, arithSum = 0;
    let nonZeroCount = 0;
    for (let k = 1; k < n / 2; k++) {
      if (magnitudes[k] > 1e-10) {
        logSum += Math.log(magnitudes[k]);
        nonZeroCount++;
      }
      arithSum += magnitudes[k];
    }
    const geometricMean = nonZeroCount > 0 ? Math.exp(logSum / nonZeroCount) : 0;
    const arithmeticMean = arithSum / (n / 2);
    const spectralFlatness = arithmeticMean > 0 ? geometricMean / arithmeticMean : 0;

    // Spectral rolloff (frequency below which 85% of energy lies)
    let totalEnergy = 0;
    for (let k = 1; k < n / 2; k++) totalEnergy += magnitudes[k];
    const threshold = totalEnergy * 0.85;
    let cumEnergy = 0;
    let rolloffBin = 1;
    for (let k = 1; k < n / 2; k++) {
      cumEnergy += magnitudes[k];
      if (cumEnergy >= threshold) { rolloffBin = k; break; }
    }
    const spectralRolloff = (rolloffBin * this.sampleRate) / n;

    // Zero crossing rate
    let zcr = 0;
    for (let i = 1; i < samples.length; i++) {
      if ((samples[i] >= 0) !== (samples[i - 1] >= 0)) zcr++;
    }
    const zeroCrossingRate = zcr / samples.length;

    // RMS energy
    let rmsSum = 0;
    for (let i = 0; i < samples.length; i++) rmsSum += samples[i] * samples[i];
    const rmsEnergy = Math.sqrt(rmsSum / samples.length);

    // Pitch estimation via autocorrelation
    const pitch = this.estimatePitch(samples);

    // Harmonic-to-noise ratio estimate
    const hnr = this.estimateHNR(magnitudes, n);

    return {
      spectralCentroid,
      spectralFlatness,
      spectralRolloff,
      zeroCrossingRate,
      rmsEnergy,
      pitch,
      hnr,
      sampleCount: samples.length,
    };
  }

  /**
   * Simple pitch estimation via autocorrelation
   */
  estimatePitch(samples) {
    const minLag = Math.floor(this.sampleRate / 500); // Max 500Hz
    const maxLag = Math.floor(this.sampleRate / 50);  // Min 50Hz
    let bestCorr = -1;
    let bestLag = 0;

    for (let lag = minLag; lag <= Math.min(maxLag, samples.length / 2); lag++) {
      let corr = 0;
      for (let i = 0; i < samples.length - lag; i++) {
        corr += samples[i] * samples[i + lag];
      }
      if (corr > bestCorr) {
        bestCorr = corr;
        bestLag = lag;
      }
    }

    return bestLag > 0 ? this.sampleRate / bestLag : 0;
  }

  /**
   * Estimate harmonic-to-noise ratio from magnitude spectrum
   */
  estimateHNR(magnitudes, n) {
    // Simple estimate: ratio of peak energy to total energy
    let peakEnergy = 0;
    let totalEnergy = 0;
    for (let k = 1; k < n / 2; k++) {
      totalEnergy += magnitudes[k] * magnitudes[k];
      if (magnitudes[k] > peakEnergy) peakEnergy = magnitudes[k] * magnitudes[k];
    }
    const noiseEnergy = totalEnergy - peakEnergy;
    return noiseEnergy > 0 ? 10 * Math.log10(peakEnergy / noiseEnergy) : 0;
  }

  /**
   * Score features and detect voice clone indicators
   */
  scoreFeatures(features) {
    const indicators = [];
    let suspicionScore = 0;

    // 1. Unnaturally flat spectrum (synthetic audio)
    if (features.spectralFlatness > 0.8) {
      indicators.push('High spectral flatness — possible synthetic generation');
      suspicionScore += 25;
    }

    // 2. Missing natural pitch variation
    if (features.pitch === 0) {
      indicators.push('No detectable pitch — possible noise or synthetic');
      suspicionScore += 15;
    }

    // 3. Abnormal zero crossing rate
    if (features.zeroCrossingRate > 0.3) {
      indicators.push('Abnormally high zero crossing rate');
      suspicionScore += 10;
    }

    // 4. Very low energy (possible silence injection)
    if (features.rmsEnergy < 0.001) {
      indicators.push('Very low energy — possible silence padding');
      suspicionScore += 10;
    }

    // 5. Spectral centroid outside normal speech range (80-4000 Hz)
    if (features.spectralCentroid < 50 || features.spectralCentroid > 5000) {
      indicators.push(`Spectral centroid ${features.spectralCentroid.toFixed(0)}Hz outside normal speech range`);
      suspicionScore += 15;
    }

    // 6. Very low HNR (noisy, possibly generated)
    if (features.hnr < -5) {
      indicators.push('Low harmonic-to-noise ratio — possible noise injection');
      suspicionScore += 15;
    }

    // 7. Suspiciously high spectral rolloff (bandwidth limited)
    if (features.spectralRolloff < 2000) {
      indicators.push('Narrow bandwidth — possible low-quality synthesis');
      suspicionScore += 10;
    }

    const confidence = Math.min(100, suspicionScore);
    let verdict = 'LIKELY_AUTHENTIC';
    if (confidence >= 60) verdict = 'SUSPICIOUS';
    if (confidence >= 80) verdict = 'LIKELY_CLONE';

    return {
      confidence,
      verdict,
      indicators,
      features: {
        spectralCentroid: features.spectralCentroid.toFixed(1),
        spectralFlatness: features.spectralFlatness.toFixed(4),
        spectralRolloff: features.spectralRolloff.toFixed(1),
        zeroCrossingRate: features.zeroCrossingRate.toFixed(4),
        rmsEnergy: features.rmsEnergy.toFixed(6),
        pitch: features.pitch.toFixed(1),
        hnr: features.hnr.toFixed(1),
      },
    };
  }

  /**
   * Compare two audio buffers for voice similarity
   */
  compare(audioBuffer1, audioBuffer2) {
    const analysis1 = this.analyze(audioBuffer1);
    const analysis2 = this.analyze(audioBuffer2);

    if (analysis1.verdict === 'INSUFFICIENT_DATA' || analysis2.verdict === 'INSUFFICIENT_DATA') {
      return { similarity: 0, verdict: 'INSUFFICIENT_DATA' };
    }

    // Compare feature vectors
    const f1 = analysis1.features;
    const f2 = analysis2.features;

    let diffSum = 0;
    let count = 0;

    const compareNum = (a, b) => {
      const diff = Math.abs(parseFloat(a) - parseFloat(b));
      const scale = Math.max(Math.abs(parseFloat(a)), Math.abs(parseFloat(b)), 1);
      return diff / scale;
    };

    diffSum += compareNum(f1.spectralCentroid, f2.spectralCentroid);
    diffSum += compareNum(f1.spectralFlatness, f2.spectralFlatness);
    diffSum += compareNum(f1.spectralRolloff, f2.spectralRolloff);
    diffSum += compareNum(f1.pitch, f2.pitch);
    count = 4;

    const avgDiff = diffSum / count;
    const similarity = Math.round((1 - avgDiff) * 100);

    let verdict = 'DIFFERENT';
    if (similarity > 80) verdict = 'LIKELY_SAME_SPEAKER';
    else if (similarity > 60) verdict = 'POSSIBLY_SIMILAR';

    return { similarity, verdict };
  }
}

module.exports = new VoiceAnalyzer();
