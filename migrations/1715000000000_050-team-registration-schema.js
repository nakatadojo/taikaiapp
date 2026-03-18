exports.up = pgm => {
  // tournament_events: flat team price
  pgm.addColumn('tournament_events', {
    team_price: { type: 'decimal(10,2)' },
  });

  // registrations: link to team
  pgm.addColumn('registrations', {
    team_id: { type: 'uuid', references: '"tournament_teams"', onDelete: 'SET NULL' },
  });

  // tournament_teams: payment tracking + ownership
  pgm.addColumn('tournament_teams', {
    payment_status: { type: 'varchar(20)', default: "'unpaid'" },
    registered_by:  { type: 'uuid', references: '"users"', onDelete: 'SET NULL' },
    stripe_session_id: { type: 'varchar(255)' },
  });

  // users: explicit account activation flag
  pgm.addColumn('users', {
    account_claimed: { type: 'boolean', notNull: true, default: false },
  });
  // Backfill: anyone with a password_hash already has an active account
  pgm.sql(`UPDATE users SET account_claimed = true WHERE password_hash IS NOT NULL;`);

  // tournaments: weight field requirement toggle
  pgm.addColumn('tournaments', {
    require_weight_at_registration: { type: 'boolean', notNull: true, default: false },
  });

  // tournament_teams: unique team name per tournament (case-insensitive)
  pgm.createIndex('tournament_teams', pgm.func('lower(team_name)'), {
    name: 'idx_tournament_teams_name_lower',
    unique: true,
    where: 'tournament_id IS NOT NULL',
  });
};

exports.down = pgm => {
  pgm.dropIndex('tournament_teams', pgm.func('lower(team_name)'), {
    name: 'idx_tournament_teams_name_lower',
    ifExists: true,
  });
  pgm.dropColumn('tournaments', 'require_weight_at_registration', { ifExists: true });
  pgm.dropColumn('users', 'account_claimed', { ifExists: true });
  pgm.dropColumn('tournament_teams', ['stripe_session_id', 'registered_by', 'payment_status'], { ifExists: true });
  pgm.dropColumn('registrations', 'team_id', { ifExists: true });
  pgm.dropColumn('tournament_events', 'team_price', { ifExists: true });
};
