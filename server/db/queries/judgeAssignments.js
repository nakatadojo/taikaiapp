const pool = require('../pool');

const JudgeAssignmentQueries = {

  async getByTournament(tournamentId) {
    const { rows } = await pool.query(
      `SELECT ja.*,
              u.first_name AS user_first_name,
              u.last_name  AS user_last_name,
              u.email      AS user_email
       FROM judge_assignments ja
       LEFT JOIN users u ON ja.user_id = u.id
       WHERE ja.tournament_id = $1
       ORDER BY ja.mat_id ASC, ja.scheduled_from ASC NULLS LAST, ja.chair ASC`,
      [tournamentId]
    );
    return rows;
  },

  async getByMat(tournamentId, matId) {
    const { rows } = await pool.query(
      `SELECT ja.*,
              u.first_name AS user_first_name,
              u.last_name  AS user_last_name
       FROM judge_assignments ja
       LEFT JOIN users u ON ja.user_id = u.id
       WHERE ja.tournament_id = $1 AND ja.mat_id = $2
       ORDER BY ja.scheduled_from ASC NULLS LAST, ja.chair ASC`,
      [tournamentId, matId]
    );
    return rows;
  },

  async getByUser(userId, tournamentId) {
    const { rows } = await pool.query(
      `SELECT * FROM judge_assignments
       WHERE user_id = $1 AND tournament_id = $2
       ORDER BY mat_id ASC, scheduled_from ASC NULLS LAST`,
      [userId, tournamentId]
    );
    return rows;
  },

  async getById(id) {
    const { rows } = await pool.query(
      `SELECT ja.*,
              u.first_name AS user_first_name,
              u.last_name  AS user_last_name
       FROM judge_assignments ja
       LEFT JOIN users u ON ja.user_id = u.id
       WHERE ja.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async create({ tournamentId, userId, officialName, matId, chair, scheduledFrom, scheduledUntil }) {
    const { rows } = await pool.query(
      `INSERT INTO judge_assignments
         (tournament_id, user_id, official_name, mat_id, chair, scheduled_from, scheduled_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tournamentId, userId || null, officialName, matId, chair, scheduledFrom || null, scheduledUntil || null]
    );
    return rows[0];
  },

  async update(id, { officialName, userId, matId, chair, scheduledFrom, scheduledUntil }) {
    const { rows } = await pool.query(
      `UPDATE judge_assignments
       SET official_name   = COALESCE($2, official_name),
           user_id         = $3,
           mat_id          = COALESCE($4, mat_id),
           chair           = COALESCE($5, chair),
           scheduled_from  = $6,
           scheduled_until = $7,
           updated_at      = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, officialName, userId || null, matId, chair, scheduledFrom || null, scheduledUntil || null]
    );
    return rows[0] || null;
  },

  async delete(id) {
    const { rows } = await pool.query(
      `DELETE FROM judge_assignments WHERE id = $1 RETURNING id`,
      [id]
    );
    return rows[0] || null;
  },

  /** Judge taps "Sit" on their device. */
  async sit(id) {
    const { rows } = await pool.query(
      `UPDATE judge_assignments
       SET status    = 'seated',
           seated_at = NOW(),
           stood_at  = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return rows[0] || null;
  },

  /** Judge taps "Stand Up" — relief has arrived. */
  async stand(id) {
    const { rows } = await pool.query(
      `UPDATE judge_assignments
       SET status     = 'relieved',
           stood_at   = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Returns all seated/active assignments for a mat right now.
   * Used to determine if a panel is ready to begin.
   */
  async getSeatedForMat(tournamentId, matId) {
    const { rows } = await pool.query(
      `SELECT * FROM judge_assignments
       WHERE tournament_id = $1
         AND mat_id = $2
         AND status IN ('seated','active')
       ORDER BY chair ASC`,
      [tournamentId, matId]
    );
    return rows;
  },

  /**
   * Returns all assignments for a mat grouped by chair.
   * Includes only the currently active/seated assignment per chair
   * (ignores relieved/complete ones).
   */
  async getPanelStatus(tournamentId, matId) {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (chair)
              id, chair, official_name, user_id, status,
              scheduled_from, scheduled_until, seated_at
       FROM judge_assignments
       WHERE tournament_id = $1
         AND mat_id = $2
         AND status NOT IN ('relieved','complete')
       ORDER BY chair ASC, scheduled_from ASC NULLS LAST`,
      [tournamentId, matId]
    );
    return rows;
  },
};

module.exports = JudgeAssignmentQueries;
