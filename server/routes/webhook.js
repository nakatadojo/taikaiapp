/**
 * Stripe Webhook Handler
 *
 * Handles checkout.session.completed events to ensure registrations and
 * credit purchases are confirmed even if the client-side redirect fails.
 *
 * IMPORTANT: This route must be mounted BEFORE express.json() middleware
 * because Stripe requires the raw body for signature verification.
 *
 * Environment variables:
 *   STRIPE_SECRET_KEY      – Stripe API key
 *   STRIPE_WEBHOOK_SECRET  – Webhook signing secret (from Stripe Dashboard)
 */

const express = require('express');
const pool = require('../db/pool');
const tournamentQueries = require('../db/queries/tournaments');
const creditQueries = require('../db/queries/credits');
const discountQueries = require('../db/queries/discounts');
const userQueries = require('../db/queries/users');
const { sendRegistrationConfirmationEmail } = require('../email');

const router = express.Router();

/**
 * POST /api/webhooks/stripe
 *
 * Stripe sends this when a Checkout Session completes.
 * We use it as a fallback to guarantee registration/credit confirmation.
 */
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const sig = req.headers['stripe-signature'];

    let event;

    // Verify webhook signature if secret is configured
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
      } catch (err) {
        console.warn('⚠ Webhook signature verification failed:', err.message);
        return res.status(400).json({ error: 'Webhook signature verification failed' });
      }
    } else {
      // No webhook secret — parse body directly (dev mode only)
      try {
        event = JSON.parse(req.body.toString());
        console.warn('⚠ Webhook received without signature verification (STRIPE_WEBHOOK_SECRET not set)');
      } catch (err) {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
    }

    // Only handle checkout.session.completed
    if (event.type !== 'checkout.session.completed') {
      return res.json({ received: true, handled: false });
    }

    const session = event.data.object;
    const metadata = session.metadata || {};

    try {
      // ── Credit purchase ──────────────────────────────────────────────
      if (metadata.type === 'credit_purchase') {
        await handleCreditPurchase(session, metadata);
        return res.json({ received: true, handled: true, type: 'credit_purchase' });
      }

      // ── Tournament registration ──────────────────────────────────────
      if (metadata.cartData) {
        await handleRegistrationPayment(session, metadata);
        return res.json({ received: true, handled: true, type: 'registration' });
      }

      // Unknown session type — acknowledge but don't process
      console.log('Webhook: Unknown session type, metadata:', JSON.stringify(metadata));
      return res.json({ received: true, handled: false });
    } catch (err) {
      console.error('Webhook processing error:', err);
      // Return 200 so Stripe doesn't retry for errors we've logged
      // (e.g., idempotent duplicates throw unique constraint violations)
      return res.json({ received: true, handled: false, error: err.message });
    }
  }
);

/**
 * Handle credit purchase confirmation from webhook.
 */
async function handleCreditPurchase(session, metadata) {
  const { userId, credits } = metadata;
  const sessionId = session.id;
  const creditAmount = parseInt(credits);

  // Idempotency: check if already processed
  const existing = await pool.query(
    'SELECT id FROM credit_transactions WHERE stripe_session_id = $1',
    [sessionId]
  );
  if (existing.rows.length > 0) {
    console.log(`Webhook: Credit purchase ${sessionId} already processed (idempotent)`);
    return;
  }

  // Add credits (signature: userId, amount, type, description, { stripeSessionId })
  await creditQueries.addCredits(userId, creditAmount, 'purchase', `Credit purchase (webhook)`, { stripeSessionId: sessionId });
  console.log(`Webhook: Added ${creditAmount} credits for user ${userId} (session ${sessionId})`);
}

/**
 * Handle registration payment confirmation from webhook.
 */
async function handleRegistrationPayment(session, metadata) {
  const { userId, tournamentId, discountCode } = metadata;
  const sessionId = session.id;

  // Idempotency: check if payment already completed
  const existing = await pool.query(
    'SELECT * FROM payment_transactions WHERE stripe_session_id = $1',
    [sessionId]
  );

  if (!existing.rows[0]) {
    console.log(`Webhook: No payment_transaction found for ${sessionId} — session may have been created differently`);
    return;
  }

  if (existing.rows[0].status === 'completed') {
    console.log(`Webhook: Registration payment ${sessionId} already completed (idempotent)`);
    return;
  }

  // Parse cart data
  const cartData = JSON.parse(metadata.cartData);
  const tournament = await tournamentQueries.findById(tournamentId);

  // Get discount data if applicable
  let discountData = null;
  if (discountCode) {
    discountData = await discountQueries.findByCode(discountCode);
  }

  // Create registrations in a transaction
  const client = await pool.connect();
  const registrationIds = [];
  try {
    await client.query('BEGIN');

    for (const comp of cartData.competitors) {
      const regResult = await client.query(
        `INSERT INTO registrations
          (tournament_id, user_id, profile_id, registered_by, payment_status,
           amount_paid, total_due, payment_transaction_id, stripe_session_id, status)
         VALUES ($1, $2, $3, $4, 'paid', $5, $5, $6, $7, 'active')
         ON CONFLICT (tournament_id, profile_id) DO NOTHING
         RETURNING *`,
        [
          tournamentId, userId, comp.profileId, userId,
          comp.subtotal, existing.rows[0].id, sessionId,
        ]
      );

      if (regResult.rows[0]) {
        registrationIds.push(regResult.rows[0].id);

        for (let i = 0; i < comp.events.length; i++) {
          const evt = comp.events[i];
          await client.query(
            `INSERT INTO registration_events
              (registration_id, event_id, is_primary, price, selection_order)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (registration_id, event_id) DO NOTHING`,
            [regResult.rows[0].id, evt.eventId, evt.isPrimary, evt.price, i]
          );
        }
      }
    }

    // Increment discount code usage
    if (discountData?.id) {
      await client.query(
        'UPDATE discount_codes SET times_used = times_used + 1 WHERE id = $1',
        [discountData.id]
      );
    }

    // Mark payment as completed
    await client.query(
      `UPDATE payment_transactions SET status = 'completed', completed_at = NOW()
       WHERE stripe_session_id = $1 AND status != 'completed'`,
      [sessionId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Deduct credits from Event Director
  if (tournament && tournament.created_by && registrationIds.length > 0) {
    try {
      await creditQueries.deductForRegistration(
        tournament.created_by, registrationIds.length, tournamentId,
        registrationIds,
        `Registration (webhook): ${cartData.competitors.map(c => c.name).join(', ')} for ${tournament.name}`
      );
    } catch (creditErr) {
      console.warn('Webhook: Credit deduction failed:', creditErr.message);
    }
  }

  // Send confirmation email
  if (registrationIds.length > 0) {
    try {
      const user = await userQueries.findById(userId);
      if (user) {
        await sendRegistrationConfirmationEmail(
          user.email, tournament, cartData.competitors,
          cartData.total, cartData.discountAmount, sessionId
        );
      }
    } catch (emailErr) {
      console.warn('Webhook: Failed to send confirmation email:', emailErr.message);
    }
  }

  console.log(`Webhook: Registration confirmed for ${registrationIds.length} competitors (session ${sessionId})`);
}

module.exports = router;
