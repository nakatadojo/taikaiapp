const pool = require('../pool');

/**
 * Create a waiver record.
 */
async function create({ registrationId, tournamentId, profileId, competitorName, parentEmail, token, createdBy, waiverText }) {
  const result = await pool.query(
    `INSERT INTO waivers
      (registration_id, tournament_id, profile_id, competitor_name, parent_email, token, created_by, waiver_text)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [registrationId, tournamentId, profileId || null, competitorName, parentEmail, token, createdBy || null, waiverText || null]
  );
  return result.rows[0];
}

/**
 * Find a waiver by its signing token (with tournament info for the signing page).
 */
async function findByToken(token) {
  const result = await pool.query(
    `SELECT w.*, t.name AS tournament_name, t.date AS tournament_date,
            t.location AS tournament_location
     FROM waivers w
     JOIN tournaments t ON t.id = w.tournament_id
     WHERE w.token = $1`,
    [token]
  );
  return result.rows[0] || null;
}

/**
 * Sign a waiver (update status to signed).
 */
async function sign(token, parentName, signedIp) {
  const result = await pool.query(
    `UPDATE waivers
     SET status = 'signed', signed_at = NOW(), parent_name = $1, signed_ip = $2
     WHERE token = $3 AND status = 'pending'
     RETURNING *`,
    [parentName, signedIp || null, token]
  );
  return result.rows[0] || null;
}

/**
 * Get all waivers for a registration.
 */
async function getByRegistration(registrationId) {
  const result = await pool.query(
    `SELECT w.*, t.name AS tournament_name
     FROM waivers w
     JOIN tournaments t ON t.id = w.tournament_id
     WHERE w.registration_id = $1
     ORDER BY w.created_at DESC`,
    [registrationId]
  );
  return result.rows;
}

/**
 * Get all waivers created by a coach.
 */
async function getByCoach(coachUserId) {
  const result = await pool.query(
    `SELECT w.*, t.name AS tournament_name, t.date AS tournament_date,
            t.location AS tournament_location
     FROM waivers w
     JOIN tournaments t ON t.id = w.tournament_id
     WHERE w.created_by = $1
     ORDER BY w.created_at DESC`,
    [coachUserId]
  );
  return result.rows;
}

/**
 * Get waivers for a specific tournament created by a specific coach.
 */
async function getByTournamentAndCoach(tournamentId, coachUserId) {
  const result = await pool.query(
    `SELECT w.*, t.name AS tournament_name, t.date AS tournament_date,
            t.location AS tournament_location
     FROM waivers w
     JOIN tournaments t ON t.id = w.tournament_id
     WHERE w.tournament_id = $1 AND w.created_by = $2
     ORDER BY w.created_at DESC`,
    [tournamentId, coachUserId]
  );
  return result.rows;
}

module.exports = { create, findByToken, sign, getByRegistration, getByCoach, getByTournamentAndCoach };
