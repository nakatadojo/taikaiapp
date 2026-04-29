exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE tournaments
      RENAME COLUMN director_instructors TO director_coaches;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE tournaments
      RENAME COLUMN director_coaches TO director_instructors;
  `);
};
