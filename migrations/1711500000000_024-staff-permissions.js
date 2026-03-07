exports.up = (pgm) => {
  pgm.createTable('staff_role_definitions', {
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
    role_name: {
      type: 'varchar(100)',
      notNull: true,
    },
    permissions: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'[]'::jsonb"),
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
  });

  pgm.addConstraint('staff_role_definitions', 'unique_tournament_role_name', {
    unique: ['tournament_id', 'role_name'],
  });

  pgm.createIndex('staff_role_definitions', 'tournament_id');

  // Add role_definition_id to tournament_members
  pgm.sql(`
    ALTER TABLE tournament_members
    ADD COLUMN IF NOT EXISTS role_definition_id UUID
    REFERENCES staff_role_definitions(id) ON DELETE SET NULL
  `);
};

exports.down = (pgm) => {
  pgm.sql('ALTER TABLE tournament_members DROP COLUMN IF EXISTS role_definition_id');
  pgm.dropTable('staff_role_definitions');
};
