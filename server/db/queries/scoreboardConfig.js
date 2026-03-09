const pool = require('../pool');

const ScoreboardConfigQueries = {
  async getByTournament(tournamentId) {
    const { rows } = await pool.query(
      `SELECT * FROM scoreboard_configs WHERE tournament_id = $1`,
      [tournamentId]
    );
    return rows[0] || null;
  },

  async upsert(tournamentId, config) {
    const { rows } = await pool.query(
      `INSERT INTO scoreboard_configs (tournament_id, config)
       VALUES ($1, $2)
       ON CONFLICT (tournament_id)
       DO UPDATE SET config = $2, updated_at = NOW()
       RETURNING *`,
      [tournamentId, JSON.stringify(config)]
    );
    return rows[0];
  },
};

module.exports = ScoreboardConfigQueries;
