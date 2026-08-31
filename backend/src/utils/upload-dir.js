const fs = require('fs');
const os = require('os');
const path = require('path');

function ensureWritable(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return dir;
  } catch (e) {
    return null;
  }
}

const configured = process.env.UPLOAD_DIR || './uploads';
const fallback = ensureWritable(path.join(os.tmpdir(), 'enclave-uploads'));
const UPLOAD_DIR = ensureWritable(path.resolve(configured)) || fallback || './uploads';

// Ensure all required subdirectories exist
const SUBDIRS = ['faces', 'voices', 'signatures', 'temp', 'pdfs', 'evidence', 'takedowns', 'misc'];
for (const sub of SUBDIRS) {
  ensureWritable(path.join(UPLOAD_DIR, sub));
}

module.exports = { UPLOAD_DIR };
