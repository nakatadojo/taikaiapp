const express = require('express');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const athleteProfileController = require('../controllers/athleteProfileController');

const router = express.Router();

// My profile (authenticated)
router.get('/me', requireAuth, athleteProfileController.getMyProfile);
router.put('/me', requireAuth, athleteProfileController.updateMyProfile);
router.get('/me/history', requireAuth, athleteProfileController.getProfileHistory);

// Public profile by ID
router.get('/:profileId', optionalAuth, athleteProfileController.getPublicProfile);

module.exports = router;
