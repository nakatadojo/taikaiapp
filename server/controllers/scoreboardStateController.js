const pool = require('../db/pool');
const { broadcastScoreboardUpdate } = require('../websocket');

/**
 * GET /api/tournaments/:id/scoreboard-state
 * Returns the live scoreboard state.
 * Optional query param: ?ring=N — returns only that ring's state.
 * Without ?ring, returns the full stored state (backward-compatible).
 */
async function getScoreboardState(req, res, next) {
  try {
    const { id: tournamentId } = req.params;
    const ringParam = req.query.ring != null ? String(req.query.ring) : null;

    const result = await pool.query(
      'SELECT scoreboard_state FROM tournaments WHERE id = $1',
      [tournamentId]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const fullState = result.rows[0].scoreboard_state || {};

    if (ringParam !== null) {
      // Return only the state for the requested ring.
      // Per-ring state is stored under fullState._rings[ringKey].
      const ringKey = `ring${ringParam}`;
      const ringState = (fullState._rings && fullState._rings[ringKey]) || null;
      return res.json({ state: ringState || {} });
    }

    // No ring filter — return full state (backward-compatible)
    res.json({ state: fullState });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/tournaments/:id/scoreboard-state
 * Persists the live scoreboard state from the operator's device.
 * Body: { state: { ...scoreboardStateObj } }
 * If state.ring is set, the state is stored per-ring under _rings.ring{N}
 * so multiple mats can have independent live states.
 * Without state.ring, stored as-is (backward-compatible flat state).
 */
async function setScoreboardState(req, res, next) {
  try {
    const { id: tournamentId } = req.params;
    const { state } = req.body;

    if (!state || typeof state !== 'object') {
      return res.status(400).json({ error: 'state object is required' });
    }

    // Reject flat-state updates (state.ring not set) — they would overwrite the
    // entire scoreboard_state column and wipe every other mat's live data.
    // All operator paths must supply a ring ID before calling this endpoint.
    if (state.ring == null) {
      return res.status(400).json({
        error: 'state.ring is required. Flat-state writes are rejected to prevent wiping other mats.',
      });
    }

    if (state.ring != null) {
      // Per-ring atomic update using jsonb_set.
      // PostgreSQL's jsonb_set with a two-level path (e.g. ['_rings','ring1']) only
      // sets the nested key if the intermediate key '_rings' already exists — it does
      // NOT recursively create missing intermediate objects.  We therefore ensure
      // '_rings' exists first via a CASE expression before calling jsonb_set.
      const ringKey = `ring${state.ring}`;
      const result = await pool.query(
        `UPDATE tournaments
         SET scoreboard_state = jsonb_set(
               CASE
                 WHEN COALESCE(scoreboard_state, '{}'::jsonb) ? '_rings'
                 THEN COALESCE(scoreboard_state, '{}'::jsonb)
                 ELSE COALESCE(scoreboard_state, '{}'::jsonb) || '{"_rings":{}}'::jsonb
               END,
               ARRAY['_rings', $1::text],
               $2::jsonb,
               true
             ),
             updated_at = NOW()
         WHERE id = $3
         RETURNING id`,
        [ringKey, JSON.stringify(state), tournamentId]
      );
      if (!result.rows[0]) {
        return res.status(404).json({ error: 'Tournament not found' });
      }
      // Broadcast to all display clients subscribed to this ring's channel
      broadcastScoreboardUpdate(tournamentId, state.ring, state);
    } else {
      // Flat / legacy state — store directly (no ring isolation)
      const result = await pool.query(
        'UPDATE tournaments SET scoreboard_state = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
        [JSON.stringify(state), tournamentId]
      );
      if (!result.rows[0]) {
        return res.status(404).json({ error: 'Tournament not found' });
      }
    }

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
