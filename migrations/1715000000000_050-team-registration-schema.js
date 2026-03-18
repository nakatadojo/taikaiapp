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
  // Must use raw SQL — pgm.createIndex does not support functional expressions
  pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tournament_teams_name_lower
      ON tournament_teams (tournament_id, lower(team_name));
  `);
};

exports.down = pgm => {
  pgm.sql(`DROP INDEX IF EXISTS idx_tournament_teams_name_lower;`);
  pgm.dropColumn('tournaments', 'require_weight_at_registration', { ifExists: true });
  pgm.dropColumn('users', 'account_claimed', { ifExists: true });
  pgm.dropColumn('tournament_teams', ['stripe_session_id', 'registered_by', 'payment_status'], { ifExists: true });
  pgm.dropColumn('registrations', 'team_id', { ifExists: true });
  pgm.dropColumn('tournament_events', 'team_price', { ifExists: true });
};
