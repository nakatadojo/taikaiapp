exports.up = (pgm) => {
  pgm.createTable('tournament_custom_tabs', {
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
    tab_name: {
      type: 'varchar(100)',
      notNull: true,
    },
    tab_order: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    content_html: {
      type: 'text',
      notNull: true,
      default: '',
    },
    visible: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('tournament_custom_tabs', 'tournament_id');
};

exports.down = (pgm) => {
  pgm.dropTable('tournament_custom_tabs');
};
