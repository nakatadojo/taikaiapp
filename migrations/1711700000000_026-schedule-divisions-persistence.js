/**
 * Migration 026 — Schedule + Generated Divisions Persistence
 *
 * Adds JSONB columns to tournaments for server-side storage of
 * schedule data and generated division assignments (previously localStorage-only).
 */
exports.up = (pgm) => {
  pgm.addColumns('tournaments', {
    mat_schedule: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'{}'::jsonb"),
    },
    schedule_settings: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'{}'::jsonb"),
    },
    schedule_published: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    generated_divisions: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'{}'::jsonb"),
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('tournaments', [
    'mat_schedule',
    'schedule_settings',
    'schedule_published',
    'generated_divisions',
  ]);
};
