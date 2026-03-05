/**
 * Migration 016: Create notifications table
 *
 * Stores in-app notifications for the director bell system and
 * participant status updates. Supports typed notifications with
 * flexible JSONB payloads.
 */

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}',
      read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_id, read)
      WHERE read = false;
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS notifications');
};
