require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { getDb, closeDb } = require('./connection');
const { SCHEMA } = require('./schema');

function migrate() {
  const db = getDb();
  db.exec(SCHEMA);
  console.log('Database migration completed successfully.');
  closeDb();
}

if (require.main === module) migrate();
module.exports = { migrate };
