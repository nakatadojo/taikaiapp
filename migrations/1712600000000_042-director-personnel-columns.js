/**
 * Migration 042: Director personnel columns
 *
 * Adds JSONB columns to store manually-added officials (judges), staff members,
 * and instructors/coaches that are created by the tournament director, separate
 * from the tournament_members table (which tracks publicly-registered members).
 */
exports.up = (pgm) => {
  pgm.addColumns('tournaments', {
    director_officials: {
      type: 'jsonb',
      nullable: true,
      default: pgm.func("'[]'::jsonb"),
    },
    director_staff: {
      type: 'jsonb',
      nullable: true,
      default: pgm.func("'[]'::jsonb"),
    },
    director_instructors: {
      type: 'jsonb',
      nullable: true,
      default: pgm.func("'[]'::jsonb"),
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('tournaments', [
    'director_officials',
    'director_staff',
    'director_instructors',
  ]);
};
