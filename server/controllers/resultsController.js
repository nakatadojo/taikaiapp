const ResultsQueries = require('../db/queries/results');
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

    const results = await ResultsQueries.getPublished(tournamentId);
    res.json({ results });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/tournaments/:id/results/:resultId/publish
 */
async function publishDivision(req, res, next) {
  try {
    const { resultId } = req.params;
    const result = await ResultsQueries.publish(resultId, req.user.id);

    if (!result) return res.status(404).json({ error: 'Result not found' });
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
