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
      const ringKey   = `ring${ringParam}`;
      const ringState = (fullState._rings && fullState._rings[ringKey]) || null;
      return res.json({ state: ringState || {} });
    }

    res.json({ state: fullState });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/tournaments/:id/scoreboard-state
 * Persists the live scoreboard state from the operator's device.
 * Body: { state: { ...scoreboardStateObj } }
 * If state.ring is set, the state is stored per-ring under _rings.ring{N}.
 * Without state.ring, rejected (prevents wiping other mats' live data).
 *
 * Also injects last_updated_at / last_updated_by into the stored JSONB so
 * display pages and the audit UI can surface staleness information.
 */
async function setScoreboardState(req, res, next) {
  try {
    const { id: tournamentId } = req.params;
    const { state } = req.body;

    if (!state || typeof state !== 'object') {
      return res.status(400).json({ error: 'state object is required' });
    }

    if (state.ring == null) {
      return res.status(400).json({
        error: 'state.ring is required. Flat-state writes are rejected to prevent wiping other mats.',
      });
    }

    // Stamp who last touched this ring's state
    state.last_updated_at = new Date().toISOString();
    state.last_updated_by = req.user?.id ?? null;

    const ringKey = `ring${state.ring}`;
    const result  = await pool.query(
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

    broadcastScoreboardUpdate(tournamentId, state.ring, state);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/tournaments/:id/scoreboard-actions
 * Appends one score/penalty/undo event to the scoreboard_actions audit log.
 * Body: { bracketId, ring, actionType, corner, value, technique, deviceId }
 */
async function appendScoreboardAction(req, res, next) {
  try {
    const { id: tournamentId } = req.params;
    const { bracketId, ring, actionType, corner, value, technique, deviceId } = req.body;

    if (!actionType) {
      return res.status(400).json({ error: 'actionType is required' });
    }

    await pool.query(
      `INSERT INTO scoreboard_actions
         (tournament_id, bracket_id, ring, user_id, action_type, corner, value, technique, device_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        tournamentId,
        bracketId  || null,
        ring       != null ? String(ring) : null,
        req.user.id,
        actionType,
        corner     || null,
        value      != null ? value : null,
        technique  || null,
        deviceId   || null,
      ]
    );

    res.status(201).json({ ok: true });
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

// ─── Operator mat lock ────────────────────────────────────────────────────────

const LOCK_TTL_SECONDS = 30;

/**
 * POST /api/tournaments/:id/scoreboard-lock
 * Acquire exclusive operator lock on a ring.
 * Succeeds if: ring is unlocked, lock is stale (> TTL), or same user refreshing.
 * Returns 409 { error, lock } when held by someone else with a fresh lock.
 */
async function acquireScoreboardLock(req, res, next) {
  try {
    const { id: tournamentId } = req.params;
    const { ring, lockedByName } = req.body;
    if (!ring) return res.status(400).json({ error: 'ring is required' });

    const userId      = req.user.id;
    const displayName = lockedByName || req.user.email || 'Operator';

    const { rows } = await pool.query(
      `INSERT INTO scoreboard_locks (tournament_id, ring, locked_by, locked_by_name, locked_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (tournament_id, ring)
       DO UPDATE SET
         locked_by      = EXCLUDED.locked_by,
         locked_by_name = EXCLUDED.locked_by_name,
         locked_at      = NOW()
       WHERE scoreboard_locks.locked_by = $3
          OR scoreboard_locks.locked_at < NOW() - ($5 || ' seconds')::interval
       RETURNING *`,
      [tournamentId, String(ring), userId, displayName, LOCK_TTL_SECONDS]
    );

    if (rows.length > 0) return res.json({ ok: true, lock: rows[0] });

    // Lock is fresh and held by someone else — return their info
    const { rows: existing } = await pool.query(
      `SELECT locked_by, locked_by_name, locked_at
       FROM scoreboard_locks
       WHERE tournament_id = $1 AND ring = $2`,
      [tournamentId, String(ring)]
    );
    return res.status(409).json({ error: 'Mat is locked', lock: existing[0] || null });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/tournaments/:id/scoreboard-lock
 * Release the lock. Only the current holder can release.
 */
async function releaseScoreboardLock(req, res, next) {
  try {
    const { id: tournamentId } = req.params;
    const ring = req.body?.ring ?? req.query?.ring;
    if (!ring) return res.status(400).json({ error: 'ring is required' });

    await pool.query(
      `DELETE FROM scoreboard_locks
       WHERE tournament_id = $1 AND ring = $2 AND locked_by = $3`,
      [tournamentId, String(ring), req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/tournaments/:id/scoreboard-lock/heartbeat
 * Refresh locked_at to keep the lock alive.
 * Returns 409 if the lock has been taken by someone else.
 */
async function heartbeatScoreboardLock(req, res, next) {
  try {
    const { id: tournamentId } = req.params;
    const { ring } = req.body;
    if (!ring) return res.status(400).json({ error: 'ring is required' });

    const { rows } = await pool.query(
      `UPDATE scoreboard_locks SET locked_at = NOW()
       WHERE tournament_id = $1 AND ring = $2 AND locked_by = $3
       RETURNING *`,
      [tournamentId, String(ring), req.user.id]
    );

    if (rows.length === 0) return res.status(409).json({ error: 'Lock lost' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/tournaments/:id/scoreboard-lock/take
 * Forcibly acquire the lock regardless of who holds it (director override / "Take Control").
 */
async function forceScoreboardLock(req, res, next) {
  try {
    const { id: tournamentId } = req.params;
    const { ring, lockedByName } = req.body;
    if (!ring) return res.status(400).json({ error: 'ring is required' });

    const userId      = req.user.id;
    const displayName = lockedByName || req.user.email || 'Operator';

    const { rows } = await pool.query(
      `INSERT INTO scoreboard_locks (tournament_id, ring, locked_by, locked_by_name, locked_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (tournament_id, ring)
       DO UPDATE SET
         locked_by      = EXCLUDED.locked_by,
         locked_by_name = EXCLUDED.locked_by_name,
         locked_at      = NOW()
       RETURNING *`,
      [tournamentId, String(ring), userId, displayName]
    );
    res.json({ ok: true, lock: rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getScoreboardState,
  setScoreboardState,
  appendScoreboardAction,
  getStagingSettings,
  setStagingSettings,
  acquireScoreboardLock,
  releaseScoreboardLock,
  heartbeatScoreboardLock,
  forceScoreboardLock,
};
