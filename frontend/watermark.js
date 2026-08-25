/**
 * Invisible Watermark Module
 * Embeds steganographic watermarks into images using LSB (Least Significant Bit) encoding.
 * Uses a spread-spectrum approach across the blue channel for maximum invisibility.
 * Pure JavaScript — no dependencies.
 */

var EnclaveWatermark = (function () {

  var WATERMARK_VERSION = '1.0';
  var ENCLAVE_WATERMARK_PREFIX = 'ENCLAVE';

  function generateWatermarkPayload(opts) {
    opts = opts || {};
    var timestamp = opts.timestamp || new Date().toISOString();
    var userId = opts.userId || 'anonymous';
    var scanId = opts.scanId || '';

    var payload = JSON.stringify({
      v: WATERMARK_VERSION,
      s: ENCLAVE_WATERMARK_PREFIX,
      t: timestamp,
      u: userId,
      i: scanId
    });

    // Convert string to bit array
    var bits = [];
    for (var i = 0; i < payload.length; i++) {
      var charCode = payload.charCodeAt(i);
      for (var b = 7; b >= 0; b--) {
        bits.push((charCode >> b) & 1);
      }
    }

    // Add sync pattern: 01010101 01010101
    var sync = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
    var payloadWithSync = sync.concat(bits);

    // Add length header (32 bits, big-endian)
    var lenBits = [];
    var totalLen = payloadWithSync.length;
    for (var b = 31; b >= 0; b--) {
      lenBits.push((totalLen >> b) & 1);
    }
    payloadWithSync = lenBits.concat(payloadWithSync);

    return payloadWithSync;
  }

  /**
   * Embed watermark bits into image data using LSB encoding on the blue channel.
   * @param {Uint8Array} imageData - Raw RGBA pixel data
   * @param {Array} bits - Bit array to embed
   * @param {number} spreadFactor - How many pixels to skip per bit (higher = more spread, harder to detect)
   * @returns {Uint8Array} Modified pixel data
   */
  function embedBits(imageData, bits, spreadFactor) {
    spreadFactor = spreadFactor || 8;

    // Start after 2 sync patterns worth of spacing to avoid header interference
    var startOffset = 64;

    for (var i = 0; i < bits.length; i++) {
      var pixelIndex = (startOffset + i * spreadFactor) * 4; // RGBA = 4 bytes per pixel
      if (pixelIndex + 2 >= imageData.length) break; // Out of bounds

      // Embed in blue channel LSB (least visible to human eye)
      // Clear LSB and set to our bit
      imageData[pixelIndex + 2] = (imageData[pixelIndex + 2] & 0xFE) | bits[i];
    }

    return imageData;
  }

  /**
   * Extract watermark bits from image data.
   * @param {Uint8Array} imageData - Raw RGBA pixel data
   * @param {number} spreadFactor - Must match the factor used during embedding
   * @returns {Array} Extracted bits
   */
  function extractBits(imageData, spreadFactor) {
    spreadFactor = spreadFactor || 8;
    var startOffset = 64;
    var bits = [];

    // Read up to 4096 bits max
    for (var i = 0; i < 4096; i++) {
      var pixelIndex = (startOffset + i * spreadFactor) * 4;
      if (pixelIndex + 2 >= imageData.length) break;
      bits.push(imageData[pixelIndex + 2] & 1);
    }

    return bits;
  }

  /**
   * Decode bit array back to string.
   */
  function bitsToString(bits) {
    var chars = [];
    for (var i = 0; i < bits.length; i += 8) {
      var charCode = 0;
      for (var b = 0; b < 8 && (i + b) < bits.length; b++) {
        charCode = (charCode << 1) | bits[i + b];
      }
      if (charCode >= 32 && charCode < 127) {
        chars.push(String.fromCharCode(charCode));
      }
    }
    return chars.join('');
  }

  /**
   * Embed watermark into a PNG/RGBA data URL or raw pixel data.
   * Uses an offscreen canvas to read image pixels.
   * @param {Image|HTMLCanvasElement} image - Source image element
   * @param {Object} opts - { userId, scanId, spreadFactor }
   * @returns {Promise<string>} Data URL of watermarked image
   */
  function embedWatermark(image, opts) {
    opts = opts || {};
    var spreadFactor = opts.spreadFactor || 8;

    return new Promise(function (resolve, reject) {
      try {
        var canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        var ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(image, 0, 0);

        var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var data = imageData.data;

        var bits = generateWatermarkPayload(opts);
        embedBits(data, bits, spreadFactor);

        ctx.putImageData(imageData, 0, 0);
        var dataUrl = canvas.toDataURL('image/png');
        resolve(dataUrl);
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Extract watermark from an image.
   * @param {Image|HTMLCanvasElement} image
   * @param {number} spreadFactor
   * @returns {Promise<Object|null>} Decoded watermark payload
   */
  function extractWatermark(image, spreadFactor) {
    spreadFactor = spreadFactor || 8;

    return new Promise(function (resolve, reject) {
      try {
        var canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        var ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(image, 0, 0);

        var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var bits = extractBits(imageData.data, spreadFactor);

        // Verify sync pattern
        var syncPattern = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
        var hasSync = true;
        for (var i = 0; i < syncPattern.length; i++) {
          if (bits[i] !== syncPattern[i]) { hasSync = false; break; }
        }
        if (!hasSync) { resolve(null); return; }

        // Read length (32 bits starting at position 16)
        var totalLen = 0;
        for (var b = 0; b < 32; b++) {
          totalLen = (totalLen << 1) | (bits[16 + b] || 0);
        }

        // Read payload bits
        var payloadBits = bits.slice(48, 48 + totalLen);
        var str = bitsToString(payloadBits);

        try {
          resolve(JSON.parse(str));
        } catch (e) {
          resolve({ raw: str });
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Embed watermark into a base64-encoded image.
   * @param {string} base64Data - Base64-encoded image data
   * @param {Object} opts - { userId, scanId, spreadFactor }
   * @returns {Promise<string>} Base64 of watermarked image
   */
  function embedWatermarkBase64(base64Data, opts) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        embedWatermark(img, opts).then(function (dataUrl) {
          // Extract base64 from data URL
          var parts = dataUrl.split(',');
          resolve(parts[1] || dataUrl);
        }).catch(reject);
      };
      img.onerror = function () { reject(new Error('Failed to load image')); };
      img.src = 'data:image/png;base64,' + base64Data;
    });
  }

  /**
   * Extract watermark from a base64-encoded image.
   * @param {string} base64Data
   * @param {number} spreadFactor
   * @returns {Promise<Object|null>}
   */
  function extractWatermarkBase64(base64Data, spreadFactor) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        extractWatermark(img, spreadFactor).then(resolve).catch(reject);
      };
      img.onerror = function () { reject(new Error('Failed to load image')); };
      img.src = 'data:image/png;base64,' + base64Data;
    });
  }

  return {
    embedWatermark: embedWatermark,
    extractWatermark: extractWatermark,
    embedWatermarkBase64: embedWatermarkBase64,
    extractWatermarkBase64: extractWatermarkBase64,
    generatePayload: generateWatermarkPayload,
    embedBits: embedBits,
    extractBits: extractBits,
    version: WATERMARK_VERSION
  };

})();

if (typeof window !== 'undefined') {
  window.EnclaveWatermark = EnclaveWatermark;
}
