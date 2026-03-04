/**
 * Migration 007: User Settings
 * Adds a JSONB settings column to the users table for storing
 * user preferences like default event types.
 */

exports.up = (pgm) => {
  pgm.addColumn('users', {
    settings: {
      type: 'jsonb',
      default: pgm.func("'{}'::jsonb"),
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('users', 'settings');
};
