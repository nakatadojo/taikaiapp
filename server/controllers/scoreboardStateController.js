const pool = require('../db/pool');

/**
 * GET /api/tournaments/:id/scoreboard-state
 * Returns the live scoreboard state for all mats.
 * Used by kumite/kata scoreboard displays polling for cross-device updates.
 */
async function getScoreboardState(req, res, next) {
  try {
    const { id: tournamentId } = req.params;
    const result = await pool.query(
      'SELECT scoreboard_state FROM tournaments WHERE id = $1',
      [tournamentId]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    res.json({ state: result.rows[0].scoreboard_state || {} });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/tournaments/:id/scoreboard-state
 * Persists the live scoreboard state from the operator's device.
 * Body: { state: { ...scoreboardStateObj } }
 * Called by app.js on every scoreboard update (debounced ~500ms).
 */
async function setScoreboardState(req, res, next) {
  try {
    const { id: tournamentId } = req.params;
    const { state } = req.body;

    if (!state || typeof state !== 'object') {
      return res.status(400).json({ error: 'state object is required' });
    }

    await pool.query(
      'UPDATE tournaments SET scoreboard_state = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(state), tournamentId]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tournaments/:id/staging-settings
 * Returns staging display settings (rotation interval, divisions per slide, etc.)
 */
async function getStagingSettings(req, res, next) {
  try {
    const { id: tournamentId } = req.params;
    const result = await pool.query(
      'SELECT staging_settings FROM tournaments WHERE id = $1',
      [tournamentId]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    res.json({ settings: result.rows[0].staging_settings || {} });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/tournaments/:id/staging-settings
 * Persists staging display settings.
 * Body: { settings: { rotationInterval, divisionsPerSlide, ... } }
 */
async function setStagingSettings(req, res, next) {
  try {
    const { id: tournamentId } = req.params;
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'settings object is required' });
    }

    await pool.query(
      'UPDATE tournaments SET staging_settings = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(settings), tournamentId]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getScoreboardState,
  setScoreboardState,
  getStagingSettings,
  setStagingSettings,
};
