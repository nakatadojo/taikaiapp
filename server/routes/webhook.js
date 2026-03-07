/**
 * Stripe Webhook Handler
 *
 * Handles the following Stripe events:
 *   - checkout.session.completed  — registration/credit purchase confirmation
 *   - charge.refunded             — marks payment + registration as refunded
 *   - charge.dispute.created      — marks payment + registration as disputed
 *   - charge.dispute.closed       — resolves dispute (won → paid, lost → refunded)
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
const notificationQueries = require('../db/queries/notifications');
const { sendRegistrationConfirmationEmail } = require('../email');

const router = express.Router();

/** Event types we handle */
const HANDLED_EVENTS = new Set([
  'checkout.session.completed',
  'charge.refunded',
  'charge.dispute.created',
  'charge.dispute.closed',
]);

/**
 * POST /api/webhooks/stripe
 *
 * Central Stripe webhook endpoint. Routes events to dedicated handlers.
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

    // Skip events we don't handle
    if (!HANDLED_EVENTS.has(event.type)) {
      return res.json({ received: true, handled: false });
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const metadata = session.metadata || {};

          // ── Credit purchase ────────────────────────────────────────
          if (metadata.type === 'credit_purchase') {
            await handleCreditPurchase(session, metadata);
            return res.json({ received: true, handled: true, type: 'credit_purchase' });
          }

          // ── Tournament registration ────────────────────────────────
          if (metadata.cartData) {
            await handleRegistrationPayment(session, metadata);
            return res.json({ received: true, handled: true, type: 'registration' });
          }

          // Unknown session type — acknowledge but don't process
          console.log('Webhook: Unknown session type, metadata:', JSON.stringify(metadata));
          return res.json({ received: true, handled: false });
        }

        case 'charge.refunded': {
          await handleChargeRefunded(event.data.object);
          return res.json({ received: true, handled: true, type: 'charge.refunded' });
        }

        case 'charge.dispute.created': {
          await handleDisputeCreated(event.data.object);
          return res.json({ received: true, handled: true, type: 'charge.dispute.created' });
        }

        case 'charge.dispute.closed': {
          await handleDisputeClosed(event.data.object);
          return res.json({ received: true, handled: true, type: 'charge.dispute.closed' });
        }

        default:
          return res.json({ received: true, handled: false });
      }
    } catch (err) {
      console.error('Webhook processing error:', err);
      // Return 200 so Stripe doesn't retry for errors we've logged
      // (e.g., idempotent duplicates throw unique constraint violations)
      return res.json({ received: true, handled: false, error: err.message });
    }
  }
);

// ── Checkout Session Handlers ────────────────────────────────────────────────

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
 * Also stores the payment_intent ID from the Stripe session for future
 * refund/dispute lookups.
 */
