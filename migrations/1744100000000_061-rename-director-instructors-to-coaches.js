exports.up = async (pool) => {
  await pool.query(`
    ALTER TABLE tournaments
      RENAME COLUMN director_instructors TO director_coaches;
  `);
};

exports.down = async (pool) => {
  await pool.query(`
    ALTER TABLE tournaments
      RENAME COLUMN director_coaches TO director_instructors;
  `);
};
