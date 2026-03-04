const creditQueries = require('../db/queries/credits');
const pool = require('../db/pool');

// ── Credit Packages ─────────────────────────────────────────────────────────

const CREDIT_PACKAGES = [
  { id: 'starter',  credits: 50,  priceInCents: 4900,  label: 'Starter — 50 credits',  pricePerCredit: '$0.98' },
  { id: 'standard', credits: 150, priceInCents: 12900, label: 'Standard — 150 credits', pricePerCredit: '$0.86' },
  { id: 'pro',      credits: 500, priceInCents: 39900, label: 'Pro — 500 credits',      pricePerCredit: '$0.80' },
];

/**
 * GET /api/credits/packages
 * Returns available credit packages.
 */
async function getPackages(req, res) {
  res.json({ packages: CREDIT_PACKAGES });
}

/**
 * GET /api/credits/balance
 * Returns the logged-in user's credit balance.
 */
async function getBalance(req, res, next) {
  try {
    const balance = await creditQueries.getBalance(req.user.id);
    res.json({ balance });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/credits/transactions
 * Returns the logged-in user's credit transaction history.
 */
async function getTransactions(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const transactions = await creditQueries.getTransactions(req.user.id, { limit, offset });
    res.json({ transactions });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/credits/checkout
 * Creates a Stripe Checkout Session for credit purchase.
 */
async function checkout(req, res, next) {
  try {
    const { packageId } = req.body;

    const pkg = CREDIT_PACKAGES.find(p => p.id === packageId);
    if (!pkg) {
      return res.status(400).json({ error: 'Invalid package ID' });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Payment processing is not configured' });
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Taikai Credits — ${pkg.label}`,
            description: `${pkg.credits} registration credits for your tournaments`,
          },
          unit_amount: pkg.priceInCents,
        },
        quantity: 1,
      }],
      success_url: `${appUrl}/director.html#credits-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/director.html#credits`,
      metadata: {
        userId: req.user.id,
        packageId: pkg.id,
        credits: pkg.credits.toString(),
        type: 'credit_purchase',
      },
    });

    res.json({
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/credits/confirm
 * Confirms a Stripe payment and adds credits.
 */
async function confirm(req, res, next) {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Payment processing is not configured' });
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // Verify this is a credit purchase
    if (session.metadata.type !== 'credit_purchase') {
      return res.status(400).json({ error: 'Invalid session type' });
    }

    // Verify user owns this session
    if (session.metadata.userId !== req.user.id) {
      return res.status(403).json({ error: 'Session does not belong to this user' });
    }

    // Check if already processed (idempotency)
    const existing = await pool.query(
      'SELECT id FROM credit_transactions WHERE stripe_session_id = $1',
      [sessionId]
    );
    if (existing.rows.length > 0) {
      const balance = await creditQueries.getBalance(req.user.id);
      return res.json({
        message: 'Credits already applied',
        credits: parseInt(session.metadata.credits),
        balance,
      });
    }

    // Add credits
    const credits = parseInt(session.metadata.credits);
    const pkg = CREDIT_PACKAGES.find(p => p.id === session.metadata.packageId);
    const description = `${credits} credits purchased (${pkg?.label || session.metadata.packageId})`;

    const newBalance = await creditQueries.addCredits(
      req.user.id, credits, 'purchase', description,
      { stripeSessionId: sessionId }
    );

    res.json({
      message: 'Credits added successfully',
      credits,
      balance: newBalance,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPackages,
  getBalance,
  getTransactions,
  checkout,
  confirm,
  CREDIT_PACKAGES,
};
