/**
 * Migration 062 — Scoreboard audit trail + per-mat permissions
 *
 * 1. scoreboard_actions — append-only log of every score/penalty event
 * 2. tournament_members.assigned_rings — optional JSONB array restricting
 *    which ring numbers a staff member can operate
 */

exports.up = async (pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS scoreboard_actions (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      bracket_id    TEXT,
      ring          TEXT,
      user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
      action_type   TEXT NOT NULL,   -- 'score' | 'penalty' | 'undo' | 'reset' | 'winner'
      corner        TEXT,            -- 'red' | 'blue'
      value         NUMERIC,
      technique     TEXT,
      timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      device_id     TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_scoreboard_actions_tournament
      ON scoreboard_actions (tournament_id);

    CREATE INDEX IF NOT EXISTS idx_scoreboard_actions_tournament_ring
      ON scoreboard_actions (tournament_id, ring);
  `);

  await pool.query(`
    ALTER TABLE tournament_members
      ADD COLUMN IF NOT EXISTS assigned_rings JSONB DEFAULT NULL;
  `);
};

exports.down = async (pool) => {
  await pool.query(`DROP TABLE IF EXISTS scoreboard_actions;`);
  await pool.query(`
    ALTER TABLE tournament_members DROP COLUMN IF EXISTS assigned_rings;
  `);
};
