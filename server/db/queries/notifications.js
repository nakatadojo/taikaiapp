const pool = require('../pool');

/**
 * Create a notification.
 */
async function create({ recipientId, tournamentId, type, payload }) {
  const result = await pool.query(
    `INSERT INTO notifications (recipient_id, tournament_id, type, payload)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [recipientId, tournamentId || null, type, JSON.stringify(payload || {})]
  );
  return result.rows[0];
}

/**
 * Get notifications for a user.
 */
async function getForUser(userId, { unreadOnly = false, limit = 20 } = {}) {
  const where = unreadOnly
    ? 'WHERE n.recipient_id = $1 AND n.read = false'
    : 'WHERE n.recipient_id = $1';
  const result = await pool.query(
    `SELECT n.*, t.name AS tournament_name
     FROM notifications n
     LEFT JOIN tournaments t ON t.id = n.tournament_id
     ${where}
     ORDER BY n.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

/**
 * Get unread notification count for a user.
 */
async function getUnreadCount(userId) {
  const result = await pool.query(
    'SELECT COUNT(*)::int AS count FROM notifications WHERE recipient_id = $1 AND read = false',
    [userId]
  );
  return result.rows[0].count;
}

/**
 * Mark a single notification as read.
 */
async function markRead(id) {
  const result = await pool.query(
    'UPDATE notifications SET read = true WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Mark all notifications as read for a user.
 */
async function markAllRead(userId) {
  await pool.query(
    'UPDATE notifications SET read = true WHERE recipient_id = $1 AND read = false',
    [userId]
  );
}

module.exports = { create, getForUser, getUnreadCount, markRead, markAllRead };
