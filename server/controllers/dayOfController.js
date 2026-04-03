/**
 * Day-of event change controller.
 *
 * Allows tournament directors to add or remove individual events from an
 * existing registration on the day of competition without going through the
 * full checkout flow.
 *
 * Add event    → INSERT into registration_events, adjust total_due, log override
 * Remove event → DELETE from registration_events, adjust total_due,
 *                attempt Stripe partial refund if payment was via Stripe, log override
 */
const pool = require('../db/pool');

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve the Stripe secret key for a tournament.
 * Returns null if no key is available (cash tournaments, etc.).
 */
async function _resolveStripeKey(tournament) {
  const mode = tournament.payment_mode || 'stripe';
  try {
    if (mode === 'cash') return null;
    if (mode === 'direct') {
      const { rows } = await pool.query(
        'SELECT stripe_secret_key FROM users WHERE id = $1',
        [tournament.created_by]
      );
      return rows[0]?.stripe_secret_key || null;
    }
    // platform mode
    const platformSettings = require('../db/queries/platformSettings');
    return await platformSettings.getStripeSecretKey();
  } catch (_) {
    return null;
  }
}

/**
 * Attempt a Stripe partial refund.
 * Returns { refundId, refundAmount } on success or throws on hard failure.
 * Returns null if no payment intent is found (cash, free, etc.).
 */
async function _issueStripeRefund(tournament, registrationId, amountCents) {
  if (amountCents <= 0) return null;

  // Find the most recent completed payment transaction for this registration
  const { rows } = await pool.query(
    `SELECT pt.stripe_payment_intent_id, pt.stripe_session_id
     FROM payment_transactions pt
     JOIN registrations r ON r.payment_transaction_id = pt.id
     WHERE r.id = $1
       AND pt.status = 'completed'
       AND pt.stripe_payment_intent_id IS NOT NULL
     ORDER BY pt.created_at DESC
     LIMIT 1`,
    [registrationId]
  );

  const pi = rows[0]?.stripe_payment_intent_id;
  if (!pi) return null;

  const stripeKey = await _resolveStripeKey(tournament);
  if (!stripeKey) return null;

  const stripe = require('stripe')(stripeKey);
  const refund = await stripe.refunds.create({
    payment_intent: pi,
    amount: amountCents,
    reason: 'requested_by_customer',
  });
  return { refundId: refund.id, refundAmount: amountCents / 100 };
}

// ── controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/tournaments/:id/registrations/:registrationId/events
 * List current events for a registration (director view).
 */
async function listEvents(req, res, next) {
  try {
    const { id: tournamentId, registrationId } = req.params;

    // Verify registration belongs to this tournament
    const { rows: regRows } = await pool.query(
      `SELECT r.id, r.total_due, r.amount_paid, r.payment_status,
              r.notes AS reg_notes,
              cp.first_name, cp.last_name
       FROM registrations r
       LEFT JOIN competitor_profiles cp ON cp.id = r.profile_id
       WHERE r.id = $1 AND r.tournament_id = $2 AND r.status != 'cancelled'`,
      [registrationId, tournamentId]
    );
    if (!regRows[0]) return res.status(404).json({ error: 'Registration not found' });

    const { rows: eventRows } = await pool.query(
      `SELECT re.event_id, re.is_primary, re.price, re.selection_order,
              te.name AS event_name, te.event_type
       FROM registration_events re
       LEFT JOIN tournament_events te ON te.id::text = re.event_id::text
       WHERE re.registration_id = $1
       ORDER BY re.selection_order ASC`,
      [registrationId]
    );

    const { rows: overrideRows } = await pool.query(
      `SELECT action, event_id, price, refund_issued, refund_amount, notes, created_at
       FROM director_event_overrides
       WHERE registration_id = $1
       ORDER BY created_at DESC`,
      [registrationId]
    );

    res.json({
      registration: regRows[0],
      events: eventRows,
      overrides: overrideRows,
    });
  } catch (err) { next(err); }
}

/**
 * POST /api/tournaments/:id/registrations/:registrationId/events/add
 * Director adds an event to an existing registration.
 * Body: { eventId, price?, notes? }
 */
