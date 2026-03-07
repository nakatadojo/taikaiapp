const pool = require('../pool');

const PricingPeriodQueries = {
  /**
   * Get all pricing periods for a tournament, ordered by display_order.
   */
  async getByTournament(tournamentId) {
    const { rows } = await pool.query(
      `SELECT * FROM pricing_periods
       WHERE tournament_id = $1
       ORDER BY display_order, start_date`,
      [tournamentId]
    );
    return rows;
  },

  /**
   * Get the currently active pricing period for a tournament.
   * Returns null if no period is active.
   */
  async getActivePeriod(tournamentId) {
    const { rows } = await pool.query(
      `SELECT * FROM pricing_periods
       WHERE tournament_id = $1
         AND start_date <= NOW()
         AND end_date > NOW()
       ORDER BY start_date
       LIMIT 1`,
      [tournamentId]
    );
    return rows[0] || null;
  },

  /**
   * Create a new pricing period.
   */
  async create(tournamentId, data) {
    const { name, start_date, end_date, base_event_price, addon_event_price, display_order = 0 } = data;
    const { rows } = await pool.query(
      `INSERT INTO pricing_periods
         (tournament_id, name, start_date, end_date, base_event_price, addon_event_price, display_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tournamentId, name, start_date, end_date, base_event_price, addon_event_price, display_order]
    );
    return rows[0];
  },

  /**
   * Update a pricing period.
   */
  async update(id, data) {
    const { name, start_date, end_date, base_event_price, addon_event_price, display_order } = data;
    const { rows } = await pool.query(
      `UPDATE pricing_periods
       SET name = COALESCE($2, name),
           start_date = COALESCE($3, start_date),
           end_date = COALESCE($4, end_date),
           base_event_price = COALESCE($5, base_event_price),
           addon_event_price = COALESCE($6, addon_event_price),
           display_order = COALESCE($7, display_order)
       WHERE id = $1
       RETURNING *`,
      [id, name, start_date, end_date, base_event_price, addon_event_price, display_order]
    );
    return rows[0];
  },

  /**
   * Delete a pricing period.
   */
  async delete(id) {
    const { rowCount } = await pool.query(
      'DELETE FROM pricing_periods WHERE id = $1',
      [id]
    );
    return rowCount > 0;
  },

  /**
   * Bulk upsert pricing periods (used by wizard save).
   * Deletes existing periods and re-creates them.
   */
  async bulkReplace(tournamentId, periods) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM pricing_periods WHERE tournament_id = $1', [tournamentId]);

      const results = [];
      for (let i = 0; i < periods.length; i++) {
        const p = periods[i];
        const { rows } = await client.query(
          `INSERT INTO pricing_periods
             (tournament_id, name, start_date, end_date, base_event_price, addon_event_price, display_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [tournamentId, p.name, p.start_date, p.end_date, p.base_event_price, p.addon_event_price, i]
        );
        results.push(rows[0]);
      }

      await client.query('COMMIT');
      return results;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};

module.exports = PricingPeriodQueries;
