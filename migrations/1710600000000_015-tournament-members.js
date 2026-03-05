/**
 * Migration 015: Create tournament_members table
 *
 * Stores role applications (Coach, Judge, Staff, Parent) for tournaments.
 * Each record represents a user applying for a specific role at a tournament,
 * with a status workflow: pending → approved/declined.
 */

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TYPE member_status AS ENUM ('pending', 'approved', 'declined');

    CREATE TABLE IF NOT EXISTS tournament_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      role user_role NOT NULL,
      staff_role VARCHAR(50),
      status member_status NOT NULL DEFAULT 'pending',
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ,
      reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT unique_user_tournament_role UNIQUE (user_id, tournament_id, role)
    );

    CREATE INDEX IF NOT EXISTS idx_tournament_members_tournament ON tournament_members(tournament_id);
    CREATE INDEX IF NOT EXISTS idx_tournament_members_user ON tournament_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_tournament_members_status ON tournament_members(status);
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS tournament_members');
  pgm.sql('DROP TYPE IF EXISTS member_status');
};
