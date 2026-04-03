/**
 * Migration 059 — Director Day-Of Event Overrides
 *
 * director_event_overrides — audit log of events added/removed by a director
 * from an existing registration on the day of the event.
 *
 * This table is the single source of truth for day-of changes; the live
 * registration_events rows are modified in place but every change is stamped
 * here with the override amount and who made it.
 */
exports.up = (pgm) => {
  pgm.createTable('director_event_overrides', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    tournament_id: {
      type: 'uuid',
      notNull: true,
      references: '"tournaments"',
      onDelete: 'CASCADE',
    },
    registration_id: {
      type: 'uuid',
      notNull: true,
      references: '"registrations"',
      onDelete: 'CASCADE',
    },
    event_id: { type: 'text', notNull: true },  // tournament_events.id (UUID stored as text)
    action: {
      type: 'varchar(10)',
      notNull: true,
      check: "action IN ('add', 'remove')",
    },
    // Price of the event at the time of the override (positive value, in dollars)
    price: { type: 'numeric(10,2)', notNull: true, default: 0 },
    // Whether a refund was issued via Stripe for a remove action
    refund_issued: { type: 'boolean', notNull: true, default: false },
    refund_amount: { type: 'numeric(10,2)' },
    stripe_refund_id: { type: 'varchar(100)' },
    // Notes from director (reason, cash collected, etc.)
    notes: { type: 'text' },
    performed_by: {
      type: 'uuid',
      references: '"users"',
      onDelete: 'SET NULL',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('director_event_overrides', ['tournament_id']);
  pgm.createIndex('director_event_overrides', ['registration_id']);
};

exports.down = (pgm) => {
  pgm.dropTable('director_event_overrides');
};
