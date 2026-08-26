/* ─── Enclave ML Client ───
 * Detection fallback chain:
 *   1. OpenAI-compatible provider (auto-detected: Groq / Cerebras /
 *      OpenRouter / Mistral / SiliconFlow / GitHub Models / custom)
 *   2. Gemini 2.5 Flash (optional backup; also handles audio)
 *   3. Python ML microservice (XceptionNet, optional self-hosted)
 *   4. Local Laplacian heuristic (always available)
 */

const fs = require('fs');
const path = require('path');
const gemini = require('./gemini-client');
const primaryAi = require('./openai-compat-client');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';
const ML_TIMEOUT = 30000;

let _mlAvailable = null;

/* Sniff image/audio mimetype from magic bytes */
function _sniffMime(buffer, fallback) {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[8] === 0x57) return 'image/webp';
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) return 'image/bmp';
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) return 'audio/mpeg';
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return 'audio/mpeg';
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[8] === 0x41) return 'audio/wav';
  if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79) return 'audio/mp4';
  return fallback || 'application/octet-stream';
}

async function isMlAvailable() {
  if (_mlAvailable !== null) return _mlAvailable;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${ML_SERVICE_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    _mlAvailable = res.ok;
  } catch {
    _mlAvailable = false;
  }
  return _mlAvailable;
}

async function mlPostMultipart(endpoint, fieldName, fileBuffer, filename, extraFields = {}) {
  const fd = new FormData();
  for (const [key, val] of Object.entries(extraFields)) {
    fd.append(key, String(val));
  }
  const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
  fd.append(fieldName, blob, filename);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ML_TIMEOUT);
  try {
    const res = await fetch(`${ML_SERVICE_URL}${endpoint}`, {
      method: 'POST',
      body: fd,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`ML service ${endpoint} returned ${res.status}: ${text}`);
    }
    return await res.json();
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

/* ─── Public API ─── */

/**
 * Image deepfake detection via fallback chain.
 * Returns unified shape: { confidence, verdict, provider, latency_ms, cached, ... }
 */
async function detectImage(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return detectImageBuffer(fileBuffer, path.basename(filePath));
}

async function detectImageBuffer(buffer, filename) {
  const started = Date.now();
  const mimetype = _sniffMime(buffer, 'image/jpeg');

  // 1) Primary AI provider (auto-detected via env key)
  try {
    const g = await primaryAi.detectImage(buffer, mimetype, filename);
    if (g) return _finalizeAiResult(g, started, buffer);
  } catch (e) {
    console.warn('[ML Client] primary AI image detect failed:', e.message);
  }

  // 2) Gemini Flash (backup)
  try {
    const g = await gemini.detectImage(buffer, mimetype, filename);
    if (g) return _finalizeAiResult(g, started, buffer);
  } catch (e) {
    console.warn('[ML Client] Gemini image detect failed:', e.message);
  }

  // 3) Python ML service (optional)
  if (await isMlAvailable()) {
    try {
      const result = await mlPostMultipart('/detect/image', 'file', buffer, filename || 'image.jpg');
      return { ...result, provider: 'xceptionnet', latency_ms: Date.now() - started };
    } catch (e) {
      console.warn('[ML Client] ML service image detect failed, falling back to local:', e.message);
    }
  }

  // 4) Local heuristic
  const local = _localHeuristic(buffer);
  return { ...local, provider: 'local-heuristic', latency_ms: Date.now() - started };
}

/* Attach heuristic metadata + latency to an AI-provider result. */
function _finalizeAiResult(g, started, buffer) {
  let heuristicMeta = null;
  try {
    const h = _localHeuristic(buffer);
    if (h && h.heuristic) heuristicMeta = h.heuristic;
  } catch (_) {}
  return {
    confidence: g.confidence,
    verdict: g.verdict,
    ml_avg_score: g.ml_avg_score,
    face_count: g.face_count || 0,
    faces: [],
    explanation: g.explanation || null,
    artifacts: g.artifacts || [],
    provider: g.provider,
    latency_ms: Date.now() - started,
    cached: !!g.cached,
    heuristic: heuristicMeta,
    fallback: false,
  };
}

/** Audio deepfake detection via fallback chain. */
async function detectAudio(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const filename = path.basename(filePath);
  const started = Date.now();
  const mimetype = _sniffMime(fileBuffer, 'audio/wav');

  // 1) Gemini (only cloud provider with native audio analysis)
  try {
    const g = await gemini.detectAudio(fileBuffer, mimetype, filename);
    if (g) {
      return { ...g, provider: g.provider || 'gemini-flash', latency_ms: Date.now() - started, fallback: false };
    }
  } catch (e) {
    console.warn('[ML Client] Gemini audio detect failed:', e.message);
  }

  // 2) Python ML service
  if (await isMlAvailable()) {
    try {
      const result = await mlPostMultipart('/detect/audio', 'file', fileBuffer, filename);
      return { ...result, provider: 'librosa', latency_ms: Date.now() - started };
    } catch (e) {
      console.warn('[ML Client] ML service audio detect failed:', e.message);
      return { confidence: 0, verdict: 'ML_UNAVAILABLE', error: e.message };
    }
  }
  return { confidence: 0, verdict: 'ML_UNAVAILABLE', error: 'No audio detection provider available' };
}

async function matchFaces(filePathA, filePathB, threshold = 0.6) {
  if (!(await isMlAvailable())) {
    return { error: 'ML service not available for face matching', match: false };
  }

  const bufferA = fs.readFileSync(filePathA);
  const bufferB = fs.readFileSync(filePathB);

  const fd = new FormData();
  fd.append('threshold', String(threshold));
  fd.append('file_a', new Blob([bufferA], { type: 'application/octet-stream' }), path.basename(filePathA));
  fd.append('file_b', new Blob([bufferB], { type: 'application/octet-stream' }), path.basename(filePathB));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ML_TIMEOUT);
  try {
    const res = await fetch(`${ML_SERVICE_URL}/face/match`, {
      method: 'POST',
      body: fd,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`ML service /face/match returned ${res.status}: ${text}`);
    }
    return await res.json();
  } catch (e) {
    clearTimeout(timeout);
    return { error: e.message, match: false };
  }
}

