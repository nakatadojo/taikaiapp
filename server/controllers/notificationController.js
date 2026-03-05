const notificationQueries = require('../db/queries/notifications');

/**
 * GET /api/notifications
 * Get all notifications for the current user.
 */
async function getNotifications(req, res, next) {
  try {
    const notifications = await notificationQueries.getForUser(req.user.id);
    const unreadCount = await notificationQueries.getUnreadCount(req.user.id);
    res.json({ notifications, unreadCount });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/notifications/unread-count
 * Get unread notification count for the current user.
 */
async function getUnreadCount(req, res, next) {
  try {
    const count = await notificationQueries.getUnreadCount(req.user.id);
    res.json({ unreadCount: count });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read.
 */
async function markRead(req, res, next) {
  try {
    await notificationQueries.markRead(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read for the current user.
 */
async function markAllRead(req, res, next) {
  try {
    await notificationQueries.markAllRead(req.user.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { getNotifications, getUnreadCount, markRead, markAllRead };
