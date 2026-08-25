/* ─── Enclave ML Deepfake Detector ───
 * Pure JS image decoding + TensorFlow.js MobileNet + heuristic analysis.
 */

const tf = require('@tensorflow/tfjs');
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const jpeg = require('jpeg-js');

let model = null;
let modelLoading = false;

const MODEL_URL = 'https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v2_100_224/classification/3/default/1';

async function loadModel() {
  if (model) return model;
  if (modelLoading) {
    while (modelLoading) await new Promise(r => setTimeout(r, 100));
    return model;
  }
  modelLoading = true;
  try {
    model = await tf.loadGraphModel(MODEL_URL, { fromTFHub: true });
    console.log('[Detector] Model loaded');
  } catch (e) {
    console.warn('[Detector] Model load failed:', e.message);
    model = null;
  } finally {
    modelLoading = false;
  }
  return model;
}

/* ─── Pure JS Image Decoder ─── */
function decodeImage(buffer) {
  const ext = detectImageType(buffer);
  let pixels, width, height;

  if (ext === 'png') {
    const png = PNG.sync.read(buffer);
    pixels = png.data;   // RGBA
    width = png.width;
    height = png.height;
  } else if (ext === 'jpg' || ext === 'jpeg') {
    const jpg = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: false });
    pixels = jpg.data;   // RGB
    width = jpg.width;
    height = jpg.height;
  } else {
    throw new Error('Unsupported image format: ' + ext);
  }

  return { pixels, width, height, channels: ext === 'png' ? 4 : 3 };
}

function detectImageType(buffer) {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'png';
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) return 'jpg';
  throw new Error('Unrecognized image format');
}

function rgbaToRgb(pixels, w, h) {
  const rgb = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    rgb[i * 3]     = pixels[i * 4];
    rgb[i * 3 + 1] = pixels[i * 4 + 1];
    rgb[i * 3 + 2] = pixels[i * 4 + 2];
  }
  return rgb;
}

function preprocessImage(buffer) {
  try {
    const { pixels, width, height, channels } = decodeImage(buffer);
    // Convert to RGB tensor
    let data = channels === 4 ? rgbaToRgb(pixels, width, height) : pixels;
    let tensor = tf.tensor3d(data, [height, width, 3], 'float32');
    tensor = tf.image.resizeBilinear(tensor, [224, 224]);
    // Normalize to [0, 1] (MobileNet v2 classification format)
    tensor = tensor.div(tf.scalar(255));
    tensor = tensor.expandDims(0);
    return tensor;
  } catch (e) {
    console.warn('[Detector] Preprocess failed:', e.message);
    return null;
  }
}

async function classifyImage(tensor) {
  if (!tensor || !model) return null;
  try {
    const logits = model.predict(tensor);
    // Apply softmax to get probabilities
    const probs = tf.softmax(logits);
    const data = await probs.data();
    logits.dispose();
    probs.dispose();
    return Array.from(data);
  } catch (e) {
    console.warn('[Detector] Classify failed:', e.message);
    return null;
  }
}

/* ─── Heuristic Analysis (RGB stride = 3) ─── */
function heuristicAnalysis(imageBuffer) {
  try {
    let { pixels, width, height, channels } = decodeImage(imageBuffer);
    const data = channels === 4 ? rgbaToRgb(pixels, width, height) : pixels;
    const S = 3;

    const hf = computeHFNoise(data, width, height, S);
    const varScore = computeLocalVariance(data, width, height, S);
    const edge = computeEdgeCoherence(data, width, height, S);
    const color = computeColorAnomaly(data, width, height, S);

    const blended = hf * 0.3 + varScore * 0.25 + edge * 0.25 + color * 0.2;

    return {
      hfNoise: +hf.toFixed(4),
      localVariance: +varScore.toFixed(4),
      edgeCoherence: +edge.toFixed(4),
      colorAnomaly: +color.toFixed(4),
      heuristicScore: +blended.toFixed(4)
    };
  } catch (e) {
    console.warn('[Detector] Heuristic failed:', e.message);
    return null;
  }
}

function computeHFNoise(data, w, h, S) {
  let hf = 0, total = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      for (let c = 0; c < 3; c++) {
        const i = (y * w + x) * S + c;
        const lap = Math.abs(data[i] * 4 - data[i - S] - data[i + S] - data[i - w * S] - data[i + w * S]);
        hf += lap;
        total += Math.abs(data[i]);
      }
    }
  }
  if (total === 0) return 0.5;
  const r = hf / total;
  if (r < 0.03) return 0.7;
  if (r > 0.25) return 0.6;
  return r < 0.08 ? 0.3 : 0.2;
}

