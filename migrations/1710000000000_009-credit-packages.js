/**
 * Migration 009 — Credit Packages table
 *
 * Replaces the hardcoded CREDIT_PACKAGES array in creditsController
 * with a database-backed table so super-admins can manage packages.
 */

exports.up = (pgm) => {
  pgm.createTable('credit_packages', {
    id: {
      type: 'uuid',
      default: pgm.func('gen_random_uuid()'),
      primaryKey: true,
    },
    slug: {
      type: 'varchar(50)',
      notNull: true,
      unique: true,
    },
    credits: {
      type: 'integer',
      notNull: true,
    },
    price_in_cents: {
      type: 'integer',
      notNull: true,
    },
    label: {
      type: 'varchar(100)',
      notNull: true,
    },
    active: {
      type: 'boolean',
      default: true,
      notNull: true,
    },
    sort_order: {
      type: 'integer',
      default: 0,
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
      notNull: true,
    },
    updated_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
      notNull: true,
    },
  });

  // Seed with the existing hardcoded packages
  pgm.sql(`
    INSERT INTO credit_packages (slug, credits, price_in_cents, label, sort_order) VALUES
    ('starter',  50,  4900,  'Starter — 50 credits',  1),
    ('standard', 150, 12900, 'Standard — 150 credits', 2),
    ('pro',      500, 39900, 'Pro — 500 credits',      3)
  `);
};

exports.down = (pgm) => {
  pgm.dropTable('credit_packages');
};
