const pool = require('../pool');

async function getAll(tournamentId) {
  const { rows } = await pool.query(
    `SELECT id, tournament_id, event_id, division_name, bracket_type,
            data, version, published, created_at, updated_at
     FROM tournament_brackets
     WHERE tournament_id = $1
     ORDER BY division_name`,
    [tournamentId]
  );
  return rows;
}

async function getOne(tournamentId, bracketId) {
  const { rows } = await pool.query(
    `SELECT id, tournament_id, event_id, division_name, bracket_type,
            data, version, published, created_at, updated_at
     FROM tournament_brackets
     WHERE tournament_id = $1 AND id = $2`,
    [tournamentId, bracketId]
  );
  return rows[0] || null;
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
       (id, tournament_id, event_id, division_name, bracket_type, data, version, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 1, NOW())
     ON CONFLICT (id)
     DO UPDATE SET
       bracket_type = EXCLUDED.bracket_type,
       data = EXCLUDED.data,
       version = tournament_brackets.version + 1,
       updated_at = NOW()
     RETURNING *`,
    [id, tournamentId, eventId, divisionName, bracketType, JSON.stringify(data)]
  );
  return rows[0];
}

/**
 * Upsert a single bracket with optimistic locking.
 *
 * clientVersion = 0 means "I have never synced this bracket — treat as new".
 * For new brackets the INSERT fires unconditionally.
 * For existing brackets the UPDATE only fires when the stored version matches
 * clientVersion, preventing a stale device from overwriting a fresher write.
 *
 * Returns { row, conflict }:
 *   conflict = false  → write succeeded, row is the new/updated bracket row
 *   conflict = true   → version mismatch, row is the current server bracket
 */
async function upsertWithVersion({ id, tournamentId, eventId, divisionName, bracketType, data, clientVersion }) {
  const cv = typeof clientVersion === 'number' ? clientVersion : 0;

  const { rows } = await pool.query(
    `INSERT INTO tournament_brackets
       (id, tournament_id, event_id, division_name, bracket_type, data, version, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 1, NOW())
     ON CONFLICT (id)
     DO UPDATE SET
       bracket_type = EXCLUDED.bracket_type,
       data         = EXCLUDED.data,
       version      = tournament_brackets.version + 1,
       updated_at   = NOW()
     WHERE tournament_brackets.version = $7
     RETURNING *`,
    [id, tournamentId, eventId, divisionName, bracketType, JSON.stringify(data), cv]
  );

  if (rows.length > 0) return { row: rows[0], conflict: false };

  // 0 rows → version mismatch (or an extremely unlikely concurrent insert race).
  // Fetch the current server version to return in the 409.
  const { rows: current } = await pool.query(
    `SELECT * FROM tournament_brackets WHERE id = $1 AND tournament_id = $2`,
    [id, tournamentId]
  );
  return { row: current[0] || null, conflict: true };
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

/**
 * Append one match result to the audit log.
 * Fire-and-forget from the controller — never blocks the response.
 */
async function logMatchResult({ tournamentId, bracketId, matchId, winnerId, winnerName, loserId, loserName, divisionName, eventId, scoreboardType, method, winNote, scores, matId }) {
  await pool.query(
    `INSERT INTO match_results
       (tournament_id, bracket_id, match_id, winner_id, winner_name, loser_id, loser_name,
        division_name, event_id, scoreboard_type, method, win_note, scores, mat_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      tournamentId, bracketId, matchId || null,
      winnerId || null, winnerName || null,
      loserId || null, loserName || null,
      divisionName || null, eventId ? String(eventId) : null,
      scoreboardType || null, method || null, winNote || null,
      scores ? JSON.stringify(scores) : null,
      matId ? String(matId) : null,
    ]
  );
}

module.exports = {
  getAll, getOne, getAllPublished,
  upsert, upsertWithVersion, bulkUpsert,
  setPublished, setAllPublished,
  remove, logMatchResult,
};
