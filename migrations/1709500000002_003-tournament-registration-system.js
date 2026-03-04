/**
 * Migration 003: Tournament & Registration System
 * Creates: tournaments, tournament_events, registrations, registration_events tables + enums
 */

exports.up = (pgm) => {
  // ── Tournaments table ───────────────────────────────────────────────────
  pgm.createTable('tournaments', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    date: {
      type: 'date',
    },
    location: {
      type: 'varchar(255)',
    },
    registration_open: {
      type: 'boolean',
      default: false,
    },
    base_event_price: {
      type: 'decimal(10,2)',
      default: 75.00,
    },
    addon_event_price: {
      type: 'decimal(10,2)',
      default: 25.00,
    },
    created_by: {
      type: 'uuid',
      references: '"users"',
      onDelete: 'SET NULL',
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

  // ── Tournament events ───────────────────────────────────────────────────
  pgm.createType('event_gender', ['male', 'female', 'mixed']);

  pgm.createTable('tournament_events', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    tournament_id: {
      type: 'uuid',
      notNull: true,
      references: '"tournaments"',
      onDelete: 'CASCADE',
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    event_type: {
      type: 'varchar(50)',
    },
    division: {
      type: 'varchar(100)',
    },
    gender: {
      type: 'event_gender',
    },
    age_min: {
      type: 'integer',
    },
    age_max: {
      type: 'integer',
    },
    rank_min: {
      type: 'varchar(50)',
    },
    rank_max: {
      type: 'varchar(50)',
    },
    price_override: {
      type: 'decimal(10,2)',
    },
    addon_price_override: {
      type: 'decimal(10,2)',
    },
    max_competitors: {
      type: 'integer',
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

  pgm.createIndex('tournament_events', 'tournament_id');

  // ── Registrations ───────────────────────────────────────────────────────
  pgm.createType('payment_status', ['unpaid', 'paid', 'partial', 'waived']);

  pgm.createTable('registrations', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    tournament_id: {
      type: 'uuid',
      notNull: true,
      references: '"tournaments"',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    registered_by: {
      type: 'uuid',
      references: '"users"',
      onDelete: 'SET NULL',
    },
    academy_id: {
      type: 'uuid',
      references: '"academies"',
      onDelete: 'SET NULL',
    },
    payment_status: {
      type: 'payment_status',
      default: 'unpaid',
    },
    amount_paid: {
      type: 'decimal(10,2)',
      default: 0,
    },
    total_due: {
      type: 'decimal(10,2)',
      default: 0,
    },
    notes: {
      type: 'text',
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

  pgm.addConstraint('registrations', 'unique_tournament_user', {
    unique: ['tournament_id', 'user_id'],
  });
  pgm.createIndex('registrations', 'tournament_id');
  pgm.createIndex('registrations', 'user_id');
  pgm.createIndex('registrations', 'academy_id');

  // ── Registration events ─────────────────────────────────────────────────
  pgm.createTable('registration_events', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    registration_id: {
      type: 'uuid',
      notNull: true,
      references: '"registrations"',
      onDelete: 'CASCADE',
    },
    event_id: {
      type: 'uuid',
      notNull: true,
      references: '"tournament_events"',
      onDelete: 'CASCADE',
    },
    is_primary: {
      type: 'boolean',
      default: false,
    },
    price: {
      type: 'decimal(10,2)',
    },
    selection_order: {
      type: 'integer',
      default: 0,
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
  });

  pgm.addConstraint('registration_events', 'unique_registration_event', {
    unique: ['registration_id', 'event_id'],
  });
  pgm.createIndex('registration_events', 'registration_id');
  pgm.createIndex('registration_events', 'event_id');
};

exports.down = (pgm) => {
  pgm.dropTable('registration_events');
  pgm.dropTable('registrations');
  pgm.dropType('payment_status');
  pgm.dropTable('tournament_events');
  pgm.dropType('event_gender');
  pgm.dropTable('tournaments');
};
