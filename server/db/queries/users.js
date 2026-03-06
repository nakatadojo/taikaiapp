const pool = require('../pool');

async function findByEmail(email) {
  const result = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  return result.rows[0] || null;
}

async function findById(id) {
  const result = await pool.query(
    `SELECT id, email, first_name, last_name, phone, date_of_birth,
            profile_photo_url, email_verified, account_type,
            organization_name, credit_balance, settings,
            profile_completed, address_line1, address_city, address_state, address_zip,
            is_certified, certification_body, certification_class,
            created_at, updated_at
     FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function create({ email, passwordHash, firstName, lastName, phone, dateOfBirth, verificationToken, verificationTokenExpires }) {
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, phone, date_of_birth,
                        verification_token, verification_token_expires)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, email, first_name, last_name, email_verified, created_at`,
    [
      email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      phone || null,
      dateOfBirth || null,
      verificationToken,
      verificationTokenExpires,
    ]
  );
  return result.rows[0];
}

/**
 * Create a user with email already verified (for admin bootstrap).
 */
async function createVerified({ email, passwordHash, firstName, lastName }) {
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, email_verified)
     VALUES ($1, $2, $3, $4, TRUE)
     RETURNING id, email, first_name, last_name, email_verified, created_at`,
    [email.toLowerCase(), passwordHash, firstName, lastName]
  );
  return result.rows[0];
}

async function verifyEmail(token) {
  const result = await pool.query(
    `UPDATE users
     SET email_verified = TRUE,
         verification_token = NULL,
         verification_token_expires = NULL,
         updated_at = NOW()
     WHERE verification_token = $1
       AND verification_token_expires > NOW()
     RETURNING id, email`,
    [token]
  );
  return result.rows[0] || null;
}

async function setResetToken(email, token, expires) {
  const result = await pool.query(
    `UPDATE users
     SET reset_token = $1,
         reset_token_expires = $2,
         updated_at = NOW()
     WHERE email = $3
     RETURNING id`,
    [token, expires, email.toLowerCase()]
  );
  return result.rows[0] || null;
}

async function resetPassword(token, passwordHash) {
  const result = await pool.query(
    `UPDATE users
     SET password_hash = $1,
         reset_token = NULL,
         reset_token_expires = NULL,
         updated_at = NOW()
     WHERE reset_token = $2
       AND reset_token_expires > NOW()
     RETURNING id, email`,
    [passwordHash, token]
  );
  return result.rows[0] || null;
}

async function updateProfile(id, updates) {
  // Only allow specific fields to be updated
  const allowedFields = [
    'first_name', 'last_name', 'phone', 'date_of_birth', 'profile_photo_url',
    'account_type', 'profile_completed',
    'address_line1', 'address_city', 'address_state', 'address_zip',
    'is_certified', 'certification_body', 'certification_class',
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

  fields.push('updated_at = NOW()');
  values.push(id);

  const result = await pool.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}
     RETURNING id, email, first_name, last_name, phone, date_of_birth, profile_photo_url, email_verified`,
    values
  );
  return result.rows[0] || null;
}

/**
 * Create a user without a password (for coach-created accounts).
 * The user gets a verification token that serves as their "setup account" link.
 */
async function createWithoutPassword({ email, firstName, lastName, dateOfBirth, phone }) {
  const crypto = require('crypto');
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const result = await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, date_of_birth, phone,
                        verification_token, verification_token_expires, email_verified)
     VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, FALSE)
     RETURNING id, email, first_name, last_name, date_of_birth, phone, email_verified,
               verification_token, created_at`,
    [
      email.toLowerCase(),
      firstName,
      lastName,
      dateOfBirth || null,
      phone || null,
      verificationToken,
      verificationTokenExpires,
    ]
  );
  return result.rows[0];
}

/**
 * Setup account: set password + verify email in one step.
 * Used by the /api/auth/setup-account endpoint for coach-created passwordless accounts.
 */
async function setupAccount(token, passwordHash) {
  const result = await pool.query(
    `UPDATE users
     SET password_hash = $1,
         email_verified = TRUE,
         verification_token = NULL,
         verification_token_expires = NULL,
         updated_at = NOW()
     WHERE verification_token = $2
       AND verification_token_expires > NOW()
     RETURNING id, email, first_name, last_name, email_verified`,
    [passwordHash, token]
  );
  return result.rows[0] || null;
}

async function getSettings(userId) {
  const result = await pool.query(
    'SELECT settings FROM users WHERE id = $1',
    [userId]
  );
  return result.rows[0]?.settings || {};
}

async function updateSettings(userId, settings) {
  const result = await pool.query(
    `UPDATE users
     SET settings = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, settings`,
    [JSON.stringify(settings), userId]
  );
  return result.rows[0] || null;
}

module.exports = {
  findByEmail,
  findById,
  create,
  createVerified,
  createWithoutPassword,
  verifyEmail,
  setResetToken,
  resetPassword,
  setupAccount,
  updateProfile,
  getSettings,
  updateSettings,
};
