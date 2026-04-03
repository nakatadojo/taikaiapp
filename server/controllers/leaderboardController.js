const pool = require('../db/pool');
const PlacementQueries = require('../db/queries/placements');

// ── Point Rules ─────────────────────────────────────────────────────────────

/**
 * GET /api/tournaments/:id/leaderboard/rules
 * Director: fetch point rules.
 */
async function getRules(req, res, next) {
  try {
    const rules = await PlacementQueries.getRules(req.params.id);
    res.json({ rules });
  } catch (err) { next(err); }
}

/**
 * PUT /api/tournaments/:id/leaderboard/rules
 * Director: replace point rules.
 * Body: { rules: [{ placement, points, medal? }] }
 *
 * Typical default set (auto-applied if body is empty):
 *   1st → 9 pts (gold), 2nd → 3 pts (silver), 3rd → 1 pt (bronze)
 */
async function setRules(req, res, next) {
  try {
    const tournamentId = req.params.id;
    let { rules } = req.body;

    if (!Array.isArray(rules)) {
      return res.status(400).json({ error: 'rules array is required' });
    }

    // Validate each rule
    for (const r of rules) {
      if (!Number.isInteger(r.placement) || r.placement < 1) {
        return res.status(400).json({ error: `Invalid placement: ${r.placement}` });
      }
      if (typeof r.points !== 'number' || r.points < 0) {
        return res.status(400).json({ error: `Invalid points for placement ${r.placement}` });
      }
    }

    const saved = await PlacementQueries.setRules(tournamentId, rules);

    // Re-calculate all existing published placements with new rules
    _recalcPlacements(tournamentId, saved).catch(e =>
      console.warn('[leaderboard] recalc failed:', e.message)
    );

    res.json({ rules: saved });
  } catch (err) { next(err); }
}

/**
 * Re-syncs all published results for a tournament using updated rules.
 * Fire-and-forget — called after setRules.
 */
async function _recalcPlacements(tournamentId, rules) {
  const { rows } = await pool.query(
    `SELECT id, event_name, division_name, results_data
     FROM published_results
     WHERE tournament_id = $1 AND status = 'published'`,
    [tournamentId]
  );
  for (const row of rows) {
    await PlacementQueries.syncForResult(
      tournamentId,
      row.id,
      row.event_name,
      row.division_name,
      row.results_data,
      rules
    );
  }
}

// ── Leaderboard ─────────────────────────────────────────────────────────────

/**
 * GET /api/tournaments/:id/leaderboard
 * Public: individual competitor leaderboard.
 */
async function getLeaderboard(req, res, next) {
  try {
    // Validate UUID to prevent a PostgreSQL cast error (500) on bad input
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    const rows = await PlacementQueries.getLeaderboard(req.params.id);
    res.json({ leaderboard: rows });
  } catch (err) { next(err); }
}

/**
 * GET /api/tournaments/:id/leaderboard/clubs
 * Public: club/academy medal tally.
 */
async function getClubTally(req, res, next) {
  try {
    // Validate UUID to prevent a PostgreSQL cast error (500) on bad input
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    const rows = await PlacementQueries.getClubTally(req.params.id);
    res.json({ tally: rows });
  } catch (err) { next(err); }
}

module.exports = { getRules, setRules, getLeaderboard, getClubTally };
