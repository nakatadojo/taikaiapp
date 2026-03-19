/**
 * server/config/platformSettings.js
 *
 * Thin caching layer for platform_settings table.
 * Falls back to process.env when the DB value is absent/empty.
 * TTL is 5 minutes so key rotations propagate within 5 min without restart.
 */

const pool = require('../db/pool');

const _cache = {};
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Get a platform setting.
 * Priority: DB → process.env → null
 */
async function get(key) {
  const entry = _cache[key];
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return entry.val;
  try {
    const r = await pool.query(
      'SELECT value FROM platform_settings WHERE key = $1',
      [key]
    );
    const val = r.rows[0]?.value || process.env[key] || null;
    _cache[key] = { val, ts: Date.now() };
    return val;
  } catch {
    // DB unavailable — fall back to env
    return process.env[key] || null;
  }
}

/**
 * Set (upsert) a platform setting and invalidate the cache entry.
 */
async function set(key, value) {
  await pool.query(
    `INSERT INTO platform_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, value || null]
  );
  delete _cache[key];
}

/**
 * Convenience helpers for the three Stripe keys.
 */
async function getStripeSecretKey()    { return get('STRIPE_SECRET_KEY'); }
async function getStripeWebhookSecret(){ return get('STRIPE_WEBHOOK_SECRET'); }
async function getStripePublishableKey(){ return get('STRIPE_PUBLISHABLE_KEY'); }

module.exports = { get, set, getStripeSecretKey, getStripeWebhookSecret, getStripePublishableKey };
