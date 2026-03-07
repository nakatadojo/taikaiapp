/**
 * Migration 033 — Judge Votes Table
 *
 * Stores individual judge vote records for kata-flags head-to-head matches.
 * Used for judge performance analytics: consistency, decision speed, bias detection.
 */
exports.up = (pgm) => {
  pgm.createTable('judge_votes', {
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
    match_id: {
      type: 'text',
      notNull: true,
    },
    division_name: {
      type: 'text',
    },
    judge_user_id: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'SET NULL',
    },
    judge_name: {
      type: 'text',
      notNull: true,
    },
    vote: {
      type: 'text',
      notNull: true,
    },
    majority_vote: {
      type: 'text',
    },
    voted_with_majority: {
      type: 'boolean',
    },
    vote_duration_seconds: {
      type: 'numeric(6,2)',
    },
    competitor_dojo: {
      type: 'text',
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('judge_votes', ['tournament_id', 'judge_user_id']);
};

exports.down = (pgm) => {
  pgm.dropTable('judge_votes');
};
