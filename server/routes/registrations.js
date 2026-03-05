const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { optionalAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const registrationController = require('../controllers/registrationController');
const discountController = require('../controllers/discountController');

const router = express.Router();

// ── New Cart-Based Registration Endpoints ────────────────────────────────────

// POST /api/registrations/checkout — Validate cart + create Stripe session
router.post('/checkout', requireAuth, registrationController.checkout);

// POST /api/registrations/confirm — Confirm payment + create registrations
router.post('/confirm', requireAuth, registrationController.confirmPayment);

// GET /api/registrations/my — Get logged-in user's registrations
router.get('/my', requireAuth, registrationController.getMyRegistrations);

// POST /api/registrations/validate-discount — Validate a discount code
router.post('/validate-discount',
  requireAuth,
  [
    body('code').trim().notEmpty().withMessage('Discount code is required'),
    body('tournamentId').optional().isUUID(),
  ],
  validate,
  discountController.validateDiscount
);

// ── Legacy Public Registration Endpoints ─────────────────────────────────────

// Public registration endpoints (optional auth — links user if logged in)
router.post('/competitor', optionalAuth, registrationController.registerCompetitor);
router.post('/instructor', optionalAuth, registrationController.registerInstructor);
router.post('/club', optionalAuth, registrationController.registerClub);

// Admin sync endpoint
router.get('/', requireAuth, requireRole('admin', 'coach', 'judge', 'event_director'), registrationController.getRegistrations);

// Force-activate a pending registration (coach/admin override)
router.put('/:id/activate', requireAuth, requireRole('coach', 'admin'), registrationController.activateRegistration);

module.exports = router;
