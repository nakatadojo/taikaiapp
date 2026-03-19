/**
 * Migration 053: Add division_tree JSONB column to tournament_events
 * Stores the visual tree builder structure for each event.
 * The tree is the source of truth; criteria_templates is compiled from it.
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE tournament_events
      ADD COLUMN IF NOT EXISTS division_tree jsonb DEFAULT NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE tournament_events
      DROP COLUMN IF EXISTS division_tree;
  `);
};
