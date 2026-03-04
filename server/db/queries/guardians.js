const crypto = require('crypto');
const pool = require('../pool');

/**
 * Link a guardian to a minor in the minor_guardians table.
 */
async function linkGuardian(minorUserId, guardianUserId, relationship) {
  const result = await pool.query(
    `INSERT INTO minor_guardians (minor_user_id, guardian_user_id, relationship)
     VALUES ($1, $2, $3)
     ON CONFLICT (minor_user_id, guardian_user_id) DO UPDATE SET relationship = $3
     RETURNING *`,
    [minorUserId, guardianUserId, relationship]
  );
  return result.rows[0];
}

/**
 * Get all guardians for a minor (with user details).
 */
async function getGuardiansForMinor(minorUserId) {
  const result = await pool.query(
    `SELECT mg.*, u.email, u.first_name, u.last_name, u.phone
     FROM minor_guardians mg
     JOIN users u ON u.id = mg.guardian_user_id
     WHERE mg.minor_user_id = $1
     ORDER BY mg.created_at`,
    [minorUserId]
  );
  return result.rows;
}

/**
 * Get all minors linked to a guardian (with user details).
 */
async function getMinorsForGuardian(guardianUserId) {
  const result = await pool.query(
    `SELECT mg.*, u.email, u.first_name, u.last_name, u.phone, u.date_of_birth
     FROM minor_guardians mg
     JOIN users u ON u.id = mg.minor_user_id
     WHERE mg.guardian_user_id = $1
     ORDER BY u.last_name, u.first_name`,
    [guardianUserId]
  );
  return result.rows;
}

/**
 * Create a guardian confirmation request (sends token via email).
 * Token expires in 72 hours.
 */
async function createConfirmation(minorUserId, guardianEmail, relationship) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

  const result = await pool.query(
    `INSERT INTO guardian_confirmations (minor_user_id, guardian_email, token, relationship, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [minorUserId, guardianEmail.toLowerCase(), token, relationship, expiresAt]
  );
  return result.rows[0];
}

/**
 * Find a pending, non-expired confirmation by token.
 */
async function findConfirmationByToken(token) {
  const result = await pool.query(
    `SELECT gc.*, u.first_name AS minor_first_name, u.last_name AS minor_last_name,
            u.email AS minor_email, u.date_of_birth AS minor_dob
     FROM guardian_confirmations gc
     JOIN users u ON u.id = gc.minor_user_id
     WHERE gc.token = $1
       AND gc.status = 'pending'
       AND gc.expires_at > NOW()`,
    [token]
  );
  return result.rows[0] || null;
}

/**
 * Confirm guardianship — updates confirmation + creates minor_guardians link in a transaction.
 * Also activates any pending_guardian registrations for the minor.
 */
async function confirmGuardian(token, guardianUserId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update confirmation status
    const confirmResult = await client.query(
      `UPDATE guardian_confirmations
       SET status = 'confirmed', guardian_user_id = $1, confirmed_at = NOW()
       WHERE token = $2 AND status = 'pending' AND expires_at > NOW()
       RETURNING *`,
      [guardianUserId, token]
    );

    if (confirmResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const confirmation = confirmResult.rows[0];

    // Create minor_guardians link
    await client.query(
      `INSERT INTO minor_guardians (minor_user_id, guardian_user_id, relationship)
       VALUES ($1, $2, $3)
       ON CONFLICT (minor_user_id, guardian_user_id) DO UPDATE SET relationship = $3`,
      [confirmation.minor_user_id, guardianUserId, confirmation.relationship]
    );

    // Activate any pending_guardian registrations for this minor
    await client.query(
      `UPDATE registrations
       SET status = 'active', updated_at = NOW()
       WHERE user_id = $1 AND status = 'pending_guardian'`,
      [confirmation.minor_user_id]
    );

    await client.query('COMMIT');
    return confirmation;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get pending confirmations for a minor (for resend functionality).
 */
async function getPendingConfirmationsForMinor(minorUserId) {
  const result = await pool.query(
    `SELECT * FROM guardian_confirmations
     WHERE minor_user_id = $1 AND status = 'pending' AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [minorUserId]
  );
  return result.rows;
}

module.exports = {
  linkGuardian,
  getGuardiansForMinor,
  getMinorsForGuardian,
  createConfirmation,
  findConfirmationByToken,
  confirmGuardian,
  getPendingConfirmationsForMinor,
};
