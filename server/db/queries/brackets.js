const pool = require('../pool');

async function getAll(tournamentId) {
  const { rows } = await pool.query(
    `SELECT id, tournament_id, event_id, division_name, bracket_type,
            data, published, created_at, updated_at
     FROM tournament_brackets
     WHERE tournament_id = $1
     ORDER BY division_name`,
    [tournamentId]
  );
  return rows;
}

async function getAllPublished(tournamentId) {
  const { rows } = await pool.query(
    `SELECT id, event_id, division_name, bracket_type, data
     FROM tournament_brackets
     WHERE tournament_id = $1 AND published = true
     ORDER BY division_name`,
    [tournamentId]
  );
  return rows;
}

async function upsert({ id, tournamentId, eventId, divisionName, bracketType, data }) {
  const { rows } = await pool.query(
    `INSERT INTO tournament_brackets
       (id, tournament_id, event_id, division_name, bracket_type, data, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (id)
     DO UPDATE SET
       bracket_type = EXCLUDED.bracket_type,
       data = EXCLUDED.data,
       updated_at = NOW()
     RETURNING *`,
    [id, tournamentId, eventId, divisionName, bracketType, JSON.stringify(data)]
  );
  return rows[0];
}

async function bulkUpsert(tournamentId, brackets) {
  const results = [];
  for (const b of brackets) {
    const row = await upsert({
      id: b.id || `${b.eventId}_${(b.divisionName || b.division || '').replace(/[^a-zA-Z0-9]/g, '_')}`,
      tournamentId,
      eventId: String(b.eventId || ''),
      divisionName: b.divisionName || b.division || '',
      bracketType: b.type || 'single-elimination',
      data: b,
    });
    results.push(row);
  }
  return results;
}

async function setPublished(tournamentId, bracketId, published) {
  const { rows } = await pool.query(
    `UPDATE tournament_brackets
     SET published = $3, updated_at = NOW()
     WHERE id = $1 AND tournament_id = $2
     RETURNING id, published`,
    [bracketId, tournamentId, published]
  );
  return rows[0] || null;
}

async function setAllPublished(tournamentId, published) {
  const { rows } = await pool.query(
    `UPDATE tournament_brackets
     SET published = $2, updated_at = NOW()
     WHERE tournament_id = $1
     RETURNING id, published`,
    [tournamentId, published]
  );
  return rows;
}

async function remove(tournamentId, bracketId) {
  const { rows } = await pool.query(
    `DELETE FROM tournament_brackets
     WHERE id = $1 AND tournament_id = $2
     RETURNING id`,
    [bracketId, tournamentId]
  );
  return rows[0] || null;
}

module.exports = { getAll, getAllPublished, upsert, bulkUpsert, setPublished, setAllPublished, remove };
