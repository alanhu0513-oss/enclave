const sharp = require("sharp");
const crypto = require("crypto");

const WATERMARK_STRENGTH = 3;
const BITS_PER_CHANNEL = 2;

function generateWatermark(userId) {
  return {
    id: crypto.randomBytes(16).toString("hex"),
    userId,
    timestamp: Date.now(),
    hash: crypto.createHash("sha256").update(`${userId}:${Date.now()}`).digest("hex")
  };
}

async function embedWatermark(imageBuffer, userId) {
  const metadata = await sharp(imageBuffer).metadata();
  const { width, height, channels } = metadata;

  const watermark = generateWatermark(userId);
  const bits = stringToBits(JSON.stringify(watermark));

  const image = sharp(imageBuffer);
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  const pixelCount = info.width * info.height;
  const availableBits = pixelCount * channels * BITS_PER_CHANNEL;
  if (bits.length > availableBits) {
    throw new Error("Image too small for watermark");
  }

  const modified = Buffer.from(data);
  let bitIndex = 0;

  for (let i = 0; i < modified.length && bitIndex < bits.length; i += (32 / BITS_PER_CHANNEL)) {
    for (let b = 0; b < BITS_PER_CHANNEL && bitIndex < bits.length; b++) {
      const bit = bits[bitIndex];
      const shift = BITS_PER_CHANNEL - 1 - b;
      modified[i] = (modified[i] & ~(1 << shift)) | (bit << shift);
      bitIndex++;
    }
  }

  const result = await sharp(modified, {
    raw: { width: info.width, height: info.height, channels: info.channels }
  })
    .jpeg({ quality: 95 })
    .toBuffer();

  return { buffer: result, watermark };
}

async function extractWatermark(imageBuffer) {
  const image = sharp(imageBuffer);
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  const bits = [];
  for (let i = 0; i < data.length; i += (32 / BITS_PER_CHANNEL)) {
    for (let b = 0; b < BITS_PER_CHANNEL; b++) {
      const shift = BITS_PER_CHANNEL - 1 - b;
      bits.push((data[i] >> shift) & 1);
    }
  }

  let jsonStr = "";
  let currentByte = 0;
  let bitCount = 0;

  for (const bit of bits) {
    currentByte = (currentByte << 1) | bit;
    bitCount++;
    if (bitCount === 8) {
      const char = String.fromCharCode(currentByte);
      if (char === "}" && jsonStr.includes("{")) {
        jsonStr += char;
        break;
      }
      jsonStr += char;
      currentByte = 0;
      bitCount = 0;
    }
  }

  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

async function verifyWatermark(imageBuffer, expectedUserId) {
  const watermark = await extractWatermark(imageBuffer);
  if (!watermark) {
    return { verified: false, reason: "No watermark found" };
  }

  if (expectedUserId && watermark.userId !== expectedUserId) {
    return { verified: false, reason: "User ID mismatch", watermark };
  }

  const age = Date.now() - watermark.timestamp;
  const maxAge = 365 * 24 * 60 * 60 * 1000;
  if (age > maxAge) {
    return { verified: false, reason: "Watermark expired", watermark };
  }

  return { verified: true, watermark };
}

function stringToBits(str) {
  const bits = [];
  for (let i = 0; i < str.length; i++) {
    const byte = str.charCodeAt(i);
    for (let b = 7; b >= 0; b--) {
      bits.push((byte >> b) & 1);
    }
  }
  return bits;
}

module.exports = { embedWatermark, extractWatermark, verifyWatermark, generateWatermark };
