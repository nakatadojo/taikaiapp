/**
 * Migration 055 — Bracket optimistic locking + match result audit log
 *
 * 1. `version` column on tournament_brackets — incremented on every write.
 *    Clients send their known version as `If-Match`; server returns 409 when
 *    the client version is stale, preventing silent last-write-wins overwrites.
 *
 * 2. `match_results` — append-only table that records every match outcome.
 *    Never overwritten. Provides an audit trail for disputes and allows
 *    bracket state to be reconstructed from history if needed.
 */
exports.up = (pgm) => {
  pgm.addColumn('tournament_brackets', {
    version: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
  });

  pgm.createTable('match_results', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    tournament_id: {
      type: 'uuid',
      notNull: true,
      references: '"tournaments"',
      onDelete: 'CASCADE',
    },
    bracket_id:     { type: 'varchar(255)', notNull: true },
    match_id:       { type: 'text' },
    winner_id:      { type: 'text' },
    winner_name:    { type: 'text' },
    loser_id:       { type: 'text' },
    loser_name:     { type: 'text' },
    division_name:  { type: 'text' },
    event_id:       { type: 'text' },
    scoreboard_type:{ type: 'text' },
    method:         { type: 'text' },
    win_note:       { type: 'text' },
    scores:         { type: 'jsonb' },
    mat_id:         { type: 'text' },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('match_results', 'tournament_id');
  pgm.createIndex('match_results', 'bracket_id');
};

exports.down = (pgm) => {
  pgm.dropTable('match_results');
  pgm.dropColumn('tournament_brackets', 'version');
};
