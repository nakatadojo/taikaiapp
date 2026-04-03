/**
 * Migration 058 — Points / Medal Table
 *
 * tournament_point_rules  — director-configurable placement → points mapping
 * competitor_placements   — denormalized row per published division result entry;
 *                           aggregated for the leaderboard / medal table
 */
exports.up = (pgm) => {
  // ── Point rules ────────────────────────────────────────────────────────────
  pgm.createTable('tournament_point_rules', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    tournament_id: {
      type: 'uuid',
      notNull: true,
      references: '"tournaments"',
      onDelete: 'CASCADE',
    },
    // 1 = 1st place / gold, 2 = silver, 3 = bronze, 4+ = lower placements
    placement: { type: 'integer', notNull: true },
    points:    { type: 'integer', notNull: true, default: 0 },
    // optional medal label shown on leaderboard ('gold','silver','bronze')
    medal:     { type: 'varchar(20)' },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // One rule per placement per tournament
  pgm.addConstraint('tournament_point_rules', 'tournament_point_rules_unique',
    'UNIQUE (tournament_id, placement)'
  );

  // Index for quick rule lookup
  pgm.createIndex('tournament_point_rules', ['tournament_id']);

  // ── Competitor placements ──────────────────────────────────────────────────
  pgm.createTable('competitor_placements', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    tournament_id: {
      type: 'uuid',
      notNull: true,
      references: '"tournaments"',
      onDelete: 'CASCADE',
    },
    // FK to published_results so rows are removed if a result is deleted
    result_id: {
      type: 'uuid',
      notNull: true,
      references: '"published_results"',
      onDelete: 'CASCADE',
    },
    // Denormalized from results_data entry (no profile UUID available in results)
    competitor_name: { type: 'text', notNull: true },
    club_name:       { type: 'text' },
    event_name:      { type: 'text', notNull: true },
    division_name:   { type: 'text', notNull: true },
    placement:       { type: 'integer', notNull: true },  // 1-based rank
    points_awarded:  { type: 'integer', notNull: true, default: 0 },
    medal:           { type: 'varchar(20)' },             // null if no rule
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Leaderboard aggregate queries: fast by tournament, name, club
  pgm.createIndex('competitor_placements', ['tournament_id']);
  pgm.createIndex('competitor_placements', ['tournament_id', 'competitor_name']);
  pgm.createIndex('competitor_placements', ['result_id']);
};

exports.down = (pgm) => {
  pgm.dropTable('competitor_placements');
  pgm.dropTable('tournament_point_rules');
};
