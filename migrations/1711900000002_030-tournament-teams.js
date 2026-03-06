/**
 * Migration 030 — Tournament Teams Table
 *
 * Stores team data server-side (previously localStorage-only).
 * Each team has a unique code within a tournament and stores its members as JSONB.
 */
exports.up = (pgm) => {
  pgm.createTable('tournament_teams', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    tournament_id: {
      type: 'uuid',
      notNull: true,
      references: 'tournaments(id)',
      onDelete: 'CASCADE',
    },
    event_id: {
      type: 'uuid',
      references: 'tournament_events(id)',
      onDelete: 'SET NULL',
    },
    team_code: {
      type: 'text',
      notNull: true,
    },
    team_name: {
      type: 'text',
      notNull: true,
    },
    members: {
      type: 'jsonb',
      default: pgm.func("'[]'::jsonb"),
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
  });

  pgm.addConstraint('tournament_teams', 'tournament_teams_tournament_id_team_code_unique', {
    unique: ['tournament_id', 'team_code'],
  });

  pgm.createIndex('tournament_teams', 'tournament_id');
};

exports.down = (pgm) => {
  pgm.dropTable('tournament_teams');
};
