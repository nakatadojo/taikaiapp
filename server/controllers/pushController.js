const pushService = require('../services/pushService');

/**
 * GET /api/push/vapid-public-key
 * Returns the VAPID public key needed by the browser to subscribe.
 */
async function getVapidKey(req, res) {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    return res.status(503).json({ error: 'Push notifications not configured' });
  }
  res.json({ publicKey: key });
}

/**
 * POST /api/push/subscribe
 * Save a push subscription from the browser.
 * Body: { subscription: PushSubscription }
 */
async function subscribePush(req, res, next) {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'subscription object with endpoint is required' });
    }
    const saved = await pushService.subscribe(subscription, req.user?.id || null);
    res.status(201).json({ message: 'Subscribed to push notifications', id: saved.id });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/push/unsubscribe
 * Remove a push subscription.
 * Body: { endpoint: string }
 */
async function unsubscribePush(req, res, next) {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: 'endpoint is required' });
    }
    await pushService.unsubscribe(endpoint);
    res.json({ message: 'Unsubscribed from push notifications' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getVapidKey, subscribePush, unsubscribePush };
