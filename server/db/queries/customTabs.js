const pool = require('../pool');

const CustomTabsQueries = {
  async getByTournament(tournamentId) {
    const { rows } = await pool.query(
      `SELECT * FROM tournament_custom_tabs
       WHERE tournament_id = $1
       ORDER BY tab_order, created_at`,
      [tournamentId]
    );
    return rows;
  },

  async getVisibleByTournament(tournamentId) {
    const { rows } = await pool.query(
      `SELECT id, tab_name, tab_order, content_html
       FROM tournament_custom_tabs
       WHERE tournament_id = $1 AND visible = true
       ORDER BY tab_order, created_at`,
      [tournamentId]
    );
    return rows;
  },

  async create({ tournamentId, tabName, tabOrder, contentHtml, visible }) {
    const { rows } = await pool.query(
      `INSERT INTO tournament_custom_tabs (tournament_id, tab_name, tab_order, content_html, visible)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [tournamentId, tabName, tabOrder || 0, contentHtml || '', visible !== false]
    );
    return rows[0];
  },

  async update(tabId, { tabName, tabOrder, contentHtml, visible }) {
    const sets = [];
    const vals = [];
    let idx = 1;

    if (tabName !== undefined) { sets.push(`tab_name = $${idx++}`); vals.push(tabName); }
    if (tabOrder !== undefined) { sets.push(`tab_order = $${idx++}`); vals.push(tabOrder); }
    if (contentHtml !== undefined) { sets.push(`content_html = $${idx++}`); vals.push(contentHtml); }
    if (visible !== undefined) { sets.push(`visible = $${idx++}`); vals.push(visible); }

    if (!sets.length) return null;

    vals.push(tabId);
    const { rows } = await pool.query(
      `UPDATE tournament_custom_tabs SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    return rows[0];
  },

  async delete(tabId) {
    const { rows } = await pool.query(
      'DELETE FROM tournament_custom_tabs WHERE id = $1 RETURNING id',
      [tabId]
    );
    return rows[0];
  },

  async reorder(tournamentId, orderedIds) {
    for (let i = 0; i < orderedIds.length; i++) {
      await pool.query(
        'UPDATE tournament_custom_tabs SET tab_order = $1 WHERE id = $2 AND tournament_id = $3',
        [i, orderedIds[i], tournamentId]
      );
    }
  },
};

module.exports = CustomTabsQueries;
