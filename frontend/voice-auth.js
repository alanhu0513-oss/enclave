/**
 * Voice Authentication Module
 * Real-time voice authentication: enrollment and verification using Web Audio API.
 * Extracts MFCC-like features from microphone input and compares against enrolled voiceprint.
 * Pure JavaScript — no dependencies.
 */

var EnclaveVoiceAuth = (function () {

  var AUDIO_CONTEXT = null;
  var SAMPLE_RATE = 16000;
  var FFT_SIZE = 1024;
  var NUM_MFCC = 13;
  var NUM_FILTERS = 26;
  var ENROLLMENT_DURATION = 3000; // 3 seconds of audio for enrollment
  var VERIFICATION_DURATION = 2000; // 2 seconds for verification

  function getContext() {
    if (!AUDIO_CONTEXT) {
      AUDIO_CONTEXT = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SAMPLE_RATE });
    }
    return AUDIO_CONTEXT;
  }

  /**
   * Compute Mel-frequency cepstral coefficients (MFCCs) from audio samples.
   * Simplified MFCC computation: FFT → Mel filterbank → DCT
   * @param {Float32Array} samples - Raw audio samples
   * @param {number} sampleRate
   * @returns {Array} Array of MFCC feature vectors
   */
  function computeMFCC(samples, sampleRate) {
    var frameSize = 512;
    var hopSize = 256;
    var numFrames = Math.floor((samples.length - frameSize) / hopSize);
    var mfccs = [];

    // Create Mel filterbank
    var melFilters = createMelFilterbank(NUM_FILTERS, frameSize, sampleRate);

    for (var f = 0; f < numFrames; f++) {
      // Extract frame and apply Hamming window
      var frame = new Float32Array(frameSize);
      for (var i = 0; i < frameSize; i++) {
        var idx = f * hopSize + i;
        if (idx < samples.length) {
          frame[i] = samples[idx] * (0.54 - 0.46 * Math.cos(2 * Math.PI * i / (frameSize - 1)));
        }
      }

      // Compute power spectrum via DFT
      var powerSpec = computePowerSpectrum(frame, frameSize);

      // Apply Mel filterbank
      var melEnergies = new Float32Array(NUM_FILTERS);
      for (var m = 0; m < NUM_FILTERS; m++) {
        var energy = 0;
        for (var k = 0; k < frameSize / 2; k++) {
          energy += powerSpec[k] * melFilters[m][k];
        }
        melEnergies[m] = Math.log(Math.max(energy, 1e-10));
      }

      // DCT (Discrete Cosine Transform) to get MFCCs
      var mfcc = new Float32Array(NUM_MFCC);
      for (var n = 0; n < NUM_MFCC; n++) {
        var sum = 0;
        for (var m = 0; m < NUM_FILTERS; m++) {
          sum += melEnergies[m] * Math.cos(Math.PI * n * (2 * m + 1) / (2 * NUM_FILTERS));
        }
        mfcc[n] = sum;
      }
      mfccs.push(mfcc);
    }
    return mfccs;
  }

  function createMelFilterbank(numFilters, fftSize, sampleRate) {
    var lowFreq = 0;
    var highFreq = sampleRate / 2;
    var melLow = freqToMel(lowFreq);
    var melHigh = freqToMel(highFreq);
    var melPoints = new Float32Array(numFilters + 2);
    for (var i = 0; i < numFilters + 2; i++) {
      melPoints[i] = melToFreq(melLow + (melHigh - melLow) * i / (numFilters + 1));
    }

    var binSize = fftSize / 2;
    var filters = [];
    for (var m = 0; m < numFilters; m++) {
      var filter = new Float32Array(binSize);
      var startBin = Math.floor(melPoints[m] / (sampleRate / fftSize));
      var centerBin = Math.floor(melPoints[m + 1] / (sampleRate / fftSize));
      var endBin = Math.floor(melPoints[m + 2] / (sampleRate / fftSize));

      for (var k = startBin; k < centerBin; k++) {
        if (k < binSize && centerBin > startBin) {
          filter[k] = (k - startBin) / (centerBin - startBin);
        }
      }
      for (var k = centerBin; k < endBin; k++) {
        if (k < binSize && endBin > centerBin) {
          filter[k] = (endBin - k) / (endBin - centerBin);
        }
      }
      filters.push(filter);
    }
    return filters;
  }

  function computePowerSpectrum(frame, fftSize) {
    var n = fftSize / 2;
    var power = new Float32Array(n);
    // Simplified DFT (not full FFT — adequate for voice features)
    for (var k = 0; k < n; k++) {
      var real = 0;
      var imag = 0;
      for (var t = 0; t < fftSize; t++) {
        var angle = 2 * Math.PI * k * t / fftSize;
        real += frame[t] * Math.cos(angle);
        imag -= frame[t] * Math.sin(angle);
      }
      power[k] = (real * real + imag * imag) / fftSize;
    }
    return power;
  }

  function freqToMel(freq) { return 2595 * Math.log10(1 + freq / 700); }
  function melToFreq(mel) { return 700 * (Math.pow(10, mel / 2595) - 1); }

  /**
   * Compute the centroid (average MFCC vector) from multiple MFCC frames.
   * This is the voiceprint.
   * @param {Array} mfccFrames - Array of MFCC vectors
   * @returns {Float32Array} Centroid vector
   */
  function computeCentroid(mfccFrames) {
    if (!mfccFrames || mfccFrames.length === 0) return null;
    var dim = mfccFrames[0].length;
    var centroid = new Float32Array(dim);
    for (var i = 0; i < mfccFrames.length; i++) {
      for (var d = 0; d < dim; d++) {
        centroid[d] += mfccFrames[i][d];
      }
    }
    for (var d = 0; d < dim; d++) {
      centroid[d] /= mfccFrames.length;
    }
    return centroid;
  }

  /**
   * Compute variance of MFCC frames for stability scoring.
   */
  function computeVariance(mfccFrames, centroid) {
    if (!mfccFrames || mfccFrames.length < 2) return null;
    var dim = centroid.length;
    var variance = new Float32Array(dim);
    for (var i = 0; i < mfccFrames.length; i++) {
      for (var d = 0; d < dim; d++) {
        var diff = mfccFrames[i][d] - centroid[d];
        variance[d] += diff * diff;
      }
    }
    for (var d = 0; d < dim; d++) {
      variance[d] /= mfccFrames.length;
    }
    return variance;
  }

  /**
   * Compute cosine similarity between two vectors.
   * @param {Float32Array} a
   * @param {Float32Array} b
   * @returns {number} Similarity score (0-1, higher = more similar)
   */
  function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    var dot = 0, normA = 0, normB = 0;
    for (var i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    var denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0;
  }

  /**
   * Compute Euclidean distance normalized to 0-1 range.
   */
  function normalizedDistance(a, b) {
    if (!a || !b || a.length !== b.length) return 1;
    var sum = 0;
    for (var i = 0; i < a.length; i++) {
      var diff = a[i] - b[i];
      sum += diff * diff;
    }
    var dist = Math.sqrt(sum);
    // Normalize: assume max possible distance is ~50 for MFCC features
    return Math.min(1, dist / 50);
  }

  /**
   * Capture audio from microphone for a specified duration.
   * @param {number} duration - Duration in ms
   * @returns {Promise<Float32Array>} Audio samples
   */
  function captureAudio(duration) {
    return new Promise(function (resolve, reject) {
      navigator.mediaDevices.getUserMedia({ audio: { sampleRate: SAMPLE_RATE, channelCount: 1 } })
        .then(function (stream) {
          var ctx = getContext();
          var source = ctx.createMediaStreamSource(stream);
          var analyser = ctx.createAnalyser();
          analyser.fftSize = FFT_SIZE;
          source.connect(analyser);

          var allSamples = [];
          var bufferLength = analyser.fftSize;
          var dataArray = new Float32Array(bufferLength);
          var startTime = Date.now();

          function readChunk() {
            analyser.getFloatTimeDomainData(dataArray);
            for (var i = 0; i < dataArray.length; i++) allSamples.push(dataArray[i]);

            if (Date.now() - startTime < duration) {
              requestAnimationFrame(readChunk);
            } else {
              stream.getTracks().forEach(function (t) { t.stop(); });
              resolve(new Float32Array(allSamples));
            }
          }
          readChunk();
        })
        .catch(reject);
    });
  }

  /**
   * Enroll a voice: capture audio and compute voiceprint.
   * @param {number} duration - Duration in ms
   * @returns {Promise<Object>} Voiceprint data
   */
  function enrollVoice(duration) {
    duration = duration || ENROLLMENT_DURATION;
    return captureAudio(duration).then(function (samples) {
      var mfccs = computeMFCC(samples, SAMPLE_RATE);
      var centroid = computeCentroid(mfccs);
      var variance = computeVariance(mfccs, centroid);
      return {
        voiceprint: Array.from(centroid),
        variance: variance ? Array.from(variance) : null,
        numFrames: mfccs.length,
        enrolledAt: new Date().toISOString()
      };
    });
  }

  /**
   * Verify a voice against an enrolled voiceprint.
   * @param {Array} enrolledVoiceprint - The stored voiceprint vector
   * @param {number} threshold - Similarity threshold (0-1, default 0.85)
   * @returns {Promise<Object>} Verification result
   */
  function verifyVoice(enrolledVoiceprint, threshold) {
    threshold = threshold || 0.85;
    return captureAudio(VERIFICATION_DURATION).then(function (samples) {
      var mfccs = computeMFCC(samples, SAMPLE_RATE);
      var centroid = computeCentroid(mfccs);
      if (!centroid) return { match: false, confidence: 0, reason: 'insufficient_audio' };

      var enrolled = new Float32Array(enrolledVoiceprint);

      var cosSim = cosineSimilarity(enrolled, centroid);
      var eucDist = normalizedDistance(enrolled, centroid);

      // Combined score: 60% cosine + 40% inverse distance
      var confidence = cosSim * 0.6 + (1 - eucDist) * 0.4;
      var match = confidence >= threshold;

      return {
        match: match,
        confidence: Math.round(confidence * 100) / 100,
        cosineSimilarity: Math.round(cosSim * 1000) / 1000,
        normalizedDistance: Math.round(eucDist * 1000) / 1000,
        threshold: threshold,
        numFrames: mfccs.length
      };
    });
  }

  return {
    enrollVoice: enrollVoice,
    verifyVoice: verifyVoice,
    computeMFCC: computeMFCC,
    computeCentroid: computeCentroid,
    cosineSimilarity: cosineSimilarity,
    captureAudio: captureAudio,
    SAMPLE_RATE: SAMPLE_RATE,
    ENROLLMENT_DURATION: ENROLLMENT_DURATION,
    VERIFICATION_DURATION: VERIFICATION_DURATION
  };

})();

if (typeof window !== 'undefined') {
  window.EnclaveVoiceAuth = EnclaveVoiceAuth;
}
