const pool = require('../pool');

const CheckinQueries = {
  /**
   * Get all registrations for a tournament with their check-in status.
   * Returns competitor info, events, waiver status, weight, and checkin data.
   */
  async getByTournament(tournamentId) {
    const { rows } = await pool.query(
      `SELECT r.id AS registration_id, r.profile_id,
              cp.first_name, cp.last_name, cp.academy_name,
              cp.weight AS registered_weight, cp.photo_url AS photo,
              c.id AS checkin_id, c.checked_in_at, c.checked_in_by,
              c.mat_called_at, c.mat_called_by, c.notes,
              c.actual_weight, c.weight_verified, c.aau_verified,
              c.status AS checkin_status, c.status_reason,
              w.status AS waiver_status, w.signed_at AS waiver_signed_at,
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
       LEFT JOIN waivers w ON w.registration_id = r.id
       LEFT JOIN registration_events re ON re.registration_id = r.id
       LEFT JOIN tournament_events te ON te.id = re.event_id
       WHERE r.tournament_id = $1
         AND r.status != 'cancelled'
         AND r.payment_status IN ('paid', 'waived', 'pay_later')
       GROUP BY r.id, cp.first_name, cp.last_name, cp.academy_name,
                cp.weight, cp.photo_url,
                c.id, c.checked_in_at, c.checked_in_by,
                c.mat_called_at, c.mat_called_by, c.notes,
                c.actual_weight, c.weight_verified, c.aau_verified,
                c.status, c.status_reason,
                w.status, w.signed_at
       ORDER BY cp.last_name, cp.first_name`,
      [tournamentId]
    );
    return rows;
  },

  /**
   * Check in a competitor (status = 'checked_in').
   */
  async create({ tournamentId, registrationId, checkedInBy, notes, actualWeight, weightVerified, aauVerified }) {
    const { rows } = await pool.query(
      `INSERT INTO checkins
         (tournament_id, registration_id, checked_in_by, notes, actual_weight,
          weight_verified, aau_verified, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'checked_in')
       RETURNING *`,
      [
        tournamentId,
        registrationId,
        checkedInBy,
        notes || null,
        actualWeight != null ? actualWeight : null,
        weightVerified || false,
        aauVerified || false,
      ]
    );
    return rows[0];
  },

  /**
   * Mark a competitor as absent (no-show). Creates checkin record if needed.
   */
  async markAbsent({ tournamentId, registrationId, markedBy, reason }) {
    const { rows } = await pool.query(
      `INSERT INTO checkins
         (tournament_id, registration_id, checked_in_by, checked_in_at, status, status_reason)
       VALUES ($1, $2, $3, NOW(), 'absent', $4)
       ON CONFLICT (tournament_id, registration_id)
       DO UPDATE SET status = 'absent', status_reason = $4, checked_in_by = $3
       RETURNING *`,
      [tournamentId, registrationId, markedBy, reason || null]
    );
    return rows[0];
  },

  /**
   * Mark a competitor as withdrawn (pulled out day-of). Creates record if needed.
   */
  async markWithdrawn({ tournamentId, registrationId, markedBy, reason }) {
    const { rows } = await pool.query(
      `INSERT INTO checkins
         (tournament_id, registration_id, checked_in_by, checked_in_at, status, status_reason)
       VALUES ($1, $2, $3, NOW(), 'withdrawn', $4)
       ON CONFLICT (tournament_id, registration_id)
       DO UPDATE SET status = 'withdrawn', status_reason = $4, checked_in_by = $3
       RETURNING *`,
      [tournamentId, registrationId, markedBy, reason || null]
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
   * Get check-in statistics for a tournament, broken down by status.
   */
  async getStats(tournamentId) {
    const { rows } = await pool.query(
      `SELECT
         COUNT(r.id)::int                                                     AS total,
         COUNT(c.id) FILTER (WHERE c.status = 'checked_in')::int             AS checked_in,
         COUNT(c.id) FILTER (WHERE c.status = 'absent')::int                 AS absent,
         COUNT(c.id) FILTER (WHERE c.status = 'withdrawn')::int              AS withdrawn,
         COUNT(c.mat_called_at)::int                                          AS on_mat,
         (COUNT(r.id) - COUNT(c.id) FILTER (WHERE c.status IS NOT NULL))::int AS not_checked_in
       FROM registrations r
       LEFT JOIN checkins c ON c.registration_id = r.id AND c.tournament_id = r.tournament_id
       WHERE r.tournament_id = $1
         AND r.status != 'cancelled'
         AND r.payment_status IN ('paid', 'waived', 'pay_later')`,
      [tournamentId]
    );
    return rows[0];
  },

  /**
   * Get all competitors marked absent or withdrawn for a tournament.
   * Used by bracket generation to insert byes for no-shows.
   */
  async getAbsentAndWithdrawn(tournamentId) {
    const { rows } = await pool.query(
      `SELECT c.registration_id, c.status, c.status_reason,
              cp.first_name, cp.last_name
       FROM checkins c
       JOIN registrations r ON r.id = c.registration_id
       JOIN competitor_profiles cp ON cp.id = r.profile_id
       WHERE c.tournament_id = $1
         AND c.status IN ('absent', 'withdrawn')`,
      [tournamentId]
    );
    return rows;
  },
};

module.exports = CheckinQueries;
