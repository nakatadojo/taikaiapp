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
  // Drop the old constraint
  pgm.dropConstraint('registrations', 'registrations_tournament_id_user_id_key');

  // Add the correct constraint — one profile can only register once per tournament
  pgm.addConstraint('registrations', 'registrations_tournament_id_profile_id_key', {
    unique: ['tournament_id', 'profile_id'],
  });

  // Add index on profile_id for faster lookups
  pgm.createIndex('registrations', 'profile_id', {
    ifNotExists: true,
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint('registrations', 'registrations_tournament_id_profile_id_key');
  pgm.addConstraint('registrations', 'registrations_tournament_id_user_id_key', {
    unique: ['tournament_id', 'user_id'],
  });
  pgm.dropIndex('registrations', 'profile_id', { ifExists: true });
};
