/**
 * Migration 043: Security constraints and performance indexes
 *
 * Fix #21: Add NOT NULL + DEFAULT constraints to status columns that should
 *          always have a value. Without these, a bare INSERT can leave status
 *          as NULL, which breaks `status === 'unpaid'` checks in application code.
 *
 * Fix #22: Add indexes on frequently-queried foreign key columns.
 *          PostgreSQL does NOT automatically index FK columns; without indexes
 *          queries joining on these columns do full sequential scans.
 */
exports.up = (pgm) => {
  // ── Fix #21: NOT NULL defaults on status columns ────────────────────────────

  // registrations.payment_status — application code compares against 'unpaid', 'paid', etc.
  pgm.alterColumn('registrations', 'payment_status', {
    type: 'text',
    notNull: true,
    default: 'unpaid',
  });

  // payment_transactions.status — must always be a known state
  pgm.alterColumn('payment_transactions', 'status', {
    type: 'text',
    notNull: true,
    default: 'pending',
  });

  // ── Fix #22: Indexes on high-traffic foreign key columns ────────────────────

  // tournament_events.tournament_id — every event query joins/filters on this
  pgm.createIndex('tournament_events', 'tournament_id', {
    name: 'idx_tournament_events_tournament_id',
    ifNotExists: true,
  });

  // minor_guardians.guardian_user_id — guardian lookups use this column
  pgm.createIndex('minor_guardians', 'guardian_user_id', {
    name: 'idx_minor_guardians_guardian_user_id',
    ifNotExists: true,
  });

  // registrations.tournament_id — most registration queries filter by tournament
  pgm.createIndex('registrations', 'tournament_id', {
    name: 'idx_registrations_tournament_id',
    ifNotExists: true,
  });

  // credit_transactions.user_id — transaction history queries filter by user
  pgm.createIndex('credit_transactions', 'user_id', {
    name: 'idx_credit_transactions_user_id',
    ifNotExists: true,
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('credit_transactions', 'user_id', { name: 'idx_credit_transactions_user_id', ifExists: true });
  pgm.dropIndex('registrations', 'tournament_id', { name: 'idx_registrations_tournament_id', ifExists: true });
  pgm.dropIndex('minor_guardians', 'guardian_user_id', { name: 'idx_minor_guardians_guardian_user_id', ifExists: true });
  pgm.dropIndex('tournament_events', 'tournament_id', { name: 'idx_tournament_events_tournament_id', ifExists: true });

  pgm.alterColumn('payment_transactions', 'status', { type: 'text', notNull: false, default: null });
  pgm.alterColumn('registrations', 'payment_status', { type: 'text', notNull: false, default: null });
};
