const pool = require('../pool');

const CheckinQueries = {
  /**
   * Get all registrations for a tournament with their check-in status.
   * Returns competitor info, events, and checkin data.
   */
  async getByTournament(tournamentId) {
    const { rows } = await pool.query(
      `SELECT r.id AS registration_id, r.profile_id,
              cp.first_name, cp.last_name, cp.academy_name,
              c.id AS checkin_id, c.checked_in_at, c.checked_in_by,
              c.mat_called_at, c.mat_called_by, c.notes,
              COALESCE(
                json_agg(
                  json_build_object(
                    'eventName', te.name,
                    'eventId', re.event_id,
                    'assignedDivision', re.assigned_division
                  )
                ) FILTER (WHERE re.id IS NOT NULL),
                '[]'
              ) AS events
       FROM registrations r
       JOIN competitor_profiles cp ON r.profile_id = cp.id
       LEFT JOIN checkins c ON c.registration_id = r.id AND c.tournament_id = r.tournament_id
       LEFT JOIN registration_events re ON re.registration_id = r.id
       LEFT JOIN tournament_events te ON te.id = re.event_id
       WHERE r.tournament_id = $1
         AND r.status != 'cancelled'
         AND r.payment_status IN ('paid', 'waived')
       GROUP BY r.id, cp.first_name, cp.last_name, cp.academy_name,
                c.id, c.checked_in_at, c.checked_in_by,
                c.mat_called_at, c.mat_called_by, c.notes
       ORDER BY cp.last_name, cp.first_name`,
      [tournamentId]
    );
    return rows;
  },

  /**
   * Check in a competitor.
   */
  async create({ tournamentId, registrationId, checkedInBy, notes }) {
    const { rows } = await pool.query(
      `INSERT INTO checkins (tournament_id, registration_id, checked_in_by, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [tournamentId, registrationId, checkedInBy, notes || null]
    );
    return rows[0];
  },

  /**
   * Get a single checkin record.
   */
  async getByRegistration(tournamentId, registrationId) {
    const { rows } = await pool.query(
      `SELECT * FROM checkins
       WHERE tournament_id = $1 AND registration_id = $2`,
      [tournamentId, registrationId]
    );
    return rows[0];
  },

  /**
   * Mark competitor as called to mat (prevents undo).
   */
  async markMatCalled(tournamentId, registrationId, matCalledBy) {
    const { rows } = await pool.query(
      `UPDATE checkins
       SET mat_called_at = NOW(), mat_called_by = $3
       WHERE tournament_id = $1 AND registration_id = $2
       RETURNING *`,
      [tournamentId, registrationId, matCalledBy]
    );
    return rows[0];
  },

  /**
   * Undo a check-in (only if not mat-called).
   * Returns { deleted: true } or { deleted: false, reason: string }.
   */
  async remove(tournamentId, registrationId) {
    // First check if mat-called
    const checkin = await this.getByRegistration(tournamentId, registrationId);
    if (!checkin) {
      return { deleted: false, reason: 'not_found' };
    }
    if (checkin.mat_called_at) {
      return { deleted: false, reason: 'mat_called' };
    }

    await pool.query(
      'DELETE FROM checkins WHERE tournament_id = $1 AND registration_id = $2',
      [tournamentId, registrationId]
    );
    return { deleted: true };
  },

  /**
   * Get check-in statistics for a tournament.
   */
  async getStats(tournamentId) {
    const { rows } = await pool.query(
      `SELECT
         COUNT(r.id)::int AS total,
         COUNT(c.id)::int AS checked_in,
         COUNT(c.mat_called_at)::int AS on_mat,
         (COUNT(r.id) - COUNT(c.id))::int AS missing
       FROM registrations r
       LEFT JOIN checkins c ON c.registration_id = r.id AND c.tournament_id = r.tournament_id
       WHERE r.tournament_id = $1
         AND r.status != 'cancelled'
         AND r.payment_status IN ('paid', 'waived')`,
      [tournamentId]
    );
    return rows[0];
  },
};

module.exports = CheckinQueries;
