/**
 * Migration 002: Academy System
 * Creates: academies, academy_members tables + enum
 */

exports.up = (pgm) => {
  // ── Academies table ─────────────────────────────────────────────────────
  pgm.createTable('academies', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    logo_url: {
      type: 'text',
    },
    head_coach_id: {
      type: 'uuid',
      references: '"users"',
      onDelete: 'SET NULL',
    },
    address: {
      type: 'text',
    },
    city: {
      type: 'varchar(100)',
    },
    state: {
      type: 'varchar(100)',
    },
    website: {
      type: 'varchar(255)',
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

  pgm.createIndex('academies', 'head_coach_id');

  // ── Academy members ─────────────────────────────────────────────────────
  pgm.createType('academy_member_role', [
    'head_coach',
    'assistant_coach',
    'competitor',
  ]);

  pgm.createTable('academy_members', {
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
    role: {
      type: 'academy_member_role',
      notNull: true,
      default: 'competitor',
    },
    added_by: {
      type: 'uuid',
      references: '"users"',
      onDelete: 'SET NULL',
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
  });

  pgm.addConstraint('academy_members', 'unique_academy_user', {
    unique: ['academy_id', 'user_id'],
  });
  pgm.createIndex('academy_members', 'academy_id');
  pgm.createIndex('academy_members', 'user_id');
};

exports.down = (pgm) => {
  pgm.dropTable('academy_members');
  pgm.dropType('academy_member_role');
  pgm.dropTable('academies');
};
