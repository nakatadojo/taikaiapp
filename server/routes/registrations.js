const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { optionalAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const registrationController = require('../controllers/registrationController');

const router = express.Router();

// Public registration endpoints (optional auth — links user if logged in)
router.post('/competitor', optionalAuth, registrationController.registerCompetitor);
router.post('/instructor', optionalAuth, registrationController.registerInstructor);
router.post('/club', optionalAuth, registrationController.registerClub);

// Admin sync endpoint
router.get('/', requireAuth, requireRole('admin', 'coach', 'judge'), registrationController.getRegistrations);

// Force-activate a pending registration (coach/admin override)
router.put('/:id/activate', requireAuth, requireRole('coach', 'admin'), registrationController.activateRegistration);

module.exports = router;
