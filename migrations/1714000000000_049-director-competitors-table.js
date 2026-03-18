exports.up = pgm => {
  // New per-record table replaces the director_competitors JSONB array
  pgm.createTable('tournament_director_competitors', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tournament_id: { type: 'uuid', notNull: true, references: '"tournaments"', onDelete: 'CASCADE' },
    data: { type: 'jsonb', notNull: true },
    is_test: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.createIndex('tournament_director_competitors', 'tournament_id');
  pgm.createIndex('tournament_director_competitors', ['tournament_id', 'is_test']);
};

exports.down = pgm => {
  pgm.dropTable('tournament_director_competitors');
};
