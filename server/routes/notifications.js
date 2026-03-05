const express = require('express');
const { requireAuth } = require('../middleware/auth');
const controller = require('../controllers/notificationController');

const router = express.Router();

// GET /api/notifications — Get all notifications for current user
router.get('/', requireAuth, controller.getNotifications);

// GET /api/notifications/unread-count — Get unread count only
router.get('/unread-count', requireAuth, controller.getUnreadCount);

// PATCH /api/notifications/read-all — Mark all as read (must be before /:id routes)
router.patch('/read-all', requireAuth, controller.markAllRead);

// PATCH /api/notifications/:id/read — Mark single notification as read
router.patch('/:id/read', requireAuth, controller.markRead);

module.exports = router;
