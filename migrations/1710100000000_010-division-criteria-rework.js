/**
 * Migration 010 — Division criteria rework
 *
 * Adds sanctioning_body to tournaments and criteria_templates + is_event_type
 * to tournament_events. This supports the new criteria-based division system
 * where event types (Kata, Kumite) are stored as high-level entries with
 * criteria templates, rather than 200+ pre-generated division rows.
 */

exports.up = (pgm) => {
  // Add sanctioning_body to tournaments
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tournaments' AND column_name = 'sanctioning_body'
      ) THEN
        ALTER TABLE tournaments ADD COLUMN sanctioning_body varchar(20);
      END IF;
    END $$;
  `);

  // Add criteria_templates (JSONB) to tournament_events
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tournament_events' AND column_name = 'criteria_templates'
      ) THEN
        ALTER TABLE tournament_events ADD COLUMN criteria_templates jsonb;
      END IF;
    END $$;
  `);

  // Add is_event_type boolean to tournament_events
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tournament_events' AND column_name = 'is_event_type'
      ) THEN
        ALTER TABLE tournament_events ADD COLUMN is_event_type boolean DEFAULT false;
      END IF;
    END $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE tournaments DROP COLUMN IF EXISTS sanctioning_body`);
  pgm.sql(`ALTER TABLE tournament_events DROP COLUMN IF EXISTS criteria_templates`);
  pgm.sql(`ALTER TABLE tournament_events DROP COLUMN IF EXISTS is_event_type`);
};
