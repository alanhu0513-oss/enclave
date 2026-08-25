const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: 'postgresql://enclave:enclave_pass@localhost:5432/enclave',
});

async function migrate() {
  const data = JSON.parse(fs.readFileSync('./data/enclave.json', 'utf-8'));
  const tables = ['users', 'faceprints', 'voiceprints', 'signatures', 'alerts', 'documents', 'auth_attempts', 'scan_sessions'];

  for (const table of tables) {
    const rows = data[table] || [];
    if (rows.length === 0) continue;

    for (const row of rows) {
      const cols = Object.keys(row);
      const vals = cols.map(c => row[c]);
      const ph = vals.map((_, i) => `$${i + 1}`).join(', ');
      try {
        await pool.query(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${ph}) ON CONFLICT DO NOTHING`, vals);
      } catch (e) {
        console.error(`[${table}] ${e.message}`);
      }
    }
    console.log(`  ${rows.length} rows -> ${table}`);
  }

  console.log('Migration complete');
  await pool.end();
}

migrate().catch(console.error);
