const creditQueries = require('../db/queries/credits');
const creditPackageQueries = require('../db/queries/creditPackages');
const pool = require('../db/pool');
const platformSettings = require('../config/platformSettings');

/**
 * GET /api/credits/packages
 * Returns available credit packages (from database).
 */
async function getPackages(req, res, next) {
  try {
    const packages = await creditPackageQueries.getActive();
    // Map to the expected frontend format
    const formatted = packages.map(p => ({
      id: p.slug,
      credits: p.credits,
      priceInCents: p.price_in_cents,
      label: p.label,
      pricePerCredit: `$${(p.price_in_cents / 100 / p.credits).toFixed(2)}`,
    }));
    res.json({ packages: formatted });
  } catch (err) {
    next(err);
  }
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

    // Look up package from database by slug
    const pkg = await creditPackageQueries.getBySlug(packageId);
    if (!pkg || !pkg.active) {
      return res.status(400).json({ error: 'Invalid package ID' });
    }

    const stripeKey = await platformSettings.getStripeSecretKey();
    if (!stripeKey) {
      return res.status(500).json({ error: 'Payment processing is not configured' });
    }

    const stripe = require('stripe')(stripeKey);
    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    // Ensure user has a Stripe Customer ID
    let stripeCustomerId = null;
    const userRow = await pool.query('SELECT stripe_customer_id, email, first_name, last_name FROM users WHERE id = $1', [req.user.id]);
    const userData = userRow.rows[0];
    if (userData) {
      stripeCustomerId = userData.stripe_customer_id;
      if (!stripeCustomerId) {
        try {
          const customer = await stripe.customers.create({
            email: userData.email,
            name: `${userData.first_name} ${userData.last_name}`,
            metadata: { userId: req.user.id },
          });
          stripeCustomerId = customer.id;
          await pool.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [stripeCustomerId, req.user.id]);
        } catch (e) {
          console.warn('Failed to create Stripe customer:', e.message);
        }
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      ...(stripeCustomerId && { customer: stripeCustomerId }),
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Taikai Credits — ${pkg.label}`,
            description: `${pkg.credits} registration credits for your tournaments`,
          },
          unit_amount: pkg.price_in_cents,
        },
        quantity: 1,
      }],
      success_url: `${appUrl}/account.html?credits_success=1&session_id={CHECKOUT_SESSION_ID}#credits`,
      cancel_url: `${appUrl}/account.html#credits`,
      metadata: {
        userId: req.user.id,
        packageId: pkg.slug,
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

    const stripeKeyConfirm = await platformSettings.getStripeSecretKey();
    if (!stripeKeyConfirm) {
      return res.status(500).json({ error: 'Payment processing is not configured' });
    }

    const stripe = require('stripe')(stripeKeyConfirm);
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
    const pkg = await creditPackageQueries.getBySlug(session.metadata.packageId);
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
};
