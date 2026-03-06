const pool = require('../pool');

const SponsorQueries = {
  /**
   * Insert a new sponsor for a tournament.
   */
  async create(tournamentId, data) {
    const { rows } = await pool.query(
      `INSERT INTO tournament_sponsors
         (tournament_id, name, logo_url, description, website_url, category, discount_code, display_order, visible)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        tournamentId,
        data.name,
        data.logo_url || null,
        data.description || null,
        data.website_url || null,
        data.category || 'sponsor',
        data.discount_code || null,
        data.display_order ?? 0,
        data.visible !== false,
      ]
    );
    return rows[0];
  },

  /**
   * Get all sponsors for a tournament, ordered by display_order.
   */
  async getByTournament(tournamentId) {
    const { rows } = await pool.query(
      `SELECT * FROM tournament_sponsors
       WHERE tournament_id = $1
       ORDER BY display_order, created_at`,
      [tournamentId]
    );
    return rows;
  },

  /**
   * Get only visible sponsors for a tournament (public endpoint).
   */
  async getVisibleByTournament(tournamentId) {
    const { rows } = await pool.query(
      `SELECT id, name, logo_url, description, website_url, category, discount_code, display_order
       FROM tournament_sponsors
       WHERE tournament_id = $1 AND visible = true
       ORDER BY display_order, created_at`,
      [tournamentId]
    );
    return rows;
  },

  /**
   * Update a sponsor by ID.
   */
  async update(id, data) {
    const sets = [];
    const vals = [];
    let idx = 1;

    if (data.name !== undefined) { sets.push(`name = $${idx++}`); vals.push(data.name); }
    if (data.logo_url !== undefined) { sets.push(`logo_url = $${idx++}`); vals.push(data.logo_url); }
    if (data.description !== undefined) { sets.push(`description = $${idx++}`); vals.push(data.description); }
    if (data.website_url !== undefined) { sets.push(`website_url = $${idx++}`); vals.push(data.website_url); }
    if (data.category !== undefined) { sets.push(`category = $${idx++}`); vals.push(data.category); }
    if (data.discount_code !== undefined) { sets.push(`discount_code = $${idx++}`); vals.push(data.discount_code); }
    if (data.display_order !== undefined) { sets.push(`display_order = $${idx++}`); vals.push(data.display_order); }
    if (data.visible !== undefined) { sets.push(`visible = $${idx++}`); vals.push(data.visible); }

    if (!sets.length) return null;

    vals.push(id);
    const { rows } = await pool.query(
      `UPDATE tournament_sponsors SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    return rows[0] || null;
  },

  /**
   * Delete a sponsor by ID.
   */
  async remove(id) {
    const { rows } = await pool.query(
      'DELETE FROM tournament_sponsors WHERE id = $1 RETURNING id',
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Reorder sponsors: accept array of IDs in desired order,
   * update display_order for each.
   */
  async reorder(tournamentId, orderedIds) {
    for (let i = 0; i < orderedIds.length; i++) {
      await pool.query(
        'UPDATE tournament_sponsors SET display_order = $1 WHERE id = $2 AND tournament_id = $3',
        [i, orderedIds[i], tournamentId]
      );
    }
  },

  /**
   * Toggle the visible flag for a sponsor.
   */
  async toggleVisibility(id) {
    const { rows } = await pool.query(
      `UPDATE tournament_sponsors SET visible = NOT visible WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0] || null;
  },
};

module.exports = SponsorQueries;
