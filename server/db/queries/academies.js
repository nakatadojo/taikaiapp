const pool = require('../pool');

/**
 * Create a new academy.
 */
async function create({ name, logoUrl, headCoachId, address, city, state, website }) {
  const result = await pool.query(
    `INSERT INTO academies (name, logo_url, head_coach_id, address, city, state, website)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [name, logoUrl || null, headCoachId, address || null, city || null, state || null, website || null]
  );
  return result.rows[0];
}

/**
 * Find academy by ID.
 */
async function findById(id) {
  const result = await pool.query(
    'SELECT * FROM academies WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Find academy where user is head coach.
 */
async function findByCoach(coachId) {
  const result = await pool.query(
    'SELECT * FROM academies WHERE head_coach_id = $1',
    [coachId]
  );
  return result.rows[0] || null;
}

/**
 * Update academy details.
 */
async function update(id, updates) {
  const allowedFields = ['name', 'logo_url', 'address', 'city', 'state', 'website'];
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

  fields.push('updated_at = NOW()');
  values.push(id);

  const result = await pool.query(
    `UPDATE academies SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

/**
 * Add a member to an academy.
 */
async function addMember(academyId, userId, role, addedBy) {
  const result = await pool.query(
    `INSERT INTO academy_members (academy_id, user_id, role, added_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (academy_id, user_id) DO UPDATE SET role = $3
     RETURNING *`,
    [academyId, userId, role, addedBy]
  );
  return result.rows[0];
}

/**
 * Remove a member from an academy.
 */
async function removeMember(academyId, userId) {
  await pool.query(
    'DELETE FROM academy_members WHERE academy_id = $1 AND user_id = $2',
    [academyId, userId]
  );
}

/**
 * Get all members of an academy with user details.
 */
async function getMembers(academyId) {
  const result = await pool.query(
    `SELECT am.*, u.email, u.first_name, u.last_name, u.phone, u.profile_photo_url
     FROM academy_members am
     JOIN users u ON u.id = am.user_id
     WHERE am.academy_id = $1
     ORDER BY am.role, u.last_name`,
    [academyId]
  );
  return result.rows;
}

/**
 * Get all academies a user belongs to.
 */
async function getAcademiesForUser(userId) {
  const result = await pool.query(
    `SELECT a.*, am.role AS member_role
     FROM academies a
     JOIN academy_members am ON am.academy_id = a.id
     WHERE am.user_id = $1
     ORDER BY a.name`,
    [userId]
  );
  return result.rows;
}

/**
 * Search academies by name (for autocomplete).
 */
async function searchByName(query, limit = 10) {
  const result = await pool.query(
    `SELECT id, name FROM academies
     WHERE name ILIKE $1
     ORDER BY name
     LIMIT $2`,
    [`%${query}%`, limit]
  );
  return result.rows;
}

/**
 * Update academy logo URL.
 */
async function updateLogo(academyId, logoUrl) {
  const result = await pool.query(
    `UPDATE academies SET logo_url = $1, updated_at = NOW()
     WHERE id = $2 RETURNING *`,
    [logoUrl, academyId]
  );
  return result.rows[0] || null;
}

module.exports = {
  create,
  findById,
  findByCoach,
  update,
  addMember,
  removeMember,
  getMembers,
  getAcademiesForUser,
  searchByName,
  updateLogo,
};
