/**
 * Migration 019 — Registration settings, competitor documents, and event prerequisites
 *
 * Adds JSONB registration_settings to tournaments for configuring
 * photo requirements, weight disclosure, and custom document uploads.
 * Creates competitor_documents table for storing uploaded documents.
 * Adds prerequisite_event_id to tournament_events for conditional event availability.
 * Adds photo_url to competitor_profiles.
 */

exports.up = (pgm) => {
  // Registration settings on tournaments (JSONB)
  pgm.sql("ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS registration_settings JSONB NOT NULL DEFAULT '{}'");

  // Competitor documents storage
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS competitor_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      profile_id UUID NOT NULL REFERENCES competitor_profiles(id) ON DELETE CASCADE,
      tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      document_name VARCHAR(200) NOT NULL,
      file_url TEXT NOT NULL,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  pgm.sql('CREATE INDEX IF NOT EXISTS idx_competitor_docs_profile ON competitor_documents(profile_id)');
  pgm.sql('CREATE INDEX IF NOT EXISTS idx_competitor_docs_tournament ON competitor_documents(tournament_id)');

  // Photo URL on competitor profiles
  pgm.sql('ALTER TABLE competitor_profiles ADD COLUMN IF NOT EXISTS photo_url TEXT');

  // Event prerequisites (e.g., Team Kata requires Individual Kata)
  pgm.sql('ALTER TABLE tournament_events ADD COLUMN IF NOT EXISTS prerequisite_event_id UUID REFERENCES tournament_events(id) ON DELETE SET NULL');
};

exports.down = (pgm) => {
  pgm.sql('ALTER TABLE tournament_events DROP COLUMN IF EXISTS prerequisite_event_id');
  pgm.sql('ALTER TABLE competitor_profiles DROP COLUMN IF EXISTS photo_url');
  pgm.sql('DROP TABLE IF EXISTS competitor_documents');
  pgm.sql('ALTER TABLE tournaments DROP COLUMN IF EXISTS registration_settings');
};
