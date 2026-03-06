/**
 * Migration 034 — Feedback Forms & Responses
 *
 * Stores post-tournament feedback form configuration per tournament
 * and individual feedback responses from participants.
 */
exports.up = (pgm) => {
  // ── feedback_forms ─────────────────────────────────────────────────────────
  pgm.createTable('feedback_forms', {
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
    questions: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'[]'::jsonb"),
    },
    recipients: {
      type: 'varchar(50)',
      notNull: true,
      default: pgm.func("'competitors'"),
    },
    delay_hours: {
      type: 'integer',
      notNull: true,
      default: 24,
    },
    enabled: {
      type: 'boolean',
      default: false,
    },
    sent_at: {
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

  // One form per tournament
  pgm.addConstraint('feedback_forms', 'feedback_forms_tournament_id_unique', {
    unique: 'tournament_id',
  });

  pgm.createIndex('feedback_forms', 'tournament_id');

  // ── feedback_responses ─────────────────────────────────────────────────────
  pgm.createTable('feedback_responses', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    form_id: {
      type: 'uuid',
      notNull: true,
      references: 'feedback_forms(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'SET NULL',
    },
    respondent_name: {
      type: 'text',
    },
    respondent_email: {
      type: 'text',
    },
    answers: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'[]'::jsonb"),
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
  });

  // One response per user per form
  pgm.addConstraint('feedback_responses', 'feedback_responses_form_user_unique', {
    unique: ['form_id', 'user_id'],
  });

  pgm.createIndex('feedback_responses', 'form_id');
};

exports.down = (pgm) => {
  pgm.dropTable('feedback_responses');
  pgm.dropTable('feedback_forms');
};
