/**
 * Push Notification Service (Web Push / VAPID)
 *
 * Manages subscription storage and push delivery using the web-push library.
 *
 * VAPID keys must be set in .env:
 *   VAPID_PUBLIC_KEY=...
 *   VAPID_PRIVATE_KEY=...
 *   VAPID_SUBJECT=mailto:admin@taikaiapp.com   (or https://yoursite.com)
 */

const webpush = require('web-push');
const pool = require('../db/pool');

let pushEnabled = false;

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@taikaiapp.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  pushEnabled = true;
  console.log('✓ Web Push (VAPID) configured');
} else {
  console.log('ℹ VAPID keys not set — push notifications disabled');
}

// ── Subscription Management ──────────────────────────────────────────────────

/**
 * Save a push subscription to the database.
 * @param {object} subscription  - PushSubscription from browser ({ endpoint, keys: { p256dh, auth } })
 * @param {string|null} userId   - User ID if authenticated
 */
async function subscribe(subscription, userId) {
  const { endpoint, keys } = subscription;
  const { p256dh, auth } = keys || {};

  if (!endpoint || !p256dh || !auth) {
    throw new Error('Invalid push subscription: missing endpoint or keys');
  }

  const { rows } = await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint)
     DO UPDATE SET user_id = COALESCE($1, push_subscriptions.user_id),
                   p256dh = $3, auth = $4
     RETURNING *`,
    [userId || null, endpoint, p256dh, auth]
  );
  return rows[0];
}

/**
 * Remove a push subscription by endpoint.
 */
async function unsubscribe(endpoint) {
  const { rows } = await pool.query(
    'DELETE FROM push_subscriptions WHERE endpoint = $1 RETURNING id',
    [endpoint]
  );
  return rows[0] || null;
}

// ── Push Delivery ────────────────────────────────────────────────────────────

/**
 * Send a push notification to all subscriptions belonging to a user.
 * @param {string} userId
 * @param {object} payload  - { title, body, url?, icon? }
 */
async function sendToUser(userId, payload) {
  if (!pushEnabled) return;

  const { rows } = await pool.query(
    'SELECT * FROM push_subscriptions WHERE user_id = $1',
    [userId]
  );

  return _sendToSubscriptions(rows, payload);
}

/**
 * Broadcast a push notification to all subscribers for a tournament.
 * This finds all subscriptions linked to users registered for the tournament.
 * @param {string} tournamentId
 * @param {object} payload
 */
async function sendToAll(tournamentId, payload) {
  if (!pushEnabled) return;

  const { rows } = await pool.query(
    `SELECT DISTINCT ps.*
     FROM push_subscriptions ps
     JOIN registrations r ON r.user_id = ps.user_id
     WHERE r.tournament_id = $1`,
    [tournamentId]
  );

  return _sendToSubscriptions(rows, payload);
}

/**
 * Broadcast to ALL push subscribers (platform-wide announcement).
 * @param {object} payload
 */
async function broadcast(payload) {
  if (!pushEnabled) return;

  const { rows } = await pool.query('SELECT * FROM push_subscriptions');
  return _sendToSubscriptions(rows, payload);
}

/**
 * Internal: send to an array of subscription rows, collect stale ones for cleanup.
 */
async function _sendToSubscriptions(subscriptions, payload) {
  const payloadStr = JSON.stringify(payload);
  const staleEndpoints = [];
  const results = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payloadStr
        );
        results.push({ endpoint: sub.endpoint, ok: true });
      } catch (err) {
        // 410 Gone or 404 Not Found → subscription is stale, remove it
        if (err.statusCode === 410 || err.statusCode === 404) {
          staleEndpoints.push(sub.endpoint);
        } else {
          console.warn('[push] send error:', err.message);
        }
        results.push({ endpoint: sub.endpoint, ok: false, error: err.message });
      }
    })
  );

  // Clean up stale subscriptions
  for (const endpoint of staleEndpoints) {
    try {
      await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
    } catch (_) { /* ignore */ }
  }

  return results;
}

module.exports = { subscribe, unsubscribe, sendToUser, sendToAll, broadcast, pushEnabled };
