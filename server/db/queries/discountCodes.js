const pool = require('../pool');

const DiscountCodeQueries = {
  /**
   * Get all discount codes for a tournament (director view).
   */
  async getByTournament(tournamentId) {
    const { rows } = await pool.query(
      `SELECT dc.*, te.name AS event_name
       FROM discount_codes dc
       LEFT JOIN tournament_events te ON te.id = dc.event_id
       WHERE dc.tournament_id = $1
       ORDER BY dc.created_at DESC`,
      [tournamentId]
    );
    return rows;
  },

  /**
   * Validate a code and return it if redeemable.
   * Returns the code row or null if invalid / expired / maxed out.
   */
  async validate(tournamentId, code) {
    const { rows } = await pool.query(
      `SELECT dc.*, te.name AS event_name
       FROM discount_codes dc
       LEFT JOIN tournament_events te ON te.id = dc.event_id
       WHERE dc.tournament_id = $1
         AND UPPER(dc.code) = UPPER($2)
         AND dc.is_active = true
         AND (dc.valid_from IS NULL OR dc.valid_from <= NOW())
         AND (dc.valid_until IS NULL OR dc.valid_until > NOW())
         AND (dc.max_uses IS NULL OR dc.current_uses < dc.max_uses)`,
      [tournamentId, code.trim()]
    );
    return rows[0] || null;
  },

  /**
   * Create a new discount code.
   */
  async create(tournamentId, data) {
    const {
      code, description, discount_type, discount_value,
      scope, event_id, max_uses, valid_from, valid_until,
    } = data;
    const { rows } = await pool.query(
      `INSERT INTO discount_codes
         (tournament_id, code, description, discount_type, discount_value,
          scope, event_id, max_uses, valid_from, valid_until)
       VALUES ($1, UPPER($2), $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        tournamentId, code, description || null, discount_type, discount_value,
        scope || 'total', event_id || null,
        max_uses || null, valid_from || null, valid_until || null,
      ]
    );
    return rows[0];
  },

  /**
   * Update a discount code.
   */
  async update(id, data) {
    const {
      code, description, discount_type, discount_value,
      scope, event_id, max_uses, valid_from, valid_until, is_active,
    } = data;
    const { rows } = await pool.query(
      `UPDATE discount_codes
       SET code           = COALESCE(UPPER($2), code),
           description    = $3,
           discount_type  = COALESCE($4, discount_type),
           discount_value = COALESCE($5, discount_value),
           scope          = COALESCE($6, scope),
           event_id       = $7,
           max_uses       = $8,
           valid_from     = $9,
           valid_until    = $10,
           is_active      = COALESCE($11, is_active)
       WHERE id = $1
       RETURNING *`,
      [id, code, description, discount_type, discount_value,
       scope, event_id || null, max_uses || null, valid_from || null, valid_until || null, is_active]
    );
    return rows[0] || null;
  },

  /**
   * Delete a discount code.
   */
  async delete(id) {
    const { rowCount } = await pool.query(
      'DELETE FROM discount_codes WHERE id = $1',
      [id]
    );
    return rowCount > 0;
  },

  /**
   * Increment usage count when a code is redeemed.
   */
  async incrementUses(id) {
    await pool.query(
      'UPDATE discount_codes SET current_uses = current_uses + 1 WHERE id = $1',
      [id]
    );
  },
};

module.exports = DiscountCodeQueries;
