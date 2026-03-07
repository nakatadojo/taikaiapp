const pool = require('../pool');

async function get(tournamentId) {
  const { rows } = await pool.query(
    `SELECT generated_divisions FROM tournaments WHERE id = $1`,
    [tournamentId]
  );
  return rows[0]?.generated_divisions || {};
}

async function upsert(tournamentId, generatedDivisions) {
  const { rows } = await pool.query(
    `UPDATE tournaments
     SET generated_divisions = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING generated_divisions`,
    [tournamentId, JSON.stringify(generatedDivisions || {})]
  );
  return rows[0];
}

async function upsertTemplates(eventId, criteriaTemplates) {
  const { rows } = await pool.query(
    `UPDATE tournament_events
     SET criteria_templates = $2
     WHERE id = $1
     RETURNING id, criteria_templates`,
    [eventId, JSON.stringify(criteriaTemplates || [])]
  );
  return rows[0];
}

module.exports = { get, upsert, upsertTemplates };
