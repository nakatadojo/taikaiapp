exports.up = (pgm) => {
  pgm.createTable('checkins', {
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
    registration_id: {
      type: 'uuid',
      notNull: true,
      references: 'registrations(id)',
      onDelete: 'CASCADE',
    },
    checked_in_by: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'SET NULL',
    },
    checked_in_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    mat_called_at: {
      type: 'timestamptz',
    },
    mat_called_by: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'SET NULL',
    },
    notes: {
      type: 'text',
    },
  });

  pgm.addConstraint('checkins', 'unique_tournament_registration_checkin', {
    unique: ['tournament_id', 'registration_id'],
  });
  pgm.createIndex('checkins', 'tournament_id');
  pgm.createIndex('checkins', 'registration_id');
};

exports.down = (pgm) => {
  pgm.dropTable('checkins');
};
