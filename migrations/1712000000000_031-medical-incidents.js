/**
 * Migration 031 — Medical/Injury Incident Logging
 *
 * Stores medical incident reports during tournaments.
 * competitor_name is denormalized so records persist even if profiles are deleted.
 */
exports.up = (pgm) => {
  pgm.createTable('medical_incidents', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    tournament_id: {
      type: 'uuid',
      notNull: true,
      references: 'tournaments(id)',
      onDelete: 'CASCADE',
    },
    competitor_profile_id: {
      type: 'uuid',
      references: 'competitor_profiles(id)',
      onDelete: 'SET NULL',
    },
    competitor_name: {
      type: 'text',
      notNull: true,
    },
    mat_number: {
      type: 'text',
    },
    description: {
      type: 'text',
      notNull: true,
    },
    official_present: {
      type: 'text',
    },
    able_to_continue: {
      type: 'boolean',
      default: false,
    },
    medical_staff_called: {
      type: 'boolean',
      default: false,
    },
    logged_by: {
      type: 'uuid',
      references: 'users(id)',
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('medical_incidents', 'tournament_id');
};

exports.down = (pgm) => {
  pgm.dropTable('medical_incidents');
};
