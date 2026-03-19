/**
 * Migration 052 — Stripe settings & payment modes
 *
 * - platform_settings: admin-managed key/value store for platform-level config
 *   (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PUBLISHABLE_KEY)
 * - users: per-director Stripe keys so directors can collect registration fees
 *   directly into their own Stripe accounts
 * - tournaments.payment_mode: per-tournament payment routing
 *     'stripe'  → platform Stripe account (default)
 *     'direct'  → director's own Stripe account
 *     'cash'    → no online payment (cash/offline only)
 */

exports.up = (pgm) => {
  pgm.sql(`
    -- Platform-level key/value settings (super_admin managed)
    CREATE TABLE IF NOT EXISTS platform_settings (
      key        VARCHAR(100) PRIMARY KEY,
      value      TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Per-director Stripe keys
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS stripe_secret_key      TEXT,
      ADD COLUMN IF NOT EXISTS stripe_publishable_key TEXT,
      ADD COLUMN IF NOT EXISTS stripe_webhook_secret  TEXT;

    -- Per-tournament payment routing
    ALTER TABLE tournaments
      ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(20) NOT NULL DEFAULT 'stripe';

    COMMENT ON COLUMN tournaments.payment_mode IS
      'stripe = platform key, direct = director own Stripe, cash = no online payment';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS platform_settings;
    ALTER TABLE users
      DROP COLUMN IF EXISTS stripe_secret_key,
      DROP COLUMN IF EXISTS stripe_publishable_key,
      DROP COLUMN IF EXISTS stripe_webhook_secret;
    ALTER TABLE tournaments
      DROP COLUMN IF EXISTS payment_mode;
  `);
};
