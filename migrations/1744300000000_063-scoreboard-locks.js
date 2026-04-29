/**
 * Migration 063 — Per-mat operator exclusive lock
 *
 * scoreboard_locks: one row per (tournament, ring) while a mat is being operated.
 * Locks expire automatically after LOCK_TTL_SECONDS of no heartbeat (enforced
 * in the application layer, not via a DB job — the row stays but is treated as
 * stale when locked_at < NOW() - interval).
 */

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS scoreboard_locks (
      tournament_id  UUID        NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      ring           TEXT        NOT NULL,
      locked_by      UUID        NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
      locked_by_name TEXT        NOT NULL DEFAULT '',
      locked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (tournament_id, ring)
    )
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_scoreboard_locks_tournament
      ON scoreboard_locks (tournament_id)
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS scoreboard_locks`);
};
