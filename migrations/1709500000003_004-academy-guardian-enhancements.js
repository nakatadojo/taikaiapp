/**
 * Migration 004: Academy & Guardian Enhancements
 * Creates: academy_membership_requests, guardian_confirmations tables + enums
 * Alters: registrations (adds status column), users (allows NULL password_hash), academies (adds name index)
 */

exports.up = (pgm) => {
  // ── Enable pg_trgm for fuzzy academy search ──────────────────────────────
  pgm.sql('CREATE EXTENSION IF NOT EXISTS "pg_trgm"');

  // ── Allow NULL password_hash for coach-created accounts ──────────────────
  pgm.alterColumn('users', 'password_hash', {
    notNull: false,
  });

  // ── Academy membership requests ──────────────────────────────────────────
  pgm.createType('membership_request_status', ['pending', 'approved', 'denied']);

  pgm.createTable('academy_membership_requests', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    academy_id: {
      type: 'uuid',
      notNull: true,
      references: '"academies"',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    status: {
      type: 'membership_request_status',
      notNull: true,
      default: 'pending',
    },
    requested_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
    reviewed_at: {
      type: 'timestamptz',
    },
    reviewed_by: {
      type: 'uuid',
      references: '"users"',
      onDelete: 'SET NULL',
    },
  });

  pgm.addConstraint('academy_membership_requests', 'unique_academy_user_request', {
    unique: ['academy_id', 'user_id'],
  });
  pgm.createIndex('academy_membership_requests', 'academy_id');
  pgm.createIndex('academy_membership_requests', 'user_id');
  pgm.createIndex('academy_membership_requests', 'status');

  // ── Guardian confirmations ───────────────────────────────────────────────
  pgm.createType('guardian_confirmation_status', ['pending', 'confirmed', 'expired']);

  pgm.createTable('guardian_confirmations', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    minor_user_id: {
      type: 'uuid',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    guardian_email: {
      type: 'varchar(255)',
      notNull: true,
    },
    guardian_user_id: {
      type: 'uuid',
      references: '"users"',
      onDelete: 'SET NULL',
    },
    token: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },
    relationship: {
      type: 'guardian_relationship',
      notNull: true,
    },
    status: {
      type: 'guardian_confirmation_status',
      notNull: true,
      default: 'pending',
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
    confirmed_at: {
      type: 'timestamptz',
    },
    expires_at: {
      type: 'timestamptz',
      notNull: true,
    },
  });

  pgm.createIndex('guardian_confirmations', 'token');
  pgm.createIndex('guardian_confirmations', 'minor_user_id');
  pgm.createIndex('guardian_confirmations', 'guardian_email');

  // ── Registration status column ───────────────────────────────────────────
  pgm.createType('registration_status', ['active', 'pending_guardian', 'cancelled']);

  pgm.addColumn('registrations', {
    status: {
      type: 'registration_status',
      default: 'active',
    },
  });

  // ── Academy name trigram index for autocomplete search ───────────────────
  pgm.sql('CREATE INDEX idx_academies_name_trgm ON academies USING gin (name gin_trgm_ops)');
};

exports.down = (pgm) => {
  // Drop trigram index
  pgm.sql('DROP INDEX IF EXISTS idx_academies_name_trgm');

  // Drop registration status column and type
  pgm.dropColumn('registrations', 'status');
  pgm.dropType('registration_status');

  // Drop guardian confirmations
  pgm.dropTable('guardian_confirmations');
  pgm.dropType('guardian_confirmation_status');

  // Drop membership requests
  pgm.dropTable('academy_membership_requests');
  pgm.dropType('membership_request_status');

  // Restore password_hash NOT NULL constraint
  pgm.alterColumn('users', 'password_hash', {
    notNull: true,
  });

  // Drop pg_trgm extension
  pgm.sql('DROP EXTENSION IF EXISTS "pg_trgm"');
};
