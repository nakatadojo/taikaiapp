/**
 * Migration 020 — Add assigned_division to registration_events
 *
 * Stores the auto-assigned division name after payment confirmation.
 */

exports.up = (pgm) => {
  pgm.sql("ALTER TABLE registration_events ADD COLUMN IF NOT EXISTS assigned_division VARCHAR(200)");
};

exports.down = (pgm) => {
  pgm.sql('ALTER TABLE registration_events DROP COLUMN IF EXISTS assigned_division');
};
