exports.up = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'scoreboard_configs'
      ) THEN
        CREATE TABLE scoreboard_configs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tournament_id UUID NOT NULL UNIQUE REFERENCES tournaments(id) ON DELETE CASCADE,
          config JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      END IF;
    END $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS scoreboard_configs;`);
};
