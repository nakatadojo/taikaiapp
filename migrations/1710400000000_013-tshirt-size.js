/**
 * Migration 013 — T-shirt size collection
 *
 * Adds tshirt_size to registrations and collect_tshirt_sizes to tournaments.
 * Directors can optionally enable t-shirt size collection per tournament.
 */

exports.up = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'registrations' AND column_name = 'tshirt_size'
      ) THEN
        ALTER TABLE registrations ADD COLUMN tshirt_size VARCHAR(10);
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tournaments' AND column_name = 'collect_tshirt_sizes'
      ) THEN
        ALTER TABLE tournaments ADD COLUMN collect_tshirt_sizes BOOLEAN NOT NULL DEFAULT false;
      END IF;
    END $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE registrations DROP COLUMN IF EXISTS tshirt_size;
    ALTER TABLE tournaments DROP COLUMN IF EXISTS collect_tshirt_sizes;
  `);
};
