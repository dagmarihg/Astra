const { Pool } = require('pg');
const config = require('../src/config');

console.log('[CONNECTION] Creating pool with database config:', {
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
});

const poolConfig = {
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
};

// Only add password if it's not empty
if (config.db.password && config.db.password.trim()) {
  poolConfig.password = config.db.password;
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = pool;