async function addEvent(req, res, next) {
  try {
    const { id: tournamentId, registrationId } = req.params;
    const { eventId, price = 0, notes } = req.body;

    if (!eventId) return res.status(400).json({ error: 'eventId is required' });

    // Verify registration
    const { rows: regRows } = await pool.query(
      `SELECT r.*, t.created_by, t.payment_mode
       FROM registrations r
       JOIN tournaments t ON t.id = r.tournament_id
       WHERE r.id = $1 AND r.tournament_id = $2 AND r.status != 'cancelled'`,
      [registrationId, tournamentId]
    );
    if (!regRows[0]) return res.status(404).json({ error: 'Registration not found' });

    // Check event isn't already registered
    const { rows: existing } = await pool.query(
      `SELECT id FROM registration_events
       WHERE registration_id = $1 AND event_id::text = $2::text`,
      [registrationId, eventId]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Competitor is already registered for this event' });
    }

    // Verify event belongs to this tournament
    const { rows: evtRows } = await pool.query(
      `SELECT id, name, event_type FROM tournament_events
       WHERE id::text = $1::text AND tournament_id = $2`,
      [eventId, tournamentId]
    );
    if (!evtRows[0]) return res.status(404).json({ error: 'Event not found in this tournament' });

    const eventPrice = parseFloat(price) || 0;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insert registration event
      await client.query(
        `INSERT INTO registration_events (registration_id, event_id, is_primary, price, selection_order)
         VALUES ($1, $2, false, $3, (
           SELECT COALESCE(MAX(selection_order), -1) + 1
           FROM registration_events WHERE registration_id = $1
         ))
         ON CONFLICT (registration_id, event_id) DO NOTHING`,
        [registrationId, eventId, eventPrice]
      );

      // Increase total_due by event price
      await client.query(
        `UPDATE registrations
         SET total_due = total_due + $1, updated_at = NOW()
         WHERE id = $2`,
        [eventPrice, registrationId]
      );

      // Audit log
      await client.query(
        `INSERT INTO director_event_overrides
           (tournament_id, registration_id, event_id, action, price, notes, performed_by)
         VALUES ($1, $2, $3, 'add', $4, $5, $6)`,
        [tournamentId, registrationId, eventId, eventPrice, notes || null, req.user.id]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Return updated registration summary
    const { rows: updatedReg } = await pool.query(
      `SELECT id, total_due, amount_paid, payment_status FROM registrations WHERE id = $1`,
      [registrationId]
    );

    res.status(201).json({
      message: `Added "${evtRows[0].name}" to registration`,
      registration: updatedReg[0],
      event: evtRows[0],
    });
  } catch (err) { next(err); }
}

/**
 * POST /api/tournaments/:id/registrations/:registrationId/events/remove
 * Director removes an event from an existing registration.
 * Body: { eventId, issueRefund?, notes? }
 *
 * If issueRefund=true and registration was paid via Stripe, a partial refund
 * is attempted for the event price. The override log records the outcome
 * regardless of whether the refund succeeded.
 */
async function removeEvent(req, res, next) {
  try {
    const { id: tournamentId, registrationId } = req.params;
    const { eventId, issueRefund = false, notes } = req.body;

    if (!eventId) return res.status(400).json({ error: 'eventId is required' });

    // Verify registration
    const { rows: regRows } = await pool.query(
      `SELECT r.*, t.created_by, t.payment_mode, t.currency
       FROM registrations r
       JOIN tournaments t ON t.id = r.tournament_id
       WHERE r.id = $1 AND r.tournament_id = $2 AND r.status != 'cancelled'`,
      [registrationId, tournamentId]
    );
    if (!regRows[0]) return res.status(404).json({ error: 'Registration not found' });

    // Verify event is currently registered
    const { rows: evtRows } = await pool.query(
      `SELECT re.id AS re_id, re.price, te.name AS event_name
       FROM registration_events re
       LEFT JOIN tournament_events te ON te.id::text = re.event_id::text
       WHERE re.registration_id = $1 AND re.event_id::text = $2::text`,
      [registrationId, eventId]
    );
    if (!evtRows[0]) {
      return res.status(404).json({ error: 'Competitor is not registered for this event' });
    }

    // Can't remove the only event
    const { rows: countRows } = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM registration_events WHERE registration_id = $1',
      [registrationId]
    );
    if (countRows[0].cnt <= 1) {
      return res.status(409).json({
        error: 'Cannot remove the only event from a registration. Cancel the registration instead.',
        code: 'LAST_EVENT',
      });
    }

    const eventPrice = parseFloat(evtRows[0].price) || 0;
    const registration = regRows[0];

    // Attempt Stripe refund (fire-before-db, so we know the refund result to log)
    let refundResult = null;
    let refundError  = null;
    if (issueRefund && eventPrice > 0) {
      const amountCents = Math.round(eventPrice * 100);
      try {
        refundResult = await _issueStripeRefund(registration, registrationId, amountCents);
      } catch (e) {
        // Non-fatal — still remove the event, just note refund failed
        refundError = e.message;
        console.warn('[day-of] Stripe refund failed:', e.message);
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Remove registration event
      await client.query(
        `DELETE FROM registration_events
         WHERE registration_id = $1 AND event_id::text = $2::text`,
        [registrationId, eventId]
      );

      // Decrease total_due (floor at 0) and amount_paid if refund succeeded
      const refundAmt = refundResult?.refundAmount || 0;
      await client.query(
        `UPDATE registrations
         SET total_due   = GREATEST(0, total_due - $1),
             amount_paid = GREATEST(0, amount_paid - $2),
             updated_at  = NOW()
         WHERE id = $3`,
        [eventPrice, refundAmt, registrationId]
      );

      // Audit log
      await client.query(
        `INSERT INTO director_event_overrides
           (tournament_id, registration_id, event_id, action, price,
            refund_issued, refund_amount, stripe_refund_id, notes, performed_by)
         VALUES ($1, $2, $3, 'remove', $4, $5, $6, $7, $8, $9)`,
        [
          tournamentId,
          registrationId,
          eventId,
          eventPrice,
          !!refundResult,
          refundResult?.refundAmount || null,
          refundResult?.refundId || null,
          notes || (refundError ? `Refund failed: ${refundError}` : null),
          req.user.id,
        ]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const { rows: updatedReg } = await pool.query(
      `SELECT id, total_due, amount_paid, payment_status FROM registrations WHERE id = $1`,
      [registrationId]
    );

    res.json({
      message: `Removed "${evtRows[0].event_name}" from registration`,
      registration: updatedReg[0],
      refundIssued: !!refundResult,
      refundAmount: refundResult?.refundAmount || 0,
      refundError: refundError || null,
    });
  } catch (err) { next(err); }
}

module.exports = { listEvents, addEvent, removeEvent };
