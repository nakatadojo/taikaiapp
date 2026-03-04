/**
 * Migration 001: Core User System
 * Creates: users, user_roles, minor_guardians tables + enums
 */

exports.up = (pgm) => {
  // Enable UUID generation
  pgm.sql('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // ── Users table ─────────────────────────────────────────────────────────
  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    email: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },
    password_hash: {
      type: 'varchar(255)',
      notNull: true,
    },
    first_name: {
      type: 'varchar(100)',
      notNull: true,
    },
    last_name: {
      type: 'varchar(100)',
      notNull: true,
    },
    phone: {
      type: 'varchar(30)',
    },
    date_of_birth: {
      type: 'date',
    },
    profile_photo_url: {
      type: 'text',
    },
    email_verified: {
      type: 'boolean',
      default: false,
    },
    verification_token: {
      type: 'varchar(255)',
    },
    verification_token_expires: {
      type: 'timestamptz',
    },
    reset_token: {
      type: 'varchar(255)',
    },
    reset_token_expires: {
      type: 'timestamptz',
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('users', 'email');
  pgm.createIndex('users', 'verification_token', {
    where: 'verification_token IS NOT NULL',
  });
  pgm.createIndex('users', 'reset_token', {
    where: 'reset_token IS NOT NULL',
  });

  // ── User roles ──────────────────────────────────────────────────────────
  pgm.createType('user_role', [
    'competitor',
    'coach',
    'judge',
    'assistant_coach',
    'admin',
  ]);

  pgm.createTable('user_roles', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    role: {
      type: 'user_role',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
  });

  pgm.addConstraint('user_roles', 'unique_user_role', {
    unique: ['user_id', 'role'],
  });
  pgm.createIndex('user_roles', 'user_id');
  pgm.createIndex('user_roles', 'role');

  // ── Minor guardians ─────────────────────────────────────────────────────
  pgm.createType('guardian_relationship', [
    'coach',
    'parent',
    'legal_guardian',
  ]);

  pgm.createTable('minor_guardians', {
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
    guardian_user_id: {
      type: 'uuid',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    relationship: {
      type: 'guardian_relationship',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
  });

  pgm.addConstraint('minor_guardians', 'unique_minor_guardian', {
    unique: ['minor_user_id', 'guardian_user_id'],
  });
  pgm.createIndex('minor_guardians', 'minor_user_id');
  pgm.createIndex('minor_guardians', 'guardian_user_id');
};

exports.down = (pgm) => {
  pgm.dropTable('minor_guardians');
  pgm.dropType('guardian_relationship');
  pgm.dropTable('user_roles');
  pgm.dropType('user_role');
  pgm.dropTable('users');
};
