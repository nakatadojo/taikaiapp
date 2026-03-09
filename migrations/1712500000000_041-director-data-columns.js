/**
 * Migration 041: Director data columns
 *
 * - Extends tournament_events with is_default, team_size, description
 *   so director-created event types persist full metadata on the server.
 * - Extends tournaments with director_competitors and director_clubs JSONB
 *   columns so competitor/club rosters sync to the server.
 */
exports.up = (pgm) => {
  pgm.addColumns('tournament_events', {
    is_default: { type: 'boolean', notNull: true, default: false },
    team_size: { type: 'integer', nullable: true },
    description: { type: 'text', nullable: true },
  });

  pgm.addColumns('tournaments', {
    director_competitors: {
      type: 'jsonb',
      nullable: true,
      default: "'[]'::jsonb",
    },
    director_clubs: {
      type: 'jsonb',
      nullable: true,
      default: "'[]'::jsonb",
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('tournament_events', ['is_default', 'team_size', 'description']);
  pgm.dropColumns('tournaments', ['director_competitors', 'director_clubs']);
};
