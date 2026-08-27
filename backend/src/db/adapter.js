/* ─── Enclave Database Adapter ───
 * PostgreSQL primary, JSON fallback.
 * Set DATABASE_URL=postgresql://... for PostgreSQL.
 * Falls back to JSON file storage if PG is unavailable.
 */

const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = process.env.DATABASE_PATH || './data/enclave.json';

// ─── JSON Engine ───
function createJsonEngine() {
  let data = null;
  function load() {
    if (data) return data;
    try {
      if (fs.existsSync(DB_PATH)) {
        data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
      } else {
        const dir = path.dirname(DB_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        data = emptyData(); save();
      }
    } catch { data = emptyData(); }
    return data;
  }
  function save() { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }
  function emptyData() { return { users:[], faceprints:[], voiceprints:[], signatures:[], alerts:[], documents:[], auth_attempts:[], scan_sessions:[], notifications:[], takedowns:[], usage_tracking:[], referrals:[], referral_redemptions:[], email_digests:[], threat_shares:[], threat_votes:[], forum_posts:[], forum_votes:[], otdb_api_keys:[], webhooks:[], white_label:[], sso_configurations:[], sso_states:[], reports:[], report_schedules:[], partners:[], partner_conversions:[], family_members:[] }; }

  function match(row, conditions) {
    if (!conditions) return true;
    return Object.keys(conditions).every(k => row[k] === conditions[k]);
  }

  return {
    engine: 'json',
    async query() { throw new Error('JSON engine does not support SQL queries'); },
    async table(name) {
      const db = load();
      if (!db[name]) db[name] = [];
      const tbl = db[name];
      return {
        all: async () => [...tbl],
        find: async (conditions) => tbl.find(r => match(r, conditions)) || null,
        filter: async (conditions) => tbl.filter(r => match(r, conditions)),
        insert: async (row) => { tbl.push(row); save(); return row; },
        update: async (conditions, updates) => {
          const idx = tbl.findIndex(r => match(r, conditions));
          if (idx === -1) return null;
          Object.assign(tbl[idx], updates);
          save();
          return tbl[idx];
        },
        remove: async (conditions) => {
          const before = tbl.length;
          for (let i = tbl.length - 1; i >= 0; i--) { if (match(tbl[i], conditions)) tbl.splice(i, 1); }
          save();
          return before - tbl.length;
        },
        count: async (conditions) => conditions ? tbl.filter(r => match(r, conditions)).length : tbl.length
      };
    },
    async ensureTables() {},
    async close() { save(); data = null; }
  };
}

// ─── PostgreSQL Engine ───
function createPgEngine() {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000
  });

  pool.on('error', (err) => console.error('[DB] PostgreSQL pool error:', err.message));

  function whereClause(conditions, startIdx = 1) {
    if (!conditions || !Object.keys(conditions).length) return { clause: '', values: [] };
    const keys = Object.keys(conditions);
    const clause = 'WHERE ' + keys.map((k, i) => `${k} = $${startIdx + i}`).join(' AND ');
    const values = keys.map(k => conditions[k]);
    return { clause, values };
  }

  function setClause(updates, startIdx = 1) {
    const keys = Object.keys(updates);
    const clause = keys.map((k, i) => `${k} = $${startIdx + i}`).join(', ');
    return { clause, values: keys.map(k => updates[k]) };
  }

  function rawQuery(text, params) {
    return pool.query(text, params);
  }

  return {
    engine: 'postgres',
    async query(text, params) {
      const client = await pool.connect();
      try { return (await client.query(text, params)).rows; }
      finally { client.release(); }
    },
    async execute(text, params) {
      const client = await pool.connect();
      try { return (await client.query(text, params)).rowCount || 0; }
      finally { client.release(); }
    },
    async table(name) {
      return {
        all: async () => this.query(`SELECT * FROM ${name}`),
        find: async (conditions) => {
          const wc = whereClause(conditions);
          const rows = await this.query(`SELECT * FROM ${name} ${wc.clause} LIMIT 1`, wc.values);
          return rows[0] || null;
        },
        filter: async (conditions) => {
          const wc = whereClause(conditions);
          return this.query(`SELECT * FROM ${name} ${wc.clause}`, wc.values);
        },
        insert: async (row) => {
          const cols = Object.keys(row);
          const vals = cols.map(c => row[c]);
          const ph = vals.map((_, i) => `$${i + 1}`).join(', ');
          const rows = await this.query(`INSERT INTO ${name} (${cols.join(', ')}) VALUES (${ph}) RETURNING *`, vals);
          return rows[0];
        },
        update: async (conditions, updates) => {
          const wc = whereClause(conditions, Object.keys(updates).length + 1);
          if (!wc.clause) return null;
          const sc = setClause(updates);
          const rows = await this.query(`UPDATE ${name} SET ${sc.clause} ${wc.clause} RETURNING *`, [...sc.values, ...wc.values]);
          return rows[0] || null;
        },
        remove: async (conditions) => {
          const wc = whereClause(conditions);
          return this.execute(`DELETE FROM ${name} ${wc.clause}`, wc.values);
        },
        count: async (conditions) => {
          const wc = whereClause(conditions);
          const rows = await this.query(`SELECT COUNT(*) as count FROM ${name} ${wc.clause}`, wc.values);
          return parseInt(rows[0].count);
        }
      };
    },
    async ensureTables() {
      const initSql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf-8');
      const statements = initSql.split(';').filter(s => s.trim());
      for (const stmt of statements) {
        try { await this.query(stmt); } catch (e) { console.warn('[DB] Schema:', e.message); }
      }
      console.log('[DB] PostgreSQL schema ensured');
    },
    async close() { await pool.end(); }
  };
}

// ─── Engine selection ───
let engine = null;
let enginePromise = null;

async function getEngine() {
  if (engine) return engine;
  if (enginePromise) return enginePromise;

  const url = process.env.DATABASE_URL || '';
  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
    enginePromise = (async () => {
      try {
        const pg = createPgEngine();
        await pg.ensureTables();
        console.log('[DB] Connected to PostgreSQL');
        engine = pg;
        return pg;
      } catch (e) {
        console.warn('[DB] PostgreSQL failed:', e.message);
        console.warn('[DB] Falling back to JSON storage');
        engine = createJsonEngine();
        return engine;
      }
    })();
  } else {
    engine = createJsonEngine();
    enginePromise = Promise.resolve(engine);
  }
  return enginePromise;
}

function resetEngine() { engine = null; enginePromise = null; }

module.exports = { getEngine, resetEngine };
