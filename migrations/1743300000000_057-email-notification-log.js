/**
 * Migration 057 — Email notification dedup log
 *
 * Prevents the same notification type from being sent twice for the same
 * tournament+event combination (e.g., bracket published fires twice if the
 * director clicks publish/unpublish/publish).
 *
 * The unique index is on (tournament_id, event_type, entity_id) so separate
 * brackets can each fire once independently.
 */
exports.up = (pgm) => {
  pgm.createTable('email_notification_log', {
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
    event_type: { type: 'varchar(50)', notNull: true },
    entity_id:  { type: 'text' },
    sent_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    recipient_count: { type: 'integer', notNull: true, default: 0 },
  });

  // Unique constraint on (tournament_id, event_type, coalesced entity_id)
  // Using a partial unique index via expression index.
  pgm.sql(`
    CREATE UNIQUE INDEX email_notification_log_dedup
    ON email_notification_log (tournament_id, event_type, COALESCE(entity_id, ''))
  `);
};

exports.down = (pgm) => {
  pgm.dropTable('email_notification_log');
};
