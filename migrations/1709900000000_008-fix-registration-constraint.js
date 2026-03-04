/**
 * Migration 008 — Fix registration unique constraint
 *
 * The existing UNIQUE(tournament_id, user_id) on registrations breaks
 * multi-competitor carts (e.g., a parent registering 2 children for the
 * same tournament). Replace it with UNIQUE(tournament_id, profile_id)
 * which correctly prevents the same competitor from being registered
 * twice, while allowing one user to register many profiles.
 */

exports.up = (pgm) => {
  // Drop the old constraint if it exists (use raw SQL for IF EXISTS)
  pgm.sql(`
    ALTER TABLE registrations
    DROP CONSTRAINT IF EXISTS registrations_tournament_id_user_id_key
  `);

  // Add the correct constraint if it doesn't exist
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'registrations_tournament_id_profile_id_key'
      ) THEN
        ALTER TABLE registrations
        ADD CONSTRAINT registrations_tournament_id_profile_id_key UNIQUE (tournament_id, profile_id);
      END IF;
    END $$;
  `);

  // Add index on profile_id for faster lookups
  pgm.createIndex('registrations', 'profile_id', {
    ifNotExists: true,
  });
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE registrations
    DROP CONSTRAINT IF EXISTS registrations_tournament_id_profile_id_key
  `);
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'registrations_tournament_id_user_id_key'
      ) THEN
        ALTER TABLE registrations
        ADD CONSTRAINT registrations_tournament_id_user_id_key UNIQUE (tournament_id, user_id);
      END IF;
    END $$;
  `);
  pgm.dropIndex('registrations', 'profile_id', { ifExists: true });
};
