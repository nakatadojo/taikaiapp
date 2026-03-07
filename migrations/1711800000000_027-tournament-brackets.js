/**
 * Migration 027 — Tournament Brackets Table
 *
 * Stores bracket data server-side (previously localStorage-only).
 * Each bracket stores its full data as JSONB (matches, competitors, scores).
 * VARCHAR PK because client generates composite string IDs.
 */
exports.up = (pgm) => {
  pgm.createTable('tournament_brackets', {
    id: {
      type: 'varchar(255)',
      primaryKey: true,
    },
    tournament_id: {
      type: 'uuid',
      notNull: true,
      references: 'tournaments(id)',
      onDelete: 'CASCADE',
    },
    event_id: {
      type: 'varchar(255)',
      notNull: true,
    },
    division_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    bracket_type: {
      type: 'varchar(50)',
      notNull: true,
    },
    data: {
      type: 'jsonb',
      notNull: true,
    },
    published: {
      type: 'boolean',
      notNull: true,
      default: false,
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

  pgm.createIndex('tournament_brackets', 'tournament_id');
  pgm.createIndex('tournament_brackets', ['tournament_id', 'published']);
};

exports.down = (pgm) => {
  pgm.dropTable('tournament_brackets');
};
