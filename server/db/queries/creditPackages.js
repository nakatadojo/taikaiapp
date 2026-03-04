const pool = require('../pool');

/**
 * Get all active credit packages, ordered by sort_order.
 */
async function getAll() {
  const result = await pool.query(
    `SELECT id, slug, credits, price_in_cents, label, active, sort_order
     FROM credit_packages
     ORDER BY sort_order ASC, credits ASC`
  );
  return result.rows;
}

/**
 * Get only active packages (for director-facing endpoint).
 */
async function getActive() {
  const result = await pool.query(
    `SELECT id, slug, credits, price_in_cents, label
     FROM credit_packages
     WHERE active = true
     ORDER BY sort_order ASC, credits ASC`
  );
  return result.rows;
}

/**
 * Get a single package by ID.
 */
async function getById(id) {
  const result = await pool.query(
    'SELECT * FROM credit_packages WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Get a single package by slug.
 */
async function getBySlug(slug) {
  const result = await pool.query(
    'SELECT * FROM credit_packages WHERE slug = $1',
    [slug]
  );
  return result.rows[0] || null;
}

/**
 * Create a new credit package.
 */
async function create({ slug, credits, priceInCents, label, active = true, sortOrder = 0 }) {
  const result = await pool.query(
    `INSERT INTO credit_packages (slug, credits, price_in_cents, label, active, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [slug, credits, priceInCents, label, active, sortOrder]
  );
  return result.rows[0];
}

/**
 * Update an existing credit package.
 */
async function update(id, fields) {
  const allowed = ['slug', 'credits', 'price_in_cents', 'label', 'active', 'sort_order'];
  const setClauses = [];
  const values = [];
  let idx = 1;

  for (const [key, value] of Object.entries(fields)) {
    if (allowed.includes(key) && value !== undefined) {
      setClauses.push(`${key} = $${idx++}`);
      values.push(value);
    }
  }

  if (setClauses.length === 0) return getById(id);

  setClauses.push('updated_at = NOW()');
  values.push(id);

  const result = await pool.query(
    `UPDATE credit_packages SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

/**
 * Delete a credit package.
 */
async function remove(id) {
  const result = await pool.query(
    'DELETE FROM credit_packages WHERE id = $1 RETURNING id',
    [id]
  );
  return result.rows.length > 0;
}

module.exports = {
  getAll,
  getActive,
  getById,
  getBySlug,
  create,
  update,
  remove,
};
