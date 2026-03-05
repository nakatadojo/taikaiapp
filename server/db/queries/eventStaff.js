const pool = require('../pool');

/**
 * Get all staff for a tournament.
 */
async function getByTournament(tournamentId) {
  const result = await pool.query(
    `SELECT * FROM event_staff WHERE tournament_id = $1 ORDER BY role, name`,
    [tournamentId]
  );
  return result.rows;
}

/**
 * Get a single staff member by ID.
 */
async function findById(id) {
  const result = await pool.query(
    'SELECT * FROM event_staff WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Create a staff member.
 */
async function create({ tournamentId, name, email, phone, role, status, notes, tshirtSize, userId, createdBy }) {
  const result = await pool.query(
    `INSERT INTO event_staff
      (tournament_id, name, email, phone, role, status, notes, tshirt_size, user_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      tournamentId, name, email || null, phone || null,
      role || 'volunteer', status || 'pending',
      notes || null, tshirtSize || null, userId || null, createdBy || null,
    ]
  );
  return result.rows[0];
}

/**
 * Update a staff member.
 */
async function update(id, updates) {
  const allowedFields = [
    'name', 'email', 'phone', 'role', 'status', 'notes', 'tshirt_size',
  ];
  const fields = [];
  const values = [];
  let idx = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      fields.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }
  }

  if (fields.length === 0) return findById(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await pool.query(
    `UPDATE event_staff SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

/**
 * Delete a staff member.
 */
async function remove(id) {
  const result = await pool.query(
    'DELETE FROM event_staff WHERE id = $1 RETURNING id',
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Get staff counts grouped by role for a tournament.
 */
async function getCountsByRole(tournamentId) {
  const result = await pool.query(
    `SELECT role, status, COUNT(*)::int as count
     FROM event_staff WHERE tournament_id = $1
     GROUP BY role, status ORDER BY role`,
    [tournamentId]
  );
  return result.rows;
}

module.exports = {
  getByTournament,
  findById,
  create,
  update,
  remove,
  getCountsByRole,
};
