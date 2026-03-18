/**
 * Migration 048 — Tournament member application metadata
 * Adds photo_url and metadata (JSONB) to tournament_members so that
 * coach / judge / staff applications can store extra contact details
 * (phone, DOB, nationality, classification, school, alsoCompeting, etc.)
 * without requiring per-field schema changes every time new data is needed.
 */
exports.up = pgm => {
  pgm.addColumns('tournament_members', {
    photo_url: { type: 'text', notNull: false },
    metadata:  { type: 'jsonb', notNull: false, default: pgm.func("'{}'::jsonb") },
  });
};

exports.down = pgm => {
  pgm.dropColumns('tournament_members', ['photo_url', 'metadata']);
};
