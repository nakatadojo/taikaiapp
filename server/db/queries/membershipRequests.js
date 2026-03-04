const pool = require('../pool');

/**
 * Create a membership request for an academy.
 */
async function createRequest(academyId, userId) {
  const result = await pool.query(
    `INSERT INTO academy_membership_requests (academy_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (academy_id, user_id) DO UPDATE SET status = 'pending', requested_at = NOW(), reviewed_at = NULL, reviewed_by = NULL
     RETURNING *`,
    [academyId, userId]
  );
  return result.rows[0];
}

/**
 * Get all pending membership requests for an academy (with user details).
 */
async function getPendingForAcademy(academyId) {
  const result = await pool.query(
    `SELECT amr.*, u.email, u.first_name, u.last_name, u.phone, u.date_of_birth, u.profile_photo_url
     FROM academy_membership_requests amr
     JOIN users u ON u.id = amr.user_id
     WHERE amr.academy_id = $1 AND amr.status = 'pending'
     ORDER BY amr.requested_at ASC`,
    [academyId]
  );
  return result.rows;
}

/**
 * Approve a membership request — updates status + adds user to academy_members in a transaction.
 */
async function approveRequest(requestId, reviewedBy) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update request status
    const reqResult = await client.query(
      `UPDATE academy_membership_requests
       SET status = 'approved', reviewed_at = NOW(), reviewed_by = $1
       WHERE id = $2 AND status = 'pending'
       RETURNING *`,
      [reviewedBy, requestId]
    );

    if (reqResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const request = reqResult.rows[0];

    // Add user to academy as competitor
    await client.query(
      `INSERT INTO academy_members (academy_id, user_id, role, added_by)
       VALUES ($1, $2, 'competitor', $3)
       ON CONFLICT (academy_id, user_id) DO NOTHING`,
      [request.academy_id, request.user_id, reviewedBy]
    );

    await client.query('COMMIT');
    return request;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Deny a membership request.
 */
async function denyRequest(requestId, reviewedBy) {
  const result = await pool.query(
    `UPDATE academy_membership_requests
     SET status = 'denied', reviewed_at = NOW(), reviewed_by = $1
     WHERE id = $2 AND status = 'pending'
     RETURNING *`,
    [reviewedBy, requestId]
  );
  return result.rows[0] || null;
}

/**
 * Find a request by ID.
 */
async function findById(requestId) {
  const result = await pool.query(
    'SELECT * FROM academy_membership_requests WHERE id = $1',
    [requestId]
  );
  return result.rows[0] || null;
}

module.exports = {
  createRequest,
  getPendingForAcademy,
  approveRequest,
  denyRequest,
  findById,
};