function computeLocalVariance(data, w, h, S) {
  let sum = 0, count = 0;
  for (let by = 0; by < h - 8; by += 8) {
    for (let bx = 0; bx < w - 8; bx += 8) {
      let s = 0, sq = 0, n = 0;
      for (let y = by; y < by + 8; y++) {
        for (let x = bx; x < bx + 8; x++) {
          const i = (y * w + x) * S;
          const g = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          s += g; sq += g * g; n++;
        }
      }
      if (n > 0) {
        const m = s / n;
        sum += sq / n - m * m;
        count++;
      }
    }
  }
  if (count === 0) return 0.5;
  const avg = sum / count;
  if (avg < 100) return 0.65;
  if (avg > 5000) return 0.55;
  return 0.2;
}

function computeEdgeCoherence(data, w, h, S) {
  let edges = 0, strong = 0;
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const i = (y * w + x) * S;
      const g = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const left = (y - 1) * w * S + (x - 1) * S;
      const right = (y - 1) * w * S + (x + 1) * S;
      const gx = Math.abs(
        (data[right] * 0.299 + data[right + 1] * 0.587 + data[right + 2] * 0.114) -
        (data[left] * 0.299 + data[left + 1] * 0.587 + data[left + 2] * 0.114)
      );
      if (gx > 30) { edges++; if (gx > 80) strong++; }
    }
  }
  if (edges === 0) return 0.5;
  const r = strong / edges;
  if (r > 0.7) return 0.6;
  if (r < 0.1) return 0.55;
  return 0.2;
}

function computeColorAnomaly(data, w, h, S) {
  const n = w * h;
  let rM = 0, gM = 0, bM = 0;
  for (let i = 0; i < n; i++) {
    rM += data[i * S];
    gM += data[i * S + 1];
    bM += data[i * S + 2];
  }
  rM /= n; gM /= n; bM /= n;
  let rg = 0, rb = 0, gb = 0;
  for (let i = 0; i < n; i++) {
    rg += (data[i * S] - rM) * (data[i * S + 1] - gM);
    rb += (data[i * S] - rM) * (data[i * S + 2] - bM);
    gb += (data[i * S + 1] - gM) * (data[i * S + 2] - bM);
  }
  if (Math.max(Math.abs(rg), Math.abs(rb), Math.abs(gb)) > 0.9 * n * 128 * 128) return 0.5;
  return 0.15;
}

/* ─── Main Pipeline ─── */
async function analyzeImage(imagePath) {
  try {
    const buffer = fs.readFileSync(imagePath);
    const stats = fs.statSync(imagePath);

    const heuristics = heuristicAnalysis(buffer);

    let mlResult = null;
    const loadedModel = await loadModel();
    if (loadedModel) {
      const tensor = preprocessImage(buffer);
      if (tensor) {
        const predictions = await classifyImage(tensor);
        tensor.dispose();
        if (predictions && predictions.length) {
          const maxVal = Math.max(...predictions);
          const maxIdx = predictions.indexOf(maxVal);
          // Overconfidence (>0.92) or high uncertainty (<0.15) may indicate GAN
          const anomaly = (maxVal > 0.92 || maxVal < 0.15) ? 0.6 : 0.15;
          mlResult = {
            topClass: maxIdx,
            topConfidence: +maxVal.toFixed(4),
            mlScore: anomaly
          };
        }
      }
    }

    let finalScore = 0.5;
    if (heuristics && mlResult) {
      finalScore = heuristics.heuristicScore * 0.5 + mlResult.mlScore * 0.5;
    } else if (heuristics) {
      finalScore = heuristics.heuristicScore * 0.8 + 0.1;
    } else if (mlResult) {
      finalScore = mlResult.mlScore * 0.6 + 0.2;
    }
    finalScore = Math.min(1, Math.max(0, finalScore));

    return {
      confidence: +((finalScore * 100).toFixed(1)),
      heuristic: heuristics,
      ml: mlResult,
      fileSize: stats.size,
      verdict: finalScore > 0.6 ? 'LIKELY_SYNTHETIC' : finalScore > 0.35 ? 'SUSPICIOUS' : 'LIKELY_NATURAL'
    };
  } catch (e) {
    console.warn('[Detector] Analysis failed:', e.message);
    return { error: e.message };
  }
}

module.exports = { analyzeImage, loadModel };
