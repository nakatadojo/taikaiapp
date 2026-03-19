/**
 * server/controllers/platformSettingsController.js
 *
 * Super-admin endpoints for managing platform-level Stripe credentials.
 * Keys are stored in the platform_settings table and served via the
 * platformSettings module (with env-var fallback).
 */

const platformSettings = require('../config/platformSettings');

/** Mask a key for display: sk_live_abc...1234 → sk_live_...1234 */
function maskKey(val) {
  if (!val) return null;
  if (val.length <= 8) return '***';
  return val.slice(0, 7) + '...' + val.slice(-4);
}

/**
 * GET /api/admin/platform-settings/stripe
 * Returns masked keys + boolean flags indicating whether each is set.
 */
async function getStripeSettings(req, res, next) {
  try {
    const secretKey      = await platformSettings.get('STRIPE_SECRET_KEY');
    const webhookSecret  = await platformSettings.get('STRIPE_WEBHOOK_SECRET');
    const publishableKey = await platformSettings.get('STRIPE_PUBLISHABLE_KEY');

    res.json({
      secretKey:        maskKey(secretKey),
      webhookSecret:    maskKey(webhookSecret),
      publishableKey:   maskKey(publishableKey),
      secretKeySet:     !!secretKey,
      webhookSecretSet: !!webhookSecret,
      publishableKeySet:!!publishableKey,
    });
  } catch (err) { next(err); }
}

/**
 * PUT /api/admin/platform-settings/stripe
 * Body: { secretKey?, webhookSecret?, publishableKey? }
 * Pass an empty string to clear a key.
 */
async function updateStripeSettings(req, res, next) {
  try {
    const { secretKey, webhookSecret, publishableKey } = req.body;

    if (secretKey !== undefined) {
      if (secretKey && !secretKey.startsWith('sk_')) {
        return res.status(400).json({ error: 'Secret key must start with sk_' });
      }
      await platformSettings.set('STRIPE_SECRET_KEY', secretKey || null);
    }

    if (webhookSecret !== undefined) {
      if (webhookSecret && !webhookSecret.startsWith('whsec_')) {
        return res.status(400).json({ error: 'Webhook secret must start with whsec_' });
      }
      await platformSettings.set('STRIPE_WEBHOOK_SECRET', webhookSecret || null);
    }

    if (publishableKey !== undefined) {
      if (publishableKey && !publishableKey.startsWith('pk_')) {
        return res.status(400).json({ error: 'Publishable key must start with pk_' });
      }
      await platformSettings.set('STRIPE_PUBLISHABLE_KEY', publishableKey || null);
    }

    res.json({ message: 'Platform Stripe settings updated' });
  } catch (err) { next(err); }
}

module.exports = { getStripeSettings, updateStripeSettings };
