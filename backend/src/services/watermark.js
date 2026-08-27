/**
 * Invisible Watermark Service (Phase 4.3)
 * - embedWatermark: LSB steganography on PNG (payload = user_id|timestamp|copyright)
 * - verifyWatermark: extract + validate payload
 * Uses pngjs for pixel-level LSB manipulation. PNGs are lossless so the
 * watermark survives typical re-saves; JPEG re-encoding is NOT supported
 * for recovery (lossy), so verification returns best-effort.
 */

const { PNG } = require('pngjs');
const fs = require('fs');

function toBytes(str) {
  return Buffer.from(str, 'utf8');
}

// Encode a payload as a bit stream terminated by a 16-bit trailing marker.
function buildPayloadMessage(payload) {
  const data = Buffer.from(JSON.stringify(payload), 'utf8');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  return Buffer.concat([lenBuf, data, Buffer.from([0x7e, 0x7e, 0x7e, 0x7e])]);
}

function extractPayloadMessage(bytes) {
  // Look for payload within the bit-stuffed bytes.
  if (bytes.length < 8) return null;
  const len = bytes.readUInt32BE(0);
  if (len <= 0 || len > bytes.length - 8) return null;
  const content = bytes.slice(4, 4 + len);
  // Validate trailing marker
  if (bytes[4 + len] !== 0x7e || bytes[4 + len + 1] !== 0x7e ||
      bytes[4 + len + 2] !== 0x7e || bytes[4 + len + 3] !== 0x7e) return null;
  try {
    return JSON.parse(content.toString('utf8'));
  } catch (_) {
    return null;
  }
}

function embedPayloadInPng(png, payload) {
  const message = buildPayloadMessage(payload);
  const bitLength = message.length * 8;
  const totalPixels = png.width * png.height;
  // Need at least 1 LSB slot per byte (use channel 0 of each pixel = enough for small payloads)
  const capacity = totalPixels; // one bit per pixel (channel 0 LSB)
  if (bitLength > capacity) {
    throw new Error('Image too small to embed watermark payload');
  }
  let bitIndex = 0;
  for (let i = 0; i < bitLength; i++) {
    const byte = message[Math.floor(i / 8)];
    const bit = (byte >> (7 - (i % 8))) & 1;
    const idx = i * 4; // channel 0 of pixel i
    const current = png.data[idx];
    png.data[idx] = (current & 0xfe) | bit;
  }
  return png;
}

function extractPayloadFromPng(png) {
  const bitLength = png.width * png.height;
  const byteCount = Math.floor(bitLength / 8);
  const bytes = Buffer.alloc(byteCount);
  for (let i = 0; i < byteCount * 8; i++) {
    const byteIdx = Math.floor(i / 8);
    const bit = png.data[i * 4] & 1;
    bytes[byteIdx] = (bytes[byteIdx] << 1) | bit;
  }
  return extractPayloadMessage(bytes);
}

function isPng(buffer) {
  return buffer.length > 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
}

/**
 * Embed an invisible watermark into a PNG image buffer.
 * Returns a new PNG buffer.
 */
function embedWatermark(inputBuffer, payload) {
  if (!isPng(inputBuffer)) {
    // For non-PNG (e.g. JPEG), embed as EXIF-style user comment is lossy;
    // store in sidecar is not viable in-memory, so we wrap: re-encode not possible.
    // Instead we return a result signaling unsupported so caller can tell the user.
    throw new Error('Watermark embedding currently supports PNG images only. Convert to PNG first.');
  }
  const png = PNG.sync.read(inputBuffer);
  embedPayloadInPng(png, payload);
  return PNG.sync.write(png, { colorType: png.colorType || 6 });
}

/**
 * Verify a watermark on an image buffer. Returns payload object or null.
 */
function verifyWatermark(inputBuffer) {
  if (!isPng(inputBuffer)) return null;
  const png = PNG.sync.read(inputBuffer);
  return extractPayloadFromPng(png);
}

module.exports = {
  embedWatermark,
  verifyWatermark,
};
