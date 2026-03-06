/**
 * Migration 029 — Certificate Templates
 *
 * Stores certificate template images and merge-tag configuration per
 * tournament so directors can generate batch PDFs of competitor certificates.
 *
 * Columns:
 *   - template_url   : R2 / local file path (NULL when using base64 fallback)
 *   - template_data  : base64-encoded image for localStorage-style fallback
 *   - merge_tag_config: JSONB with field positions, font sizes, colors, etc.
 *
 * One template per tournament (UNIQUE on tournament_id).
 */
exports.up = (pgm) => {
  pgm.createTable('certificate_templates', {
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
    template_url: {
      type: 'text',
    },
    template_data: {
      type: 'text',
    },
    merge_tag_config: {
      type: 'jsonb',
      default: pgm.func("'{}'::jsonb"),
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamptz',
      default: pgm.func('now()'),
    },
  });

  pgm.addConstraint('certificate_templates', 'certificate_templates_tournament_id_unique', {
    unique: 'tournament_id',
  });

  pgm.createIndex('certificate_templates', 'tournament_id', {
    name: 'idx_certificate_templates_tournament',
    ifNotExists: true,
  });
};

exports.down = (pgm) => {
  pgm.dropTable('certificate_templates');
};
