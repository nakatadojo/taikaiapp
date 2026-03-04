/**
 * Migration 006: Platform Multi-Tenancy
 * - Extends user_role enum with 'event_director' and 'super_admin'
 * - Adds columns to tournaments: slug, cover_image_url, description, city, state,
 *   venue_name, venue_address, published, organization_name, contact_email, registration_deadline
 * - Adds credit_balance to users
 * - Creates credit_transactions table
 * - Generates slugs for existing tournaments
 * - Sets existing tournaments to published = true
 */

exports.up = (pgm) => {
  // ── Extend user_role enum ────────────────────────────────────────────────────
  pgm.sql("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'event_director'");
  pgm.sql("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin'");

  // ── Add columns to tournaments ───────────────────────────────────────────────
  pgm.addColumn('tournaments', {
    slug: {
      type: 'varchar(200)',
      unique: true,
    },
    cover_image_url: {
      type: 'text',
    },
    description: {
      type: 'text',
    },
    city: {
      type: 'varchar(100)',
    },
    state: {
      type: 'varchar(50)',
    },
    venue_name: {
      type: 'varchar(200)',
    },
    venue_address: {
      type: 'text',
    },
    published: {
      type: 'boolean',
      default: false,
    },
    organization_name: {
      type: 'varchar(200)',
    },
    contact_email: {
      type: 'varchar(255)',
    },
    registration_deadline: {
      type: 'timestamptz',
    },
  });

  pgm.createIndex('tournaments', 'slug', {
    name: 'idx_tournaments_slug',
    where: 'slug IS NOT NULL',
  });
  pgm.createIndex('tournaments', 'published', {
    name: 'idx_tournaments_published',
  });
  pgm.createIndex('tournaments', 'created_by', {
    name: 'idx_tournaments_created_by',
    where: 'created_by IS NOT NULL',
  });

  // ── Add credit_balance + organization_name to users ────────────────────────
  pgm.addColumn('users', {
    credit_balance: {
      type: 'integer',
      default: 0,
    },
    organization_name: {
      type: 'varchar(200)',
    },
  });

  // ── Extend account_type check constraint to include 'event_director' ──────
  pgm.sql("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_account_type_check");
  pgm.sql("ALTER TABLE users ADD CONSTRAINT users_account_type_check CHECK (account_type IN ('competitor', 'guardian', 'both', 'event_director'))");

  // ── Credit Transactions table ────────────────────────────────────────────────
  pgm.createTable('credit_transactions', {
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
    amount: {
      type: 'integer',
      notNull: true,
      comment: 'Positive = purchase/grant/refund, negative = usage',
    },
    balance_after: {
      type: 'integer',
      notNull: true,
    },
    type: {
      type: 'varchar(20)',
      notNull: true,
      check: "type IN ('purchase', 'usage', 'refund', 'grant')",
    },
    description: {
      type: 'text',
    },
    tournament_id: {
      type: 'uuid',
      references: '"tournaments"',
      onDelete: 'SET NULL',
    },
    registration_id: {
      type: 'uuid',
      references: '"registrations"',
      onDelete: 'SET NULL',
    },
    stripe_session_id: {
      type: 'varchar(255)',
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('credit_transactions', 'user_id', {
    name: 'idx_credit_tx_user',
  });

  // ── Generate slugs for existing tournaments ──────────────────────────────────
  // Convert name to slug: lowercase, replace spaces/special chars with hyphens
  pgm.sql(`
    UPDATE tournaments
    SET slug = LOWER(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(name, '[^a-zA-Z0-9\\s-]', '', 'g'),
          '\\s+', '-', 'g'
        ),
        '-+', '-', 'g'
      )
    ),
    published = true
    WHERE slug IS NULL
  `);

  // Handle slug collisions by appending row number
  pgm.sql(`
    WITH dupes AS (
      SELECT id, slug,
        ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at) as rn
      FROM tournaments
      WHERE slug IS NOT NULL
    )
    UPDATE tournaments t
    SET slug = dupes.slug || '-' || dupes.rn
    FROM dupes
    WHERE t.id = dupes.id AND dupes.rn > 1
  `);
};

exports.down = (pgm) => {
  // Drop credit_transactions
  pgm.dropTable('credit_transactions');

  // Drop credit_balance and organization_name from users
  pgm.dropColumn('users', ['credit_balance', 'organization_name']);

  // Drop new tournament columns
  pgm.dropColumn('tournaments', [
    'slug', 'cover_image_url', 'description', 'city', 'state',
    'venue_name', 'venue_address', 'published', 'organization_name',
    'contact_email', 'registration_deadline',
  ]);

  // Note: Cannot remove values from PostgreSQL enums.
  // The 'event_director' and 'super_admin' values remain in user_role type.
};
