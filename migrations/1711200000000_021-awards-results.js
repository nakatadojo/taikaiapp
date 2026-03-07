exports.up = (pgm) => {
  pgm.createTable('published_results', {
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
    event_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    division_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    results_data: {
      type: 'jsonb',
      notNull: true,
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'pending',
      check: "status IN ('pending', 'published')",
    },
    published_at: {
      type: 'timestamptz',
    },
    published_by: {
      type: 'uuid',
      references: 'users(id)',
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
  });

  pgm.addConstraint('published_results', 'unique_tournament_division', {
    unique: ['tournament_id', 'division_name'],
  });

  pgm.createIndex('published_results', 'tournament_id');
  pgm.createIndex('published_results', 'status');

  // Section visibility JSONB on tournaments for controlling public page tabs
  pgm.sql("ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS section_visibility JSONB NOT NULL DEFAULT '{}'");
};

exports.down = (pgm) => {
  pgm.dropTable('published_results');
  pgm.sql('ALTER TABLE tournaments DROP COLUMN IF EXISTS section_visibility');
};
