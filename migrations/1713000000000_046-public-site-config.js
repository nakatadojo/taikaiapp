exports.up = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tournaments' AND column_name = 'public_site_config'
      ) THEN
        ALTER TABLE tournaments ADD COLUMN public_site_config JSONB NOT NULL DEFAULT '{}';
      END IF;
    END $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE tournaments DROP COLUMN IF EXISTS public_site_config;`);
};
