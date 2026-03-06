/**
 * Migration 032 — Tournament Sponsors Table
 *
 * Stores sponsor / vendor directory entries per tournament.
 * Each sponsor has a category, optional discount code, and ordering support.
 */
exports.up = (pgm) => {
  pgm.createTable('tournament_sponsors', {
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
    name: {
      type: 'text',
      notNull: true,
    },
    logo_url: {
      type: 'text',
    },
    description: {
      type: 'text',
    },
    website_url: {
      type: 'text',
    },
    category: {
      type: 'varchar(50)',
      default: "'sponsor'",
    },
    discount_code: {
      type: 'text',
    },
    display_order: {
      type: 'integer',
      default: 0,
    },
    visible: {
      type: 'boolean',
      default: true,
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('tournament_sponsors', 'tournament_id');
};

exports.down = (pgm) => {
  pgm.dropTable('tournament_sponsors');
};
