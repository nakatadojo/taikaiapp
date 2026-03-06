/**
 * Migration 028 — Payment Status: Refund & Dispute Support
 *
 * Adds 'refunded' and 'disputed' values to the payment_status enum type
 * (used by registrations.payment_status) and updates the CHECK constraint
 * on payment_transactions.status to allow 'disputed'.
 *
 * Also adds stripe_payment_intent_id to payment_transactions so we can
 * look up transactions by Stripe charge/payment-intent for refund and
 * dispute webhooks.
 */
exports.up = (pgm) => {
  // 1. Extend the payment_status enum with new values
  pgm.sql(`ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'refunded'`);
  pgm.sql(`ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'disputed'`);

  // 2. Update the CHECK constraint on payment_transactions.status
  //    to also allow 'disputed'
  pgm.sql(`
    ALTER TABLE payment_transactions
      DROP CONSTRAINT IF EXISTS payment_transactions_status_check
  `);
  pgm.sql(`
    ALTER TABLE payment_transactions
      ADD CONSTRAINT payment_transactions_status_check
      CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'disputed'))
  `);

  // 3. Add stripe_payment_intent_id column for charge-based lookups
  pgm.addColumn('payment_transactions', {
    stripe_payment_intent_id: {
      type: 'varchar(255)',
    },
  });
  pgm.createIndex('payment_transactions', 'stripe_payment_intent_id', {
    name: 'idx_payments_stripe_pi',
    ifNotExists: true,
  });
};

exports.down = (pgm) => {
  // Remove the payment_intent column
  pgm.dropColumn('payment_transactions', 'stripe_payment_intent_id');

  // Restore original CHECK constraint
  pgm.sql(`
    ALTER TABLE payment_transactions
      DROP CONSTRAINT IF EXISTS payment_transactions_status_check
  `);
  pgm.sql(`
    ALTER TABLE payment_transactions
      ADD CONSTRAINT payment_transactions_status_check
      CHECK (status IN ('pending', 'completed', 'failed', 'refunded'))
  `);

  // Note: PostgreSQL does not support removing values from an enum type.
  // The 'refunded' and 'disputed' values will remain in the enum.
};
