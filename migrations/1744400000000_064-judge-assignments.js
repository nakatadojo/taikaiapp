/**
 * Migration 064 — Judge Assignments
 *
 * Tracks which judges/officials are assigned to which mat, chair, and time
 * window for a tournament. Supports Sit/Stand handoff workflow so judges
 * can be rotated without disrupting ongoing matches.
 *
 * official_name is denormalized so assignments display correctly even if
 * the linked user account is later modified.
 */
exports.up = (pgm) => {
  pgm.createTable('judge_assignments', {
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
    user_id: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'SET NULL',
    },
    official_name: {
      type: 'text',
      notNull: true,
    },
    mat_id: {
      type: 'integer',
      notNull: true,
    },
    chair: {
      type: 'text',
      notNull: true,
      check: "chair IN ('shushin','judge1','judge2','judge3','judge4')",
    },
    scheduled_from: {
      type: 'time',
    },
    scheduled_until: {
      type: 'time',
    },
    status: {
      type: 'text',
      notNull: true,
      default: 'assigned',
      check: "status IN ('assigned','seated','active','relieved','complete')",
    },
    seated_at: {
      type: 'timestamptz',
    },
    stood_at: {
      type: 'timestamptz',
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

  pgm.createIndex('judge_assignments', 'tournament_id');
  pgm.createIndex('judge_assignments', ['tournament_id', 'mat_id']);
  pgm.createIndex('judge_assignments', 'user_id');
};

exports.down = (pgm) => {
  pgm.dropTable('judge_assignments');
};
