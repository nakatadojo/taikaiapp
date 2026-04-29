const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { optionalAuth } = require('../middleware/auth');
const registrationController = require('../controllers/registrationController');
const discountController = require('../controllers/discountController');
const certificateController = require('../controllers/certificateController');

const router = express.Router();

// ── New Cart-Based Registration Endpoints ────────────────────────────────────

// POST /api/registrations/checkout — Validate cart + create Stripe session
router.post('/checkout', requireAuth, registrationController.checkout);

// POST /api/registrations/confirm — Confirm payment + create registrations
router.post('/confirm', requireAuth, registrationController.confirmPayment);

// POST /api/registrations/pay-later — Register without upfront payment (outstanding balance)
router.post('/pay-later', requireAuth, registrationController.payLater);

// GET /api/registrations/my — Get logged-in user's registrations
router.get('/my', requireAuth, registrationController.getMyRegistrations);

// GET /api/registrations/my/:id — Get a single registration (for badge page)
router.get('/my/:id', requireAuth, registrationController.getMyRegistration);

// GET /api/registrations/my/:id/qr — Return QR code PNG for competitor check-in
router.get('/my/:id/qr', requireAuth, registrationController.getMyRegistrationQR);

// GET /api/registrations/my/:registrationId/certificate — Competitor self-service certificate download
router.get('/my/:registrationId/certificate', requireAuth, certificateController.downloadMyCertificate);

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

// Admin sync endpoint (full list — kept for backward compatibility)
router.get('/', requireAuth, registrationController.getRegistrations);

// Paginated competitor list — for large tournaments (300+ competitors)
// GET /api/registrations/paginated?tournamentId=&cursor=&limit=100&search=&status=
router.get('/paginated', requireAuth, registrationController.getPaginatedRegistrations);

// Force-activate a pending registration (guardian/owner override)
router.put('/:id/activate', requireAuth, registrationController.activateRegistration);

module.exports = router;
