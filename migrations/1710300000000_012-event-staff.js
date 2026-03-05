/**
 * Migration 012 — Event Staff table
 *
 * Tracks volunteers, judges, ring coordinators, and other staff
 * assigned to a tournament by the director.
 */

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS event_staff (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      name VARCHAR(200) NOT NULL,
      email VARCHAR(200),
      phone VARCHAR(50),
      role VARCHAR(50) NOT NULL DEFAULT 'volunteer',
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      notes TEXT,
      tshirt_size VARCHAR(10),
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_event_staff_tournament ON event_staff(tournament_id);
    CREATE INDEX IF NOT EXISTS idx_event_staff_role ON event_staff(role);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS event_staff`);
};
