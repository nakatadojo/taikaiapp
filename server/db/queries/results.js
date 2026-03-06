const pool = require('../pool');

const ResultsQueries = {
  /**
   * Get all results for a tournament (director view — includes pending).
   */
  async getByTournament(tournamentId) {
    const { rows } = await pool.query(
      `SELECT pr.*, u.first_name AS published_by_name
       FROM published_results pr
       LEFT JOIN users u ON pr.published_by = u.id
       WHERE pr.tournament_id = $1
       ORDER BY pr.event_name, pr.division_name`,
      [tournamentId]
    );
    return rows;
  },

  /**
   * Get only published results for a tournament (public view).
   */
  async getPublished(tournamentId) {
    const { rows } = await pool.query(
      `SELECT id, event_name, division_name, results_data, published_at
       FROM published_results
       WHERE tournament_id = $1 AND status = 'published'
       ORDER BY event_name, division_name`,
      [tournamentId]
    );
    return rows;
  },

  /**
   * Upsert a division result (insert or update on conflict).
   */
  async upsert({ tournamentId, eventName, divisionName, resultsData }) {
    const { rows } = await pool.query(
      `INSERT INTO published_results (tournament_id, event_name, division_name, results_data)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tournament_id, division_name)
       DO UPDATE SET results_data = $4, event_name = $2, created_at = NOW()
       RETURNING *`,
      [tournamentId, eventName, divisionName, JSON.stringify(resultsData)]
    );
    return rows[0];
  },

  /**
   * Bulk upsert: sync multiple division results at once.
   */
  async bulkUpsert(tournamentId, divisions) {
    const results = [];
    for (const div of divisions) {
      const row = await ResultsQueries.upsert({
        tournamentId,
        eventName: div.eventName,
        divisionName: div.divisionName,
        resultsData: div.results,
      });
      results.push(row);
    }
    return results;
  },

  /**
   * Publish a single division result.
   */
  async publish(resultId, userId) {
    const { rows } = await pool.query(
      `UPDATE published_results
       SET status = 'published', published_at = NOW(), published_by = $2
       WHERE id = $1
       RETURNING *`,
      [resultId, userId]
    );
    return rows[0];
  },

  /**
   * Unpublish a single division result (back to pending).
   */
  async unpublish(resultId) {
    const { rows } = await pool.query(
      `UPDATE published_results
       SET status = 'pending', published_at = NULL, published_by = NULL
       WHERE id = $1
       RETURNING *`,
      [resultId]
    );
    return rows[0];
  },

  /**
   * Publish all pending results for a tournament.
   */
  async bulkPublish(tournamentId, userId) {
    const { rows } = await pool.query(
      `UPDATE published_results
       SET status = 'published', published_at = NOW(), published_by = $2
       WHERE tournament_id = $1 AND status = 'pending'
       RETURNING *`,
      [tournamentId, userId]
    );
    return rows;
  },

  /**
   * Unpublish all results for a tournament.
   */
  async bulkUnpublish(tournamentId) {
    const { rows } = await pool.query(
      `UPDATE published_results
       SET status = 'pending', published_at = NULL, published_by = NULL
       WHERE tournament_id = $1 AND status = 'published'
       RETURNING *`,
      [tournamentId]
    );
    return rows;
  },

  /**
   * Delete a single result.
   */
  async deleteResult(resultId) {
    const { rows } = await pool.query(
      'DELETE FROM published_results WHERE id = $1 RETURNING id',
      [resultId]
    );
    return rows[0];
  },

  /**
   * Get counts for a tournament (pending vs published).
   */
  async getCounts(tournamentId) {
    const { rows } = await pool.query(
      `SELECT status, COUNT(*)::int AS count
       FROM published_results
       WHERE tournament_id = $1
       GROUP BY status`,
      [tournamentId]
    );
    const counts = { pending: 0, published: 0 };
    for (const row of rows) {
      counts[row.status] = row.count;
    }
    return counts;
  },
};

module.exports = ResultsQueries;
