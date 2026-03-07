const pool = require('../pool');

const CertificateQueries = {
  /**
   * Get the certificate template for a tournament.
   * Returns null if none exists.
   */
  async getByTournament(tournamentId) {
    const { rows } = await pool.query(
      `SELECT * FROM certificate_templates WHERE tournament_id = $1`,
      [tournamentId]
    );
    return rows[0] || null;
  },

  /**
   * Insert or update a certificate template for a tournament.
   * Uses ON CONFLICT on the unique tournament_id constraint.
   *
   * @param {string} tournamentId
   * @param {object} data - { template_data?, template_url?, merge_tag_config? }
   */
  async upsert(tournamentId, data) {
    const { template_data, template_url, merge_tag_config } = data;

    const { rows } = await pool.query(
      `INSERT INTO certificate_templates (tournament_id, template_data, template_url, merge_tag_config)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tournament_id)
       DO UPDATE SET
         template_data = COALESCE($2, certificate_templates.template_data),
         template_url = COALESCE($3, certificate_templates.template_url),
         merge_tag_config = COALESCE($4, certificate_templates.merge_tag_config),
         updated_at = NOW()
       RETURNING *`,
      [
        tournamentId,
        template_data || null,
        template_url || null,
        merge_tag_config ? JSON.stringify(merge_tag_config) : null,
      ]
    );
    return rows[0];
  },

  /**
   * Save only the merge-tag config (field positions, font sizes, etc.).
   */
  async saveConfig(tournamentId, mergeTagConfig) {
    const { rows } = await pool.query(
      `INSERT INTO certificate_templates (tournament_id, merge_tag_config)
       VALUES ($1, $2)
       ON CONFLICT (tournament_id)
       DO UPDATE SET merge_tag_config = $2, updated_at = NOW()
       RETURNING *`,
      [tournamentId, JSON.stringify(mergeTagConfig)]
    );
    return rows[0];
  },

  /**
   * Delete the certificate template for a tournament.
   */
  async remove(tournamentId) {
    const { rows } = await pool.query(
      `DELETE FROM certificate_templates WHERE tournament_id = $1 RETURNING id`,
      [tournamentId]
    );
    return rows[0] || null;
  },
};

module.exports = CertificateQueries;
