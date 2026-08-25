const { getEngine } = require('./adapter');

let engine = null;

async function getTable(name) {
  if (!engine) engine = await getEngine();
  return engine.table(name);
}

module.exports = { table: getTable };
