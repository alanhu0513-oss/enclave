const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(width, height, r, g, b) {
  // Create raw RGBA pixel data
  const rawData = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      // Shield shape: rounded rectangle with pointed bottom
      const cx = width / 2, cy = height / 2;
      const dx = Math.abs(x - cx) / cx;
      const dy = (y - cy * 0.3) / (height * 0.7);
      const inShield = (dx < 0.7 && dy > -0.3 && dy < 0.8) ||
                       (dx < 0.5 && dy >= 0.8 && dy < 1.0 && dx < 0.7 * (1 - (dy - 0.8) * 2));
      const isCenter = (dx < 0.15 && dy > -0.2 && dy < 0.5);
      if (inShield) {
        rawData[i] = isCenter ? 255 : r;
        rawData[i + 1] = isCenter ? 255 : g;
        rawData[i + 2] = isCenter ? 255 : b;
        rawData[i + 3] = 255;
      } else {
        rawData[i] = 0;
        rawData[i + 1] = 0;
        rawData[i + 2] = 0;
        rawData[i + 3] = 0;
      }
    }
  }

  // PNG header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeBuffer = Buffer.from(type);
    const crcData = Buffer.concat([typeBuffer, data]);
    let crc = 0xFFFFFFFF;
    for (const byte of crcData) {
      crc ^= byte;
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
      }
    }
    crc = (crc ^ 0xFFFFFFFF) >>> 0;
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc);
    return Buffer.concat([len, typeBuffer, data, crcBuf]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Add filter byte (0) to each row
  const filteredData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    filteredData[y * (1 + width * 4)] = 0; // filter none
    rawData.copy(filteredData, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(filteredData);

  const chunks = [
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ];

  return Buffer.concat([signature, ...chunks]);
}

const outDir = path.join(__dirname, 'icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Red shield icon (#e94560)
for (const size of [16, 48, 128]) {
  const png = createPNG(size, size, 233, 69, 96);
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), png);
  console.log(`Created icon${size}.png (${png.length} bytes)`);
}
console.log('Icons generated');
