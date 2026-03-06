/**
 * Migration 017 — Waivers table + guardian_email column on competitor_profiles
 *
 * Creates the waivers table for tracking parent/guardian waiver signatures
 * when coaches register competitors on their behalf.
 * Also adds guardian_email column to competitor_profiles.
 */

exports.up = (pgm) => {
  // Create waiver_status enum
  pgm.sql("CREATE TYPE waiver_status AS ENUM ('pending', 'signed')");

  // Create waivers table
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS waivers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
      tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      profile_id UUID REFERENCES competitor_profiles(id) ON DELETE SET NULL,
      competitor_name VARCHAR(200) NOT NULL,
      parent_email VARCHAR(255) NOT NULL,
      parent_name VARCHAR(200),
      token VARCHAR(255) NOT NULL UNIQUE,
      status waiver_status NOT NULL DEFAULT 'pending',
      signed_at TIMESTAMPTZ,
      signed_ip VARCHAR(45),
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      waiver_text TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Indexes
  pgm.sql('CREATE INDEX idx_waivers_token ON waivers(token)');
  pgm.sql('CREATE INDEX idx_waivers_registration ON waivers(registration_id)');
  pgm.sql('CREATE INDEX idx_waivers_created_by ON waivers(created_by)');
  pgm.sql('CREATE INDEX idx_waivers_status ON waivers(status)');

  // Add guardian_email to competitor_profiles
  pgm.sql('ALTER TABLE competitor_profiles ADD COLUMN IF NOT EXISTS guardian_email VARCHAR(255)');
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS waivers');
  pgm.sql('DROP TYPE IF EXISTS waiver_status');
  pgm.sql('ALTER TABLE competitor_profiles DROP COLUMN IF EXISTS guardian_email');
};