async function handleRegistrationPayment(session, metadata) {
  const { userId, tournamentId, discountCode } = metadata;
  const sessionId = session.id;
  const paymentIntentId = session.payment_intent || null;

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
    // Even if already completed, backfill payment_intent_id if missing
    if (paymentIntentId && !existing.rows[0].stripe_payment_intent_id) {
      await pool.query(
        'UPDATE payment_transactions SET stripe_payment_intent_id = $1 WHERE id = $2',
        [paymentIntentId, existing.rows[0].id]
      );
    }
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

    // Mark payment as completed and store payment_intent_id
    await client.query(
      `UPDATE payment_transactions
         SET status = 'completed', completed_at = NOW(),
             stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id)
       WHERE stripe_session_id = $1 AND status != 'completed'`,
      [sessionId, paymentIntentId]
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

// ── Refund & Dispute Handlers ────────────────────────────────────────────────

/**
 * Find a payment_transaction by a Stripe charge's payment_intent ID.
 * Stripe charges reference a payment_intent; our payment_transactions store
 * stripe_payment_intent_id (set during checkout.session.completed).
 *
 * Returns the payment_transaction row or null.
 */
async function findPaymentByPaymentIntent(paymentIntentId) {
  if (!paymentIntentId) return null;
  const result = await pool.query(
    'SELECT * FROM payment_transactions WHERE stripe_payment_intent_id = $1',
    [paymentIntentId]
  );
  return result.rows[0] || null;
}

/**
 * Handle charge.refunded — Stripe sends this when a charge is fully or partially refunded.
 *
 * - Finds the payment_transaction by payment_intent
 * - Updates payment_transaction.status to 'refunded'
 * - Updates all associated registrations' payment_status to 'refunded'
 * - Creates a notification for the tournament director
 */
async function handleChargeRefunded(charge) {
  const paymentIntentId = charge.payment_intent;
  const chargeId = charge.id;

  console.log(`Webhook [charge.refunded]: charge=${chargeId}, pi=${paymentIntentId}`);

  const payment = await findPaymentByPaymentIntent(paymentIntentId);
  if (!payment) {
    console.log(`Webhook [charge.refunded]: No payment_transaction found for pi=${paymentIntentId} (skipping)`);
    return;
  }

  // Idempotency: already refunded
  if (payment.status === 'refunded') {
    console.log(`Webhook [charge.refunded]: Payment ${payment.id} already refunded (idempotent)`);
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update payment_transaction status
    await client.query(
      `UPDATE payment_transactions SET status = 'refunded' WHERE id = $1`,
      [payment.id]
    );

    // Update all registrations linked to this payment
    await client.query(
      `UPDATE registrations SET payment_status = 'refunded', updated_at = NOW()
       WHERE payment_transaction_id = $1`,
      [payment.id]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Notify the tournament director
  const tournament = await tournamentQueries.findById(payment.tournament_id);
  if (tournament && tournament.created_by) {
    const amountRefunded = charge.amount_refunded
      ? (charge.amount_refunded / 100).toFixed(2)
      : (payment.amount_total / 100).toFixed(2);

    await notificationQueries.create({
      recipientId: tournament.created_by,
      tournamentId: tournament.id,
      type: 'payment_refunded',
      payload: {
        message: `A payment of $${amountRefunded} has been refunded for ${tournament.name}.`,
        chargeId,
        paymentTransactionId: payment.id,
        amountRefunded,
      },
    });
    console.log(`Webhook [charge.refunded]: Notified director ${tournament.created_by}`);
  }

  console.log(`Webhook [charge.refunded]: Payment ${payment.id} marked as refunded`);
}

/**
 * Handle charge.dispute.created — Stripe sends this when a customer opens a dispute.
 *
 * - Finds the payment_transaction by the disputed charge's payment_intent
 * - Updates payment_transaction.status to 'disputed'
 * - Updates all associated registrations' payment_status to 'disputed'
 * - Creates an urgent notification for the tournament director
 */
async function handleDisputeCreated(dispute) {
  const chargeId = dispute.charge;
  const disputeId = dispute.id;
  const reason = dispute.reason || 'unknown';
  const amount = dispute.amount ? (dispute.amount / 100).toFixed(2) : '0.00';

  console.log(`Webhook [charge.dispute.created]: dispute=${disputeId}, charge=${chargeId}, reason=${reason}`);

  // Stripe disputes reference a charge ID. We need to retrieve the charge
  // to get its payment_intent. Use Stripe API if available, otherwise
  // try to find the payment by charge lookup.
  let paymentIntentId = null;
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const chargeObj = await stripe.charges.retrieve(chargeId);
    paymentIntentId = chargeObj.payment_intent;
  } catch (err) {
    console.warn(`Webhook [charge.dispute.created]: Failed to retrieve charge ${chargeId}:`, err.message);
  }

  const payment = await findPaymentByPaymentIntent(paymentIntentId);
  if (!payment) {
    console.log(`Webhook [charge.dispute.created]: No payment_transaction found for pi=${paymentIntentId} (skipping)`);
    return;
  }

  // Idempotency: already disputed
  if (payment.status === 'disputed') {
    console.log(`Webhook [charge.dispute.created]: Payment ${payment.id} already disputed (idempotent)`);
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update payment_transaction status
    await client.query(
      `UPDATE payment_transactions SET status = 'disputed' WHERE id = $1`,
      [payment.id]
    );

    // Update all registrations linked to this payment
    await client.query(
      `UPDATE registrations SET payment_status = 'disputed', updated_at = NOW()
       WHERE payment_transaction_id = $1`,
      [payment.id]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Notify the tournament director (urgent)
  const tournament = await tournamentQueries.findById(payment.tournament_id);
  if (tournament && tournament.created_by) {
    await notificationQueries.create({
      recipientId: tournament.created_by,
      tournamentId: tournament.id,
      type: 'payment_disputed',
      payload: {
        message: `URGENT: A $${amount} payment for ${tournament.name} has been disputed (reason: ${reason}). Check your Stripe dashboard immediately.`,
        disputeId,
        chargeId,
        paymentTransactionId: payment.id,
        amount,
        reason,
        urgent: true,
      },
    });
    console.log(`Webhook [charge.dispute.created]: Notified director ${tournament.created_by} (urgent)`);
  }

  console.log(`Webhook [charge.dispute.created]: Payment ${payment.id} marked as disputed`);
}

/**
 * Handle charge.dispute.closed — Stripe sends this when a dispute is resolved.
 *
 * - If dispute status is 'won' (merchant wins): restore payment to 'paid'
 * - If dispute status is 'lost' (customer wins): set payment to 'refunded'
 * - Notifies the tournament director either way
 */
async function handleDisputeClosed(dispute) {
  const chargeId = dispute.charge;
  const disputeId = dispute.id;
  const disputeStatus = dispute.status; // 'won', 'lost', 'warning_closed', etc.
  const amount = dispute.amount ? (dispute.amount / 100).toFixed(2) : '0.00';

  console.log(`Webhook [charge.dispute.closed]: dispute=${disputeId}, status=${disputeStatus}`);

  // Retrieve the charge to find our payment_intent
  let paymentIntentId = null;
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const chargeObj = await stripe.charges.retrieve(chargeId);
    paymentIntentId = chargeObj.payment_intent;
  } catch (err) {
    console.warn(`Webhook [charge.dispute.closed]: Failed to retrieve charge ${chargeId}:`, err.message);
  }

  const payment = await findPaymentByPaymentIntent(paymentIntentId);
  if (!payment) {
    console.log(`Webhook [charge.dispute.closed]: No payment_transaction found for pi=${paymentIntentId} (skipping)`);
    return;
  }

  // Determine new statuses based on dispute outcome
  const merchantWon = disputeStatus === 'won';
  const newPaymentTxStatus = merchantWon ? 'completed' : 'refunded';
  const newRegPaymentStatus = merchantWon ? 'paid' : 'refunded';
  const outcomeLabel = merchantWon ? 'resolved in your favor' : 'resolved in the customer\'s favor';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update payment_transaction status
    await client.query(
      `UPDATE payment_transactions SET status = $1 WHERE id = $2`,
      [newPaymentTxStatus, payment.id]
    );

    // Update all registrations linked to this payment
    await client.query(
      `UPDATE registrations SET payment_status = $1, updated_at = NOW()
       WHERE payment_transaction_id = $2`,
      [newRegPaymentStatus, payment.id]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Notify the tournament director
  const tournament = await tournamentQueries.findById(payment.tournament_id);
  if (tournament && tournament.created_by) {
    await notificationQueries.create({
      recipientId: tournament.created_by,
      tournamentId: tournament.id,
      type: 'dispute_closed',
      payload: {
        message: `Dispute for $${amount} on ${tournament.name} has been ${outcomeLabel}.`,
        disputeId,
        chargeId,
        paymentTransactionId: payment.id,
        amount,
        disputeStatus,
        merchantWon,
      },
    });
    console.log(`Webhook [charge.dispute.closed]: Notified director ${tournament.created_by}, outcome=${disputeStatus}`);
  }

  console.log(`Webhook [charge.dispute.closed]: Payment ${payment.id} → ${newPaymentTxStatus}`);
}

module.exports = router;
