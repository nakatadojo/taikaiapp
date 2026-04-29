const ResultsQueries = require('../db/queries/results');
const PlacementQueries = require('../db/queries/placements');
const pool = require('../db/pool');

/**
 * POST /api/tournaments/:id/results/sync
 * Director pushes localStorage results to server. Upserts all divisions.
 * Body: { divisions: [{ eventName, divisionName, results: [{rank, name, club, score?}] }] }
 */
async function syncResults(req, res, next) {
  try {
    const { id: tournamentId } = req.params;
    const { divisions } = req.body;

    if (!Array.isArray(divisions) || divisions.length === 0) {
      return res.status(400).json({ error: 'divisions array is required' });
    }

    // Verify tournament ownership
    const t = await pool.query(
      'SELECT id, created_by FROM tournaments WHERE id = $1',
      [tournamentId]
    );
    if (!t.rows[0]) return res.status(404).json({ error: 'Tournament not found' });
    if (t.rows[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const results = await ResultsQueries.bulkUpsert(tournamentId, divisions);
    const counts = await ResultsQueries.getCounts(tournamentId);

    res.json({
      message: `Synced ${results.length} division(s)`,
      counts,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tournaments/:id/results
 * Director view — all results with status.
 */
async function getResults(req, res, next) {
  try {
    const { id: tournamentId } = req.params;

    const results = await ResultsQueries.getByTournament(tournamentId);
    const counts = await ResultsQueries.getCounts(tournamentId);

    res.json({ results, counts });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tournaments/:id/results/public
 * Public view — only published results.
 */
async function getPublicResults(req, res, next) {
  try {
    const { id: tournamentId } = req.params;

    // Validate UUID to prevent a PostgreSQL cast error (500) on bad input
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tournamentId)) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const results = await ResultsQueries.getPublished(tournamentId);
    res.json({ results });
  } catch (err) {
    next(err);
  }
}

/**
 * Helper — load point rules for a tournament, returns [] if none set.
 */
async function _getRules(tournamentId) {
  try {
    return await PlacementQueries.getRules(tournamentId);
  } catch (_) {
    return [];
  }
}

/**
 * PUT /api/tournaments/:id/results/:resultId/publish
 */
async function publishDivision(req, res, next) {
  try {
    const { id: tournamentId, resultId } = req.params;
    const result = await ResultsQueries.publish(resultId, req.user.id);

    if (!result) return res.status(404).json({ error: 'Result not found' });

    // Sync placements for the leaderboard (fire-and-forget)
    _getRules(tournamentId).then(rules =>
      PlacementQueries.syncForResult(
        tournamentId,
        result.id,
        result.event_name,
        result.division_name,
        result.results_data,
        rules
      )
    ).catch(e => console.warn('[leaderboard] syncForResult failed:', e.message));

    res.json({ result });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/tournaments/:id/results/:resultId/unpublish
 */
async function unpublishDivision(req, res, next) {
  try {
    const { resultId } = req.params;
    const result = await ResultsQueries.unpublish(resultId);

    if (!result) return res.status(404).json({ error: 'Result not found' });

    // Remove placement rows so they are excluded from leaderboard
    PlacementQueries.removeForResult(resultId)
      .catch(e => console.warn('[leaderboard] removeForResult failed:', e.message));

    res.json({ result });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/tournaments/:id/results/publish-all
 */
async function bulkPublish(req, res, next) {
  try {
    const { id: tournamentId } = req.params;
    const results = await ResultsQueries.bulkPublish(tournamentId, req.user.id);
    const counts = await ResultsQueries.getCounts(tournamentId);

    // Sync all placements (fire-and-forget)
    if (results.length > 0) {
      _getRules(tournamentId).then(rules => {
        return Promise.all(results.map(r =>
          PlacementQueries.syncForResult(
            tournamentId, r.id, r.event_name, r.division_name, r.results_data, rules
          )
        ));
      }).catch(e => console.warn('[leaderboard] bulkPublish sync failed:', e.message));
    }

    res.json({
      message: `Published ${results.length} division(s)`,
      counts,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/tournaments/:id/results/unpublish-all
 */
async function bulkUnpublish(req, res, next) {
  try {
    const { id: tournamentId } = req.params;
    const results = await ResultsQueries.bulkUnpublish(tournamentId);
    const counts = await ResultsQueries.getCounts(tournamentId);

    // Remove all placements for this tournament
    if (results.length > 0) {
      pool.query(
        'DELETE FROM competitor_placements WHERE tournament_id = $1',
        [tournamentId]
      ).catch(e => console.warn('[leaderboard] bulkUnpublish clear failed:', e.message));
    }

    res.json({
      message: `Unpublished ${results.length} division(s)`,
      counts,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  syncResults,
  getResults,
  getPublicResults,
  publishDivision,
  unpublishDivision,
  bulkPublish,
  bulkUnpublish,
};
