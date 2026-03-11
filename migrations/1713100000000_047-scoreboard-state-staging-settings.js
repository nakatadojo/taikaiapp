exports.up = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tournaments' AND column_name = 'scoreboard_state'
      ) THEN
        ALTER TABLE tournaments ADD COLUMN scoreboard_state JSONB NOT NULL DEFAULT '{}';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tournaments' AND column_name = 'staging_settings'
      ) THEN
        ALTER TABLE tournaments ADD COLUMN staging_settings JSONB NOT NULL DEFAULT '{}';
      END IF;
    END $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE tournaments DROP COLUMN IF EXISTS scoreboard_state;
    ALTER TABLE tournaments DROP COLUMN IF EXISTS staging_settings;
  `);
};
