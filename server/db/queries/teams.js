const pool = require('../pool');

/**
 * Get all teams for a tournament.
 */
async function getByTournament(tournamentId) {
  const { rows } = await pool.query(
    `SELECT id, tournament_id, event_id, team_code, team_name, members,
            created_at, updated_at
     FROM tournament_teams
     WHERE tournament_id = $1
     ORDER BY team_name`,
    [tournamentId]
  );
  return rows;
}

/**
 * Bulk sync teams for a tournament.
 * Deletes teams not in the incoming array, upserts the rest.
 * Runs in a transaction for consistency.
 *
 * @param {string} tournamentId - UUID of the tournament
 * @param {Array} teams - Array of team objects from the client
 *   Each team: { code, name, eventId, members, maxSize, captainName, ... }
 */
async function sync(tournamentId, teams) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get incoming team codes
    const incomingCodes = (teams || []).map(t => t.code);

    // Delete teams that are no longer in the client data
    if (incomingCodes.length > 0) {
      await client.query(
        `DELETE FROM tournament_teams
         WHERE tournament_id = $1
           AND team_code != ALL($2::text[])`,
        [tournamentId, incomingCodes]
      );
    } else {
      // No teams in client — delete all for this tournament
      await client.query(
        `DELETE FROM tournament_teams WHERE tournament_id = $1`,
        [tournamentId]
      );
    }

    // Upsert each team
    const results = [];
    for (const team of (teams || [])) {
      const { rows } = await client.query(
        `INSERT INTO tournament_teams
           (tournament_id, event_id, team_code, team_name, members, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (tournament_id, team_code)
         DO UPDATE SET
           event_id = EXCLUDED.event_id,
           team_name = EXCLUDED.team_name,
           members = EXCLUDED.members,
           updated_at = NOW()
         RETURNING *`,
        [
          tournamentId,
          team.eventId || null,
          team.code,
          team.name,
          JSON.stringify(team.members || []),
        ]
      );
      results.push(rows[0]);
    }

    await client.query('COMMIT');
    return results;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get teams for a specific event (public, no auth).
 * Used by the registration page to show joinable teams.
 */
async function getByEvent(tournamentId, eventId) {
  const { rows } = await pool.query(
    `SELECT team_code, team_name, members
     FROM tournament_teams
     WHERE tournament_id = $1
       AND event_id = $2
     ORDER BY team_name`,
    [tournamentId, eventId]
  );
  return rows;
}

module.exports = { getByTournament, getByEvent, sync };
