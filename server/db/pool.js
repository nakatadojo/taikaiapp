const { Pool, types } = require('pg');

// OID 1082 = DATE column type. By default node-pg converts DATE to JS Date at
// midnight UTC, which shifts the displayed date backwards in US timezones.
// Return the raw ISO string instead (e.g. "2026-03-28") so the client can
// display it without timezone conversion.
types.setTypeParser(1082, (val) => val);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

module.exports = pool;
