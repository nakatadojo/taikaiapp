exports.up = (pgm) => {
  pgm.createTable('pricing_periods', {
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
      type: 'varchar(100)',
      notNull: true,
    },
    start_date: {
      type: 'timestamptz',
      notNull: true,
    },
    end_date: {
      type: 'timestamptz',
      notNull: true,
    },
    base_event_price: {
      type: 'decimal(10,2)',
      notNull: true,
    },
    addon_event_price: {
      type: 'decimal(10,2)',
      notNull: true,
    },
    display_order: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
  });

  pgm.addConstraint('pricing_periods', 'valid_date_range', {
    check: 'end_date > start_date',
  });

  pgm.createIndex('pricing_periods', 'tournament_id');
};

exports.down = (pgm) => {
  pgm.dropTable('pricing_periods');
};
