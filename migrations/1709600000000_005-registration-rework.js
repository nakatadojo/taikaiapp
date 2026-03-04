/**
 * Migration 005: Registration System Rework
 * Creates: competitor_profiles, discount_codes, payment_transactions tables
 * Alters: registrations (adds profile_id, payment_transaction_id, stripe_session_id)
 *         users (adds account_type)
 */

exports.up = (pgm) => {
  // ── Competitor Profiles ────────────────────────────────────────────────────
  pgm.createTable('competitor_profiles', {
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
    first_name: {
      type: 'varchar(100)',
      notNull: true,
    },
    last_name: {
      type: 'varchar(100)',
      notNull: true,
    },
    date_of_birth: {
      type: 'date',
      notNull: true,
    },
    gender: {
      type: 'varchar(10)',
      notNull: true,
      check: "gender IN ('male', 'female')",
    },
    belt_rank: {
      type: 'varchar(50)',
    },
    experience_level: {
      type: 'varchar(20)',
      check: "experience_level IN ('beginner', 'novice', 'intermediate', 'advanced')",
    },
    weight: {
      type: 'decimal(5,1)',
    },
    academy_name: {
      type: 'varchar(200)',
    },
    academy_id: {
      type: 'uuid',
      references: '"academies"',
      onDelete: 'SET NULL',
    },
    is_self: {
      type: 'boolean',
      default: false,
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

  pgm.createIndex('competitor_profiles', 'user_id', { name: 'idx_profiles_user' });

  // ── Discount Codes ─────────────────────────────────────────────────────────
  pgm.createTable('discount_codes', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    code: {
      type: 'varchar(50)',
      notNull: true,
      unique: true,
    },
    type: {
      type: 'varchar(20)',
      notNull: true,
      check: "type IN ('percentage', 'fixed')",
    },
    value: {
      type: 'decimal(10,2)',
      notNull: true,
    },
    max_uses: {
      type: 'integer',
    },
    times_used: {
      type: 'integer',
      default: 0,
    },
    expires_at: {
      type: 'timestamptz',
    },
    active: {
      type: 'boolean',
      default: true,
    },
    tournament_id: {
      type: 'uuid',
      references: '"tournaments"',
      onDelete: 'SET NULL',
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
  });

  pgm.createIndex('discount_codes', 'code', { name: 'idx_discount_code' });

  // ── Payment Transactions ───────────────────────────────────────────────────
  pgm.createTable('payment_transactions', {
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
    tournament_id: {
      type: 'uuid',
      notNull: true,
      references: '"tournaments"',
      onDelete: 'CASCADE',
    },
    stripe_session_id: {
      type: 'varchar(255)',
      unique: true,
    },
    amount_total: {
      type: 'integer',
      notNull: true,
      comment: 'Total amount in cents',
    },
    discount_code_id: {
      type: 'uuid',
      references: '"discount_codes"',
      onDelete: 'SET NULL',
    },
    discount_amount: {
      type: 'integer',
      default: 0,
      comment: 'Discount amount in cents',
    },
    status: {
      type: 'varchar(20)',
      default: 'pending',
      check: "status IN ('pending', 'completed', 'failed', 'refunded')",
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
    completed_at: {
      type: 'timestamptz',
    },
  });

  pgm.createIndex('payment_transactions', 'user_id', { name: 'idx_payments_user' });
  pgm.createIndex('payment_transactions', 'stripe_session_id', { name: 'idx_payments_stripe' });

  // ── Alter registrations: add profile_id, payment_transaction_id, stripe_session_id ─
  pgm.addColumn('registrations', {
    profile_id: {
      type: 'uuid',
      references: '"competitor_profiles"',
      onDelete: 'SET NULL',
    },
    payment_transaction_id: {
      type: 'uuid',
      references: '"payment_transactions"',
      onDelete: 'SET NULL',
    },
    stripe_session_id: {
      type: 'varchar(255)',
    },
  });

  // ── Alter users: add account_type ──────────────────────────────────────────
  pgm.addColumn('users', {
    account_type: {
      type: 'varchar(20)',
      check: "account_type IN ('competitor', 'guardian', 'both')",
    },
  });
};

exports.down = (pgm) => {
  // Drop user account_type column
  pgm.dropColumn('users', 'account_type');

  // Drop registration new columns
  pgm.dropColumn('registrations', ['profile_id', 'payment_transaction_id', 'stripe_session_id']);

  // Drop payment_transactions
  pgm.dropTable('payment_transactions');

  // Drop discount_codes
  pgm.dropTable('discount_codes');

  // Drop competitor_profiles
  pgm.dropTable('competitor_profiles');
};
