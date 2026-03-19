/**
 * Migration 051: Competitor approval system
 *
 * Adds two columns to tournament_director_competitors:
 *   approved       — director has approved this competitor to compete.
 *                    When set to true on a real (non-test) competitor, 1 credit
 *                    is deducted from the director's account.
 *   bracket_placed — true once the competitor appears in any saved bracket.
 *                    Once set, approval cannot be reversed for real competitors
 *                    (credit is permanently consumed), even if the bracket is
 *                    later deleted.
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE tournament_director_competitors
      ADD COLUMN IF NOT EXISTS approved       boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS bracket_placed boolean NOT NULL DEFAULT false;

    CREATE INDEX IF NOT EXISTS idx_tdc_tournament_approved
      ON tournament_director_competitors (tournament_id, approved);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_tdc_tournament_approved;
    ALTER TABLE tournament_director_competitors
      DROP COLUMN IF EXISTS approved,
      DROP COLUMN IF EXISTS bracket_placed;
  `);
};
