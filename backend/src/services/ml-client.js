/* ─── Enclave ML Client ───
 * Calls the Python ML microservice for deepfake detection.
 * Falls back to local heuristic analysis if ML service is unreachable.
 */

const fs = require('fs');
const path = require('path');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';
const ML_TIMEOUT = 30000;

let _mlAvailable = null;

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

async function detectImage(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const filename = path.basename(filePath);

  if (await isMlAvailable()) {
    try {
      return await mlPostMultipart('/detect/image', 'file', fileBuffer, filename);
    } catch (e) {
      console.warn('[ML Client] ML service image detect failed, falling back to local:', e.message);
    }
  }

  return _localHeuristic(fileBuffer);
}

async function detectImageBuffer(buffer, filename) {
  if (await isMlAvailable()) {
    try {
      return await mlPostMultipart('/detect/image', 'file', buffer, filename || 'image.jpg');
    } catch (e) {
      console.warn('[ML Client] ML service image detect failed, falling back to local:', e.message);
    }
  }
  return _localHeuristic(buffer);
}

async function detectAudio(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const filename = path.basename(filePath);

  if (await isMlAvailable()) {
    try {
      return await mlPostMultipart('/detect/audio', 'file', fileBuffer, filename);
    } catch (e) {
      console.warn('[ML Client] ML service audio detect failed:', e.message);
      return { confidence: 0, verdict: 'ML_UNAVAILABLE', error: e.message };
    }
  }
  return { confidence: 0, verdict: 'ML_UNAVAILABLE', error: 'ML service not available' };
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

module.exports = {
  detectImage,
  detectImageBuffer,
  detectAudio,
  matchFaces,
  getEmbedding,
  getHealth,
  downloadModels,
  isMlAvailable,
};
