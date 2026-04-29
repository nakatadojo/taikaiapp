/**
 * Set the currency for SHITO KAI 40 ANIVERSARIO tournament to MXN.
 * Run: node scripts/set-tournament-currency.js
 */
require('dotenv').config();
const pool = require('../server/db/pool');

const TOURNAMENT_ID = 'e42eeb54-8258-41cc-b898-42e42c330abf';

async function main() {
  const result = await pool.query(
    `UPDATE tournaments SET currency = 'MXN' WHERE id = $1 RETURNING id, name, currency`,
    [TOURNAMENT_ID]
  );
  if (result.rows[0]) {
    console.log(`✓ Updated: ${result.rows[0].name} → currency = ${result.rows[0].currency}`);
  } else {
    console.warn('✗ Tournament not found:', TOURNAMENT_ID);
  }
  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); process.exit(1); });