async function getEmbedding(filePath) {
  if (!(await isMlAvailable())) {
    return { error: 'ML service not available' };
  }
  const buffer = fs.readFileSync(filePath);
  return mlPostMultipart('/face/embedding', 'file', buffer, path.basename(filePath));
}

async function getHealth() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${ML_SERVICE_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    return await res.json();
  } catch {
    return { status: 'unavailable' };
  }
}

async function downloadModels() {
  const fd = new FormData();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const res = await fetch(`${ML_SERVICE_URL}/models/download`, {
      method: 'POST',
      body: fd,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return await res.json();
  } catch (e) {
    clearTimeout(timeout);
    return { error: e.message };
  }
}

/* ─── Local Fallback ─── */
function _localHeuristic(imageBuffer) {
  try {
    const { PNG } = require('pngjs');
    const jpeg = require('jpeg-js');

    let pixels, width, height;
    if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) {
      const png = PNG.sync.read(imageBuffer);
      pixels = png.data;
      width = png.width;
      height = png.height;
    } else if (imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8) {
      const jpg = jpeg.decode(imageBuffer, { useTArray: true, formatAsRGBA: false });
      pixels = jpg.data;
      width = jpg.width;
      height = jpg.height;
    } else {
      return { confidence: 0, verdict: 'UNSUPPORTED_FORMAT', error: 'Unsupported image format' };
    }

    const gray = new Float64Array(width * height);
    const channels = (imageBuffer[0] === 0x89) ? 4 : 3;
    for (let i = 0; i < width * height; i++) {
      gray[i] = pixels[i * channels] * 0.299 + pixels[i * channels + 1] * 0.587 + pixels[i * channels + 2] * 0.114;
    }

    let hf = 0, total = 0;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        const lap = Math.abs(gray[i] * 4 - gray[i - 1] - gray[i + 1] - gray[i - width] - gray[i + width]);
        hf += lap;
        total += Math.abs(gray[i]);
      }
    }
    const hfRatio = total > 0 ? hf / total : 0.5;

    const score = hfRatio < 0.03 ? 0.6 : (hfRatio > 0.25 ? 0.55 : 0.3);
    const confidence = Math.round(score * 100 * 10) / 10;

    return {
      confidence,
      verdict: score > 0.6 ? 'LIKELY_SYNTHETIC' : (score > 0.35 ? 'SUSPICIOUS' : 'LIKELY_NATURAL'),
      heuristic: { hf_noise: hfRatio },
      ml: null,
      face_count: 0,
      faces: [],
      fallback: true,
    };
  } catch (e) {
    return { confidence: 0, verdict: 'ANALYSIS_FAILED', error: e.message };
  }
}

/** AI-text detection: primary provider → Gemini Flash-Lite fallback. */
async function detectText(text) {
  const started = Date.now();
  try {
    const g = await primaryAi.detectText(text);
    if (g && !g.error) return { ...g, latency_ms: Date.now() - started };
    if (g && g.error) return g; // validation error — no point trying next provider
  } catch (e) {
    console.warn('[ML Client] primary AI text detect failed:', e.message);
  }
  try {
    const result = await gemini.detectText(text);
    if (result) return { ...result, latency_ms: Date.now() - started };
  } catch (e) {
    console.warn('[ML Client] Gemini text detect failed:', e.message);
  }
  return null;
}

/** Merged provider status across primary AI + Gemini + Python ML service. */
async function getStatus() {
  const [geminiStatus, pythonHealth] = await Promise.all([
    Promise.resolve(gemini.getStatus()),
    getHealth().catch(() => ({ status: 'unavailable' })),
  ]);
  return {
    primaryAi: primaryAi.getStatus(),
    gemini: geminiStatus,
    pythonService: {
      url: ML_SERVICE_URL,
      status: pythonHealth.status || 'unavailable',
      models: pythonHealth.models || null,
    },
  };
}

module.exports = {
  detectImage,
  detectImageBuffer,
  detectAudio,
  detectText,
  matchFaces,
  getEmbedding,
  getHealth,
  downloadModels,
  isMlAvailable,
  getStatus,
};
