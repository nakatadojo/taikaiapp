/**
 * Migration 054 — Mats Config & Mat Scoreboards Persistence
 *
 * Adds two JSONB columns to the tournaments table so that mat configuration
 * (mat list + names) and live scoreboard state (per-mat scores) are persisted
 * in the database and shared across all director devices.
 */
exports.up = (pgm) => {
  pgm.addColumn('tournaments', {
    mats_config: {
      type: 'jsonb',
      default: "'[]'::jsonb",
    },
    mat_scoreboards: {
      type: 'jsonb',
      default: "'{}'::jsonb",
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('tournaments', 'mats_config');
  pgm.dropColumn('tournaments', 'mat_scoreboards');
};
