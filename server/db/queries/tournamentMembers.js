const pool = require('../pool');

/**
 * Create a tournament member application (or re-apply if previously declined).
 */
async function create({ userId, tournamentId, role, staffRole }) {
  const result = await pool.query(
    `INSERT INTO tournament_members (user_id, tournament_id, role, staff_role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, tournament_id, role) DO UPDATE
       SET status = 'pending', applied_at = NOW(), reviewed_at = NULL, reviewed_by = NULL,
           staff_role = COALESCE($4, tournament_members.staff_role)
     RETURNING *`,
    [userId, tournamentId, role, staffRole || null]
  );
  return result.rows[0];
}

/**
 * Find a tournament member by ID (with user + tournament info).
 */
async function findById(id) {
  const result = await pool.query(
    `SELECT tm.*, u.first_name, u.last_name, u.email,
            t.name AS tournament_name, t.date AS tournament_date,
            t.location AS tournament_location
     FROM tournament_members tm
     JOIN users u ON u.id = tm.user_id
     JOIN tournaments t ON t.id = tm.tournament_id
     WHERE tm.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Get all members for a tournament, optionally filtered by status.
 */
async function getByTournament(tournamentId, { status } = {}) {
  let query = `
    SELECT tm.*, u.first_name, u.last_name, u.email, u.phone
    FROM tournament_members tm
    JOIN users u ON u.id = tm.user_id
    WHERE tm.tournament_id = $1
  `;
  const params = [tournamentId];

  if (status) {
    query += ` AND tm.status = $2`;
    params.push(status);
  }

  query += ` ORDER BY tm.applied_at DESC`;

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Approve a pending tournament member application.
 */
async function approve(id, reviewedBy) {
  const result = await pool.query(
    `UPDATE tournament_members
     SET status = 'approved', reviewed_at = NOW(), reviewed_by = $1
     WHERE id = $2 AND status = 'pending'
     RETURNING *`,
    [reviewedBy, id]
  );
  return result.rows[0] || null;
}

/**
 * Decline a pending tournament member application.
 */
async function decline(id, reviewedBy) {
  const result = await pool.query(
    `UPDATE tournament_members
     SET status = 'declined', reviewed_at = NOW(), reviewed_by = $1
     WHERE id = $2 AND status = 'pending'
     RETURNING *`,
    [reviewedBy, id]
  );
  return result.rows[0] || null;
}

/**
 * Get all tournament memberships for a user (for My Events page).
 */
async function getByUser(userId) {
  const result = await pool.query(
    `SELECT tm.*, t.name AS tournament_name, t.date AS tournament_date,
            t.location AS tournament_location, t.slug AS tournament_slug
     FROM tournament_members tm
     JOIN tournaments t ON t.id = tm.tournament_id
     WHERE tm.user_id = $1
     ORDER BY t.date DESC, tm.applied_at DESC`,
    [userId]
  );
  return result.rows;
}

/**
 * Get staff/judge assignments for a user (for Staff Dashboard).
 * Includes tournament info, custom role name, and permissions.
 */
async function getStaffDashboard(userId) {
  const result = await pool.query(
    `SELECT tm.id, tm.tournament_id, tm.role, tm.staff_role, tm.status,
            t.name AS tournament_name, t.date AS tournament_date,
            t.location AS tournament_location, t.slug AS tournament_slug,
            t.city AS tournament_city, t.state AS tournament_state,
            srd.role_name AS custom_role_name, srd.permissions AS custom_permissions
     FROM tournament_members tm
     JOIN tournaments t ON t.id = tm.tournament_id
     LEFT JOIN staff_role_definitions srd ON tm.role_definition_id = srd.id
     WHERE tm.user_id = $1
       AND tm.status = 'approved'
       AND tm.role IN ('staff', 'judge')
     ORDER BY t.date ASC NULLS LAST`,
    [userId]
  );
  return result.rows;
}

/**
 * Mark a tournament member as checked in on event day.
 */
async function checkIn(memberId, checkedInBy) {
  const result = await pool.query(
    `UPDATE tournament_members
     SET checked_in_at = NOW(), checked_in_by = $2
     WHERE id = $1 AND status = 'approved'
     RETURNING *`,
    [memberId, checkedInBy]
  );
  return result.rows[0] || null;
}

/**
 * Undo a member check-in.
 */
async function undoCheckIn(memberId) {
  const result = await pool.query(
    `UPDATE tournament_members
     SET checked_in_at = NULL, checked_in_by = NULL
     WHERE id = $1
     RETURNING *`,
    [memberId]
  );
  return result.rows[0] || null;
}

module.exports = { create, findById, getByTournament, approve, decline, getByUser, getStaffDashboard, checkIn, undoCheckIn };
