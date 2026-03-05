/**
 * Migration 011 — Add match_duration_seconds to tournament_events
 *
 * Stores per-event-type default match duration in seconds.
 * WKF/AAU templates have different durations per age group;
 * this column stores the event-level default.
 */

exports.up = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tournament_events' AND column_name = 'match_duration_seconds'
      ) THEN
        ALTER TABLE tournament_events ADD COLUMN match_duration_seconds INTEGER;
      END IF;
    END $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE tournament_events DROP COLUMN IF EXISTS match_duration_seconds`);
};
