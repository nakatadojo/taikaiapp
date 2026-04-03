const express = require('express');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const pushController = require('../controllers/pushController');

const router = express.Router();

// Public: browser needs this to call PushManager.subscribe()
router.get('/vapid-public-key', pushController.getVapidKey);

// Authenticated (optional auth — allow anonymous devices to subscribe)
router.post('/subscribe', optionalAuth, pushController.subscribePush);
router.post('/unsubscribe', optionalAuth, pushController.unsubscribePush);

module.exports = router;
