const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(width, height, r, g, b) {
  const rawData = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const cx = width / 2, cy = height / 2;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const maxR = width * 0.45;
      if (dist < maxR) {
        // Radar circle with crosshairs
        const ring = Math.abs(dist - maxR * 0.7) < width * 0.06;
        const crosshair = (Math.abs(x - cx) < width * 0.02 || Math.abs(y - cy) < height * 0.02);
        const pulse = dist < maxR * 0.3;
        if (ring || pulse) {
          rawData[i] = 255; rawData[i + 1] = 255; rawData[i + 2] = 255; rawData[i + 3] = 255;
        } else if (crosshair && dist < maxR * 0.85) {
          rawData[i] = 200; rawData[i + 1] = 200; rawData[i + 2] = 200; rawData[i + 3] = 180;
        } else {
          rawData[i] = r; rawData[i + 1] = g; rawData[i + 2] = b; rawData[i + 3] = 255;
        }
      } else {
        rawData[i] = 0; rawData[i + 1] = 0; rawData[i + 2] = 0; rawData[i + 3] = 0;
      }
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  function makeChunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const typeBuffer = Buffer.from(type);
    const crcData = Buffer.concat([typeBuffer, data]);
    let crc = 0xFFFFFFFF;
    for (const byte of crcData) { crc ^= byte; for (let j = 0; j < 8; j++) { crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0); } }
    crc = (crc ^ 0xFFFFFFFF) >>> 0;
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc);
    return Buffer.concat([len, typeBuffer, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const filteredData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    filteredData[y * (1 + width * 4)] = 0;
    rawData.copy(filteredData, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(filteredData);
  const chunks = [makeChunk('IHDR', ihdr), makeChunk('IDAT', compressed), makeChunk('IEND', Buffer.alloc(0))];
  return Buffer.concat([signature, ...chunks]);
}

const outDir = path.join(__dirname, 'icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Cyan/blue radar icon (#00b4d8)
for (const size of [16, 48, 128]) {
  const png = createPNG(size, size, 0, 180, 216);
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), png);
  console.log(`Created icon${size}.png (${png.length} bytes)`);
}
console.log('Radar icons generated');
