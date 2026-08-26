/* ─── Enclave Evidence Chain + Perceptual Hashing ───
 * SHA-256 hash chain over preserved artifacts (tamper-evident),
 * plus dHash perceptual hashing for content resurface detection.
 * Pure JS — uses existing pngjs / jpeg-js decoders.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/* ─── Hash Chain ─── */

/**
 * Build a tamper-evident hash chain over files in a directory.
 * Each entry: hash = sha256(prevHash || fileContent). Genesis prev = '0'.repeat(64).
 */
function buildHashChain(dir, files) {
  const chain = [];
  let prev = '0'.repeat(64);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath);
    const hash = sha256(Buffer.concat([Buffer.from(prev, 'hex'), content]));
    chain.push({
      index: chain.length,
      file,
      size: content.length,
      hash,
      prevHash: prev,
      timestamp: new Date().toISOString(),
    });
    prev = hash;
  }
  return { chain, head: prev };
}

/** Verify an existing chain. Returns { valid, brokenAtIndex } */
function verifyHashChain(dir, chain) {
  let prev = '0'.repeat(64);
  for (let i = 0; i < chain.length; i++) {
    const entry = chain[i];
    const filePath = path.join(dir, entry.file);
    if (!fs.existsSync(filePath)) return { valid: false, brokenAtIndex: i, reason: 'file missing' };
    const content = fs.readFileSync(filePath);
    const expected = sha256(Buffer.concat([Buffer.from(prev, 'hex'), content]));
    if (expected !== entry.hash || entry.prevHash !== prev) {
      return { valid: false, brokenAtIndex: i, reason: 'hash mismatch' };
    }
    prev = entry.hash;
  }
  return { valid: true, brokenAtIndex: null };
}

/* ─── Perceptual Hashing (dHash 64-bit) ─── */

function _decodeToGray(buffer) {
  const { PNG } = require('pngjs');
  const jpeg = require('jpeg-js');

  let pixels, width, height, channels;
  if (buffer[0] === 0x89 && buffer[1] === 0x50) {
    const png = PNG.sync.read(buffer);
    pixels = png.data; width = png.width; height = png.height; channels = 4;
  } else if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    const jpg = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: false });
    pixels = jpg.data; width = jpg.width; height = jpg.height; channels = 3;
  } else {
    return null;
  }

  // Downscale to 9x8 grayscale via box sampling
  const W = 9, H = 8;
  const gray = new Float64Array(W * H);
  const xStep = width / W, yStep = height / H;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const x0 = Math.floor(x * xStep), x1 = Math.max(x0 + 1, Math.floor((x + 1) * xStep));
      const y0 = Math.floor(y * yStep), y1 = Math.max(y0 + 1, Math.floor((y + 1) * yStep));
      let sum = 0, count = 0;
      for (let sy = y0; sy < Math.min(y1, height); sy++) {
        for (let sx = x0; sx < Math.min(x1, width); sx++) {
          const i = (sy * width + sx) * channels;
          sum += pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
          count++;
        }
      }
      gray[y * W + x] = count ? sum / count : 0;
    }
  }
  return gray;
}

/**
 * dHash: compare horizontally adjacent pixels on a 9x8 grayscale grid
 * → 64-bit fingerprint returned as 16-char hex.
 */
function dHash(buffer) {
  try {
    const gray = _decodeToGray(buffer);
    if (!gray) return null;
    const W = 9;
    let bits = '';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        bits += gray[y * W + x] < gray[y * W + x + 1] ? '1' : '0';
      }
    }
    let hex = '';
    for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    return hex;
  } catch (_) {
    return null;
  }
}

/** Hamming distance between two hex hashes (bits differing). */
function hammingDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { dist += x & 1; x >>= 1; }
  }
  return dist;
}

/** Two hashes within this distance are considered the same visual content. */
function isSameVisual(a, b, threshold = 10) {
  const d = hammingDistance(a, b);
  return d <= threshold;
}

module.exports = {
  sha256,
  buildHashChain,
  verifyHashChain,
  dHash,
  hammingDistance,
  isSameVisual,
};
