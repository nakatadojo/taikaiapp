/**
 * Migration 054 — Mats Config & Mat Scoreboards Persistence
 *
 * Adds two JSONB columns to the tournaments table so that mat configuration
 * (mat list + names) and live scoreboard state (per-mat scores) are persisted
 * in the database and shared across all director devices.
 */
exports.up = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tournaments' AND column_name = 'mats_config'
      ) THEN
        ALTER TABLE tournaments ADD COLUMN mats_config JSONB NOT NULL DEFAULT '[]';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tournaments' AND column_name = 'mat_scoreboards'
      ) THEN
        ALTER TABLE tournaments ADD COLUMN mat_scoreboards JSONB NOT NULL DEFAULT '{}';
      END IF;
    END $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE tournaments DROP COLUMN IF EXISTS mats_config;
    ALTER TABLE tournaments DROP COLUMN IF EXISTS mat_scoreboards;
  `);
};
