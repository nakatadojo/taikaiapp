const pool = require('../pool');

const MedicalIncidentQueries = {
  /**
   * Insert a new medical incident.
   */
  async create(data) {
    const { rows } = await pool.query(
      `INSERT INTO medical_incidents
        (tournament_id, competitor_profile_id, competitor_name, mat_number,
         description, official_present, able_to_continue, medical_staff_called, logged_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.tournamentId,
        data.competitorProfileId || null,
        data.competitorName,
        data.matNumber || null,
        data.description,
        data.officialPresent || null,
        data.ableToContinue || false,
        data.medicalStaffCalled || false,
        data.loggedBy || null,
      ]
    );
    return rows[0];
  },

  /**
   * Get all incidents for a tournament, ordered by most recent first.
   */
  async getByTournament(tournamentId) {
    const { rows } = await pool.query(
      `SELECT mi.*,
              u.first_name AS logged_by_first_name,
              u.last_name AS logged_by_last_name
       FROM medical_incidents mi
       LEFT JOIN users u ON mi.logged_by = u.id
       WHERE mi.tournament_id = $1
       ORDER BY mi.created_at DESC`,
      [tournamentId]
    );
    return rows;
  },

  /**
   * Get a single incident by ID.
   */
  async getById(id) {
    const { rows } = await pool.query(
      `SELECT mi.*,
              u.first_name AS logged_by_first_name,
              u.last_name AS logged_by_last_name
       FROM medical_incidents mi
       LEFT JOIN users u ON mi.logged_by = u.id
       WHERE mi.id = $1`,
      [id]
    );
    return rows[0];
  },

  /**
   * Get all incidents for CSV export, with competitor profile details.
   */
  async exportForTournament(tournamentId) {
    const { rows } = await pool.query(
      `SELECT mi.*,
              cp.first_name AS profile_first_name,
              cp.last_name AS profile_last_name,
              cp.academy_name,
              cp.belt_rank,
              u.first_name AS logged_by_first_name,
              u.last_name AS logged_by_last_name
       FROM medical_incidents mi
       LEFT JOIN competitor_profiles cp ON mi.competitor_profile_id = cp.id
       LEFT JOIN users u ON mi.logged_by = u.id
       WHERE mi.tournament_id = $1
       ORDER BY mi.created_at DESC`,
      [tournamentId]
    );
    return rows;
  },
};

module.exports = MedicalIncidentQueries;
