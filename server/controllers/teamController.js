const pool = require('../db/pool');
const TeamQueries = require('../db/queries/teams');

async function getTeams(req, res, next) {
  try {
    const rows = await TeamQueries.getByTournament(req.params.id);
    // Convert DB rows to client-compatible format keyed by team_code
    const teams = {};
    for (const row of rows) {
      teams[row.team_code] = {
        code: row.team_code,
        name: row.team_name,
        eventId: row.event_id,
        members: row.members || [],
      };
    }
    res.json({ teams });
  } catch (err) { next(err); }
}

async function syncTeams(req, res, next) {
  try {
    const tournamentId = req.params.id;
    const { teams } = req.body;

    // Verify tournament ownership
    const t = await pool.query('SELECT created_by FROM tournaments WHERE id = $1', [tournamentId]);
    if (!t.rows[0]) return res.status(404).json({ error: 'Tournament not found' });
    if (t.rows[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Convert from { code: teamObj } map to array
    const teamArray = Object.values(teams || {});
    if (teamArray.length === 0) {
      // Delete all teams for this tournament
      await TeamQueries.sync(tournamentId, []);
      return res.json({ message: 'Teams cleared', count: 0 });
    }

    const results = await TeamQueries.sync(tournamentId, teamArray);
    res.json({ message: `Synced ${results.length} team(s)`, count: results.length });
  } catch (err) { next(err); }
}

module.exports = { getTeams, syncTeams };
