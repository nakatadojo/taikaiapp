exports.up = async (knex) => {
  await knex.raw(`
    -- tournament_events: flat team price
    ALTER TABLE tournament_events ADD COLUMN IF NOT EXISTS team_price DECIMAL(10,2);

    -- registrations: link to team
    ALTER TABLE registrations ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES tournament_teams(id) ON DELETE SET NULL;

    -- tournament_teams: payment tracking + ownership
    ALTER TABLE tournament_teams ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'unpaid';
    ALTER TABLE tournament_teams ADD COLUMN IF NOT EXISTS registered_by UUID REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE tournament_teams ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(255);

    -- users: explicit account activation flag
    ALTER TABLE users ADD COLUMN IF NOT EXISTS account_claimed BOOLEAN NOT NULL DEFAULT false;
    -- Backfill: anyone with a password_hash is already claimed
    UPDATE users SET account_claimed = true WHERE password_hash IS NOT NULL;

    -- tournaments: weight field requirement toggle
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS require_weight_at_registration BOOLEAN NOT NULL DEFAULT false;

    -- tournament_teams: unique team name per tournament (case-insensitive)
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tournament_teams_name_lower
      ON tournament_teams (tournament_id, lower(team_name));
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    DROP INDEX IF EXISTS idx_tournament_teams_name_lower;

    ALTER TABLE tournaments DROP COLUMN IF EXISTS require_weight_at_registration;

    ALTER TABLE users DROP COLUMN IF EXISTS account_claimed;

    ALTER TABLE tournament_teams DROP COLUMN IF EXISTS stripe_session_id;
    ALTER TABLE tournament_teams DROP COLUMN IF EXISTS registered_by;
    ALTER TABLE tournament_teams DROP COLUMN IF EXISTS payment_status;

    ALTER TABLE registrations DROP COLUMN IF EXISTS team_id;

    ALTER TABLE tournament_events DROP COLUMN IF EXISTS team_price;
  `);
};
