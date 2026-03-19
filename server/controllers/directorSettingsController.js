/**
 * server/controllers/directorSettingsController.js
 *
 * Authenticated director endpoints for managing their own Stripe credentials.
 * These keys are used when a tournament's payment_mode = 'direct', routing
 * registration fees directly to the director's Stripe account.
 */

const pool = require('../db/pool');

function maskKey(val) {
  if (!val) return null;
  if (val.length <= 8) return '***';
  return val.slice(0, 7) + '...' + val.slice(-4);
}

/**
 * GET /api/director/stripe-settings
 * Returns the authenticated user's masked Stripe keys.
 */
async function getStripeSettings(req, res, next) {
  try {
    const r = await pool.query(
      'SELECT stripe_secret_key, stripe_publishable_key, stripe_webhook_secret FROM users WHERE id = $1',
      [req.user.id]
    );
    const u = r.rows[0] || {};

    res.json({
      secretKey:        maskKey(u.stripe_secret_key),
      publishableKey:   maskKey(u.stripe_publishable_key),
      webhookSecret:    maskKey(u.stripe_webhook_secret),
      secretKeySet:     !!u.stripe_secret_key,
      publishableKeySet:!!u.stripe_publishable_key,
      webhookSecretSet: !!u.stripe_webhook_secret,
    });
  } catch (err) { next(err); }
}

/**
 * PUT /api/director/stripe-settings
 * Body: { secretKey?, publishableKey?, webhookSecret? }
 * Pass an empty string to clear a key.
 */
async function updateStripeSettings(req, res, next) {
  try {
    const { secretKey, publishableKey, webhookSecret } = req.body;
    const setClauses = [];
    const vals       = [];
    let   idx        = 1;

    if (secretKey !== undefined) {
      if (secretKey && !secretKey.startsWith('sk_')) {
        return res.status(400).json({ error: 'Secret key must start with sk_' });
      }
      setClauses.push(`stripe_secret_key = $${idx++}`);
      vals.push(secretKey || null);
    }

    if (publishableKey !== undefined) {
      if (publishableKey && !publishableKey.startsWith('pk_')) {
        return res.status(400).json({ error: 'Publishable key must start with pk_' });
      }
      setClauses.push(`stripe_publishable_key = $${idx++}`);
      vals.push(publishableKey || null);
    }

    if (webhookSecret !== undefined) {
      if (webhookSecret && !webhookSecret.startsWith('whsec_')) {
        return res.status(400).json({ error: 'Webhook secret must start with whsec_' });
      }
      setClauses.push(`stripe_webhook_secret = $${idx++}`);
      vals.push(webhookSecret || null);
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    setClauses.push(`updated_at = NOW()`);
    vals.push(req.user.id);

    await pool.query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${idx}`,
      vals
    );

    res.json({ message: 'Stripe settings updated' });
  } catch (err) { next(err); }
}

module.exports = { getStripeSettings, updateStripeSettings };
