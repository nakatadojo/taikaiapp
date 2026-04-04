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

/**
 * GET /api/tournaments/:id/teams/public?eventId=xxx&name=yyy
 * Public (no auth) — returns teams for an event so registrants can search.
 * Optional ?name= does a case-insensitive substring filter.
 */
async function listTeamsPublic(req, res, next) {
  try {
    const { eventId, name } = req.query;
    if (!eventId) {
      return res.status(400).json({ error: 'eventId query param is required' });
    }
    const rows = await TeamQueries.getByEvent(req.params.id, eventId);

    let filtered = rows;
    if (name && name.trim()) {
      const q = name.trim().toLowerCase();
      filtered = rows.filter(r => r.team_name.toLowerCase().includes(q));
    }

    const teams = filtered.map(r => ({
      id: r.id,
      code: r.team_code,
      name: r.team_name,
      memberCount: Array.isArray(r.members) ? r.members.length : 0,
    }));

    res.json({ teams });
  } catch (err) { next(err); }
}

module.exports = { getTeams, syncTeams, listTeamsPublic };
