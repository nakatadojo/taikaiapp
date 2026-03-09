/**
 * Migration 044 — Currency and weight unit settings
 *
 * Adds currency (e.g. USD, MXN, EUR) and weight_unit (kg/lbs)
 * columns to tournaments so directors can configure per-tournament.
 */

exports.up = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tournaments' AND column_name = 'currency'
      ) THEN
        ALTER TABLE tournaments ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'USD';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tournaments' AND column_name = 'weight_unit'
      ) THEN
        ALTER TABLE tournaments ADD COLUMN weight_unit VARCHAR(3) NOT NULL DEFAULT 'kg';
      END IF;
    END $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE tournaments DROP COLUMN IF EXISTS currency;
    ALTER TABLE tournaments DROP COLUMN IF EXISTS weight_unit;
  `);
};
