const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { optionalAuth } = require('../middleware/auth');
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

// GET /api/registrations/my/:id — Get a single registration (for badge page)
router.get('/my/:id', requireAuth, registrationController.getMyRegistration);

// GET /api/registrations/my/:id/qr — Return QR code PNG for competitor check-in
router.get('/my/:id/qr', requireAuth, registrationController.getMyRegistrationQR);

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
router.get('/', requireAuth, registrationController.getRegistrations);

// Force-activate a pending registration (guardian/owner override)
router.put('/:id/activate', requireAuth, registrationController.activateRegistration);

module.exports = router;
