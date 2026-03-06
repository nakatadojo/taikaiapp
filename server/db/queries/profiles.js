const pool = require('../pool');

/**
 * Get all profiles for a user.
 */
async function getProfilesForUser(userId) {
  const result = await pool.query(
    `SELECT cp.*, a.name AS linked_academy_name
     FROM competitor_profiles cp
     LEFT JOIN academies a ON a.id = cp.academy_id
     WHERE cp.user_id = $1
     ORDER BY cp.is_self DESC, cp.created_at ASC`,
    [userId]
  );
  return result.rows;
}

/**
 * Get a single profile by ID.
 */
async function findById(profileId) {
  const result = await pool.query(
    `SELECT cp.*, a.name AS linked_academy_name
     FROM competitor_profiles cp
     LEFT JOIN academies a ON a.id = cp.academy_id
     WHERE cp.id = $1`,
    [profileId]
  );
  return result.rows[0] || null;
}

/**
 * Create a competitor profile.
 */
async function create({
  userId, firstName, lastName, dateOfBirth, gender,
  beltRank, experienceLevel, weight, academyName, academyId, isSelf,
  guardianEmail,
}) {
  const result = await pool.query(
    `INSERT INTO competitor_profiles
      (user_id, first_name, last_name, date_of_birth, gender,
       belt_rank, experience_level, weight, academy_name, academy_id, is_self, guardian_email)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      userId, firstName, lastName, dateOfBirth, gender,
      beltRank || null, experienceLevel || null, weight || null,
      academyName || null, academyId || null, isSelf || false,
      guardianEmail || null,
    ]
  );
  return result.rows[0];
}

/**
 * Update a competitor profile.
 */
async function update(profileId, updates) {
  const allowedFields = [
    'first_name', 'last_name', 'date_of_birth', 'gender',
    'belt_rank', 'experience_level', 'weight', 'academy_name', 'academy_id',
    'guardian_email',
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

  if (fields.length === 0) return findById(profileId);

  fields.push('updated_at = NOW()');
  values.push(profileId);

  const result = await pool.query(
    `UPDATE competitor_profiles SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

/**
 * Delete a competitor profile (only if no active registrations).
 */
async function remove(profileId) {
  // Check for active registrations
  const regCheck = await pool.query(
    `SELECT COUNT(*) AS count FROM registrations
     WHERE profile_id = $1 AND status != 'cancelled'`,
    [profileId]
  );
  if (parseInt(regCheck.rows[0].count) > 0) {
    return { error: 'Cannot delete profile with active registrations' };
  }

  const result = await pool.query(
    'DELETE FROM competitor_profiles WHERE id = $1 RETURNING id',
    [profileId]
  );
  return result.rows[0] || null;
}

/**
 * Check if a user already has a self-profile.
 */
async function hasSelfProfile(userId) {
  const result = await pool.query(
    'SELECT id FROM competitor_profiles WHERE user_id = $1 AND is_self = true',
    [userId]
  );
  return result.rows[0] || null;
}

module.exports = {
  getProfilesForUser,
  findById,
  create,
  update,
  remove,
  hasSelfProfile,
};
