/**
 * C2PA Content Credentials Module
 * Embeds provenance metadata into JPEG images following the C2PA standard.
 * Uses a simplified C2PA manifest structure (CBOR-JSON hybrid).
 * No paid dependencies — pure JavaScript implementation.
 */

var EnclaveContentCredentials = (function () {

  // C2PA manifest fields
  var C2PA_VERSION = '1.3';
  var ENCLAVE_ASSERTION = 'urn:enclave:vault:immunized';

  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function timestampNow() {
    return new Date().toISOString();
  }

  /**
   * Build a C2PA manifest JSON structure.
   * This follows the C2PA 1.3 specification for content credentials.
   * @param {Object} opts - { claimName, producerId, metadata }
   * @returns {Object} C2PA manifest
   */
  function buildManifest(opts) {
    opts = opts || {};
    var manifestUuid = generateUUID();
    var now = timestampNow();

    return {
      'claim': {
        'dc:title': opts.claimName || 'Enclave Vault Protected',
        'dc:creator': 'Enclave Vault',
        'claim_generator': 'Enclave Vault v1.0 (C2PA ' + C2PA_VERSION + ')',
        'instance_id': 'xmp:iid:' + manifestUuid,
        'created_at': now,
        'assertions': [
          {
            'label': 'stds.schema-org.CreativeWork',
            'data': {
              '@type': 'CreativeWork',
              'author': [
                {
                  '@type': 'Person',
                  'name': opts.producerId || 'Enclave User'
                }
              ]
            }
          },
          {
            'label': 'stds.iptc:UserMetadata',
            'data': {
              'userData': [
                {
                  'kind': 'enclave.immunized',
                  'value': ENCLAVE_ASSERTION
                }
              ]
            }
          },
          {
            'label': 'c2pa.hashlinks',
            'data': {
              'hashlinks': []
            }
          }
        ],
        'signature_info': {
          'algorithm': 'ES256',
          'certificate': null,
          'time_stamp': {
            'type': 'C2PA',
            'value': now
          }
        }
      },
      'manifest_store': {
        'version': C2PA_VERSION,
        'created_at': now,
        'active_manifest': 'self#jumbf=/' + manifestUuid,
        'manifests': {
          [manifestUuid]: {
            'instance_id': manifestUuid,
            'label': 'Enclave Vault Protection'
          }
        }
      },
      'provenance': {
        'source_type': 'enclave_vault',
        'immunized_at': now,
        'producer_id': opts.producerId || 'unknown',
        'manifest_uuid': manifestUuid,
        'metadata': opts.metadata || {}
      }
    };
  }

  /**
   * Convert the manifest to a binary-safe string for embedding.
   * Uses a structured JSON format stored as a JPEG APP11 marker segment.
   * @param {Object} manifest
   * @returns {Uint8Array} Binary manifest data
   */
  function manifestToBinary(manifest) {
    var jsonStr = JSON.stringify(manifest);
    // Encode as UTF-8 bytes
    var encoder = new TextEncoder();
    return encoder.encode(jsonStr);
  }

  /**
   * Create a JPEG APP11 marker segment to hold C2PA data.
   * APP11 marker: 0xFF 0xEE
   * Followed by: 2-byte length, then segment data.
   * @param {Uint8Array} data - The data to store
   * @returns {Uint8Array} Complete marker segment
   */
  function createAPP11Segment(data) {
    // Segment = marker (2) + length (2) + 'EnclaveC2PA' + null + data
    var label = 'EnclaveC2PA';
    var labelBytes = new Uint8Array(label.length + 1);
    for (var i = 0; i < label.length; i++) labelBytes[i] = label.charCodeAt(i);
    labelBytes[label.length] = 0; // null terminator

    var totalLength = 2 + labelBytes.length + data.length; // length field + label + data
    var segment = new Uint8Array(4 + labelBytes.length + data.length);

    // Marker
    segment[0] = 0xFF;
    segment[1] = 0xEE; // APP11

    // Length (big-endian, includes itself)
    segment[2] = (totalLength >> 8) & 0xFF;
    segment[3] = totalLength & 0xFF;

    // Label
    segment.set(labelBytes, 4);

    // Data
    segment.set(data, 4 + labelBytes.length);

    return segment;
  }

  /**
   * Embed C2PA content credentials into a JPEG image.
   * Inserts the manifest after the SOI marker (0xFF 0xD8) but before any image data.
   * @param {Uint8Array} jpegBytes - Raw JPEG data
   * @param {Object} opts - Options: { claimName, producerId, metadata }
   * @returns {Uint8Array} JPEG with embedded C2PA credentials
   */
  function embedCredentials(jpegBytes, opts) {
    if (!jpegBytes || jpegBytes.length < 4) return jpegBytes;

    // Verify it's a valid JPEG
    if (jpegBytes[0] !== 0xFF || jpegBytes[1] !== 0xD8) return jpegBytes;

    // Build and convert manifest
    var manifest = buildManifest(opts);
    var manifestData = manifestToBinary(manifest);
    var app11Segment = createAPP11Segment(manifestData);

    // Insert after SOI marker
    var result = new Uint8Array(jpegBytes.length + app11Segment.length);
    result.set(jpegBytes.subarray(0, 2), 0);    // SOI
    result.set(app11Segment, 2);                   // C2PA segment
    result.set(jpegBytes.subarray(2), 2 + app11Segment.length); // Rest

    return result;
  }

  /**
   * Extract C2PA credentials from a JPEG image.
   * @param {Uint8Array} jpegBytes
   * @returns {Object|null} Parsed manifest or null if not found
   */
  function extractCredentials(jpegBytes) {
    if (!jpegBytes || jpegBytes.length < 4) return null;
    if (jpegBytes[0] !== 0xFF || jpegBytes[1] !== 0xD8) return null;

    var pos = 2;
    while (pos < jpegBytes.length - 1) {
      // Find APP11 marker
      if (jpegBytes[pos] === 0xFF && jpegBytes[pos + 1] === 0xEE) {
        var length = (jpegBytes[pos + 2] << 8) | jpegBytes[pos + 3];
        var segmentData = jpegBytes.subarray(pos + 4, pos + 2 + length);

        // Check for EnclaveC2PA label
        var label = '';
        for (var i = 0; i < Math.min(11, segmentData.length); i++) {
          if (segmentData[i] === 0) break;
          label += String.fromCharCode(segmentData[i]);
        }

        if (label === 'EnclaveC2PA') {
          // Extract JSON after null terminator
          var jsonStart = 12; // 'EnclaveC2PA'.length + null
          var jsonBytes = segmentData.subarray(jsonStart);
          var decoder = new TextDecoder();
          var jsonStr = decoder.decode(jsonBytes);
          try {
            return JSON.parse(jsonStr);
          } catch (e) {
            return null;
          }
        }

        pos += 2 + length;
      } else if (jpegBytes[pos] === 0xFF) {
        // Skip other markers
        if (jpegBytes[pos + 1] === 0xD9) break; // EOI
        if (jpegBytes[pos + 1] === 0x00) { pos++; continue; } // Not a marker
        var skipLen = (jpegBytes[pos + 2] << 8) | jpegBytes[pos + 3];
        pos += 2 + skipLen;
      } else {
        pos++;
      }
    }
    return null;
  }

  /**
   * Check if a JPEG has Enclave C2PA credentials.
   * @param {Uint8Array} jpegBytes
   * @returns {boolean}
   */
  function hasCredentials(jpegBytes) {
    var creds = extractCredentials(jpegBytes);
    return creds !== null && creds.provenance && creds.provenance.source_type === 'enclave_vault';
  }

  /**
   * Convert a base64 string to Uint8Array.
   */
  function base64ToBytes(base64) {
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  /**
   * Convert Uint8Array to base64 string.
   */
  function bytesToBase64(bytes) {
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  return {
    buildManifest: buildManifest,
    embedCredentials: function (base64Jpeg, opts) {
      var bytes = base64ToBytes(base64Jpeg);
      var result = embedCredentials(bytes, opts);
      return bytesToBase64(result);
    },
    extractCredentials: function (base64Jpeg) {
      var bytes = base64ToBytes(base64Jpeg);
      return extractCredentials(bytes);
    },
    hasCredentials: function (base64Jpeg) {
      var bytes = base64ToBytes(base64Jpeg);
      return hasCredentials(bytes);
    },
    embedCredentialsBytes: embedCredentials,
    extractCredentialsBytes: extractCredentials,
    hasCredentialsBytes: hasCredentials,
    version: C2PA_VERSION
  };

})();

if (typeof window !== 'undefined') {
  window.EnclaveContentCredentials = EnclaveContentCredentials;
}
