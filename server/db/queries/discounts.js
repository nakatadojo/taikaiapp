const pool = require('../pool');

/**
 * Create a discount code.
 */
async function create({ code, type, value, maxUses, expiresAt, active, tournamentId, createdBy }) {
  const result = await pool.query(
    `INSERT INTO discount_codes
      (code, type, value, max_uses, expires_at, active, tournament_id, created_by)
     VALUES (LOWER($1), $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      code, type, value, maxUses || null,
      expiresAt || null, active !== false, tournamentId || null, createdBy || null,
    ]
  );
  return result.rows[0];
}

/**
 * Get all discount codes.
 */
async function getAll() {
  const result = await pool.query(
    `SELECT dc.*, t.name AS tournament_name
     FROM discount_codes dc
     LEFT JOIN tournaments t ON t.id = dc.tournament_id
     ORDER BY dc.created_at DESC`
  );
  return result.rows;
}

/**
 * Find by ID.
 */
async function findById(id) {
  const result = await pool.query(
    'SELECT * FROM discount_codes WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Find by code (case-insensitive).
 */
async function findByCode(code) {
  const result = await pool.query(
    'SELECT * FROM discount_codes WHERE code = LOWER($1)',
    [code]
  );
  return result.rows[0] || null;
}

/**
 * Update a discount code.
 */
async function update(id, updates) {
  const allowedFields = [
    'code', 'type', 'value', 'max_uses', 'expires_at', 'active', 'tournament_id',
  ];
  const fields = [];
  const values = [];
  let idx = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      if (key === 'code') {
        fields.push(`${key} = LOWER($${idx})`);
      } else {
        fields.push(`${key} = $${idx}`);
      }
      values.push(value);
      idx++;
    }
  }

  if (fields.length === 0) return findById(id);

  values.push(id);

  const result = await pool.query(
    `UPDATE discount_codes SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

/**
 * Delete a discount code.
 */
async function remove(id) {
  const result = await pool.query(
    'DELETE FROM discount_codes WHERE id = $1 RETURNING id',
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Validate a discount code for use.
 * Returns the code if valid, or an error message if not.
 */
async function validate(code, tournamentId) {
  const discount = await findByCode(code);

  if (!discount) return { valid: false, error: 'Invalid discount code' };
  if (!discount.active) return { valid: false, error: 'This discount code is no longer active' };
  if (discount.expires_at && new Date(discount.expires_at) < new Date()) {
    return { valid: false, error: 'This discount code has expired' };
  }
  if (discount.max_uses !== null && discount.times_used >= discount.max_uses) {
    return { valid: false, error: 'This discount code has reached its maximum uses' };
  }
  if (discount.tournament_id && discount.tournament_id !== tournamentId) {
    return { valid: false, error: 'This discount code is not valid for this tournament' };
  }

  return { valid: true, discount };
}

/**
 * Increment times_used counter.
 */
async function incrementUsage(id) {
  await pool.query(
    'UPDATE discount_codes SET times_used = times_used + 1 WHERE id = $1',
    [id]
  );
}

module.exports = {
  create,
  getAll,
  findById,
  findByCode,
  update,
  remove,
  validate,
  incrementUsage,
};
