const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const creditsController = require('../controllers/creditsController');

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// GET /api/credits/packages — Available credit packages (any authenticated user)
router.get('/packages', creditsController.getPackages);

// GET /api/credits/balance — Get credit balance
router.get('/balance', creditsController.getBalance);

// GET /api/credits/transactions — Get transaction history
router.get('/transactions', creditsController.getTransactions);

// POST /api/credits/checkout — Purchase credits via Stripe
router.post('/checkout',
  requireRole('event_director', 'super_admin'),
  [body('packageId').notEmpty().withMessage('Package ID is required')],
  validate,
  creditsController.checkout
);

// POST /api/credits/confirm — Confirm credit purchase
router.post('/confirm',
  requireRole('event_director', 'super_admin'),
  [body('sessionId').notEmpty().withMessage('Session ID is required')],
  validate,
  creditsController.confirm
);

module.exports = router;
