/**
 * Migration 037: Create tournament_invitations table
 *
 * Stores invitations sent by tournament owners to invite people by email
 * to serve as coach, judge, or staff for their tournament.
 * If the invitee doesn't have an account yet, they receive a signup link
 * and are auto-assigned to the tournament role upon account creation.
 */

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS tournament_invitations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      email VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      token VARCHAR(255) UNIQUE NOT NULL,
      invited_by UUID NOT NULL REFERENCES users(id),
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      accepted_at TIMESTAMPTZ,
      CONSTRAINT unique_tournament_email_role UNIQUE (tournament_id, email, role)
    );

    CREATE INDEX IF NOT EXISTS idx_tournament_invitations_tournament ON tournament_invitations(tournament_id);
    CREATE INDEX IF NOT EXISTS idx_tournament_invitations_email ON tournament_invitations(email);
    CREATE INDEX IF NOT EXISTS idx_tournament_invitations_token ON tournament_invitations(token);
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS tournament_invitations');
};
