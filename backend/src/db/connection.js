const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || './data/enclave.json';
let data = null;

function defaultData() {
  return {
    users: [],
    faceprints: [],
    voiceprints: [],
    signatures: [],
    alerts: [],
    documents: [],
    auth_attempts: [],
    scan_sessions: []
  };
}

function load() {
  if (data) return data;
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      data = JSON.parse(raw);
    } else {
      const dir = path.dirname(DB_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      data = defaultData();
      save();
    }
  } catch {
    data = defaultData();
  }
  return data;
}

function save() {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function getDb() {
  return load();
}

function closeDb() {
  if (data) save();
  data = null;
}

module.exports = { getDb, closeDb, save };
