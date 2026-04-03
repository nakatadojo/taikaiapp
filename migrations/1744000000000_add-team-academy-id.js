exports.up = (pgm) => {
  pgm.addColumn('tournament_teams', {
    academy_id: {
      type: 'uuid',
      references: '"academies"',
      onDelete: 'SET NULL',
      notNull: false,
    },
  });
};
exports.down = (pgm) => {
  pgm.dropColumn('tournament_teams', 'academy_id');
};
