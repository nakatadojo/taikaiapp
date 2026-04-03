/**
 * Migration 060 — Athlete Profiles + Push Subscriptions
 *
 * athlete_profiles — canonical cross-tournament competitor identity
 * push_subscriptions — Web Push subscription store
 * adds athlete_profile_id FK to registrations
 */
exports.up = (pgm) => {
  // ── Athlete Profiles ────────────────────────────────────────────────────────
  pgm.createTable('athlete_profiles', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      references: '"users"',
      onDelete: 'SET NULL',
    },
    first_name:       { type: 'varchar(100)', notNull: true },
    last_name:        { type: 'varchar(100)', notNull: true },
    date_of_birth:    { type: 'date' },
    gender:           { type: 'varchar(20)' },
    weight:           { type: 'numeric(6,2)' },
    belt_rank:        { type: 'varchar(50)' },
    experience_level: { type: 'varchar(50)' },
    academy_name:     { type: 'varchar(150)' },
    email:            { type: 'varchar(255)' },
    phone:            { type: 'varchar(30)' },
    photo_url:        { type: 'text' },
    nationality:      { type: 'varchar(80)' },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('athlete_profiles', ['user_id']);
  pgm.createIndex('athlete_profiles', ['email']);

  // ── Link registrations to athlete profiles ──────────────────────────────────
  pgm.addColumn('registrations', {
    athlete_profile_id: {
      type: 'uuid',
      references: '"athlete_profiles"',
      onDelete: 'SET NULL',
    },
  });
  pgm.createIndex('registrations', ['athlete_profile_id']);

  // ── Push Subscriptions ──────────────────────────────────────────────────────
  pgm.createTable('push_subscriptions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      references: '"users"',
      onDelete: 'CASCADE',
    },
    endpoint:  { type: 'text', notNull: true, unique: true },
    p256dh:    { type: 'text', notNull: true },
    auth:      { type: 'text', notNull: true },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('push_subscriptions', ['user_id']);
};

exports.down = (pgm) => {
  pgm.dropIndex('registrations', ['athlete_profile_id']);
  pgm.dropColumn('registrations', 'athlete_profile_id');
  pgm.dropTable('push_subscriptions');
  pgm.dropTable('athlete_profiles');
};
