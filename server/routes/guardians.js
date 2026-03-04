const express = require('express');
const { body, query } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const guardianController = require('../controllers/guardianController');

const router = express.Router();

// GET /api/guardians/confirm?token=X — public confirmation link (optionalAuth for auto-confirm)
router.get('/confirm',
  optionalAuth,
  [
    query('token').notEmpty().withMessage('Confirmation token is required'),
  ],
  validate,
  guardianController.confirmGuardianship
);

// POST /api/guardians/confirm — explicit confirmation after auth
router.post('/confirm',
  requireAuth,
  [
    body('token').notEmpty().withMessage('Confirmation token is required'),
  ],
  validate,
  guardianController.confirmGuardianshipPost
);

// GET /api/guardians/minors — list minors linked to logged-in guardian
router.get('/minors',
  requireAuth,
  guardianController.getMyMinors
);

// POST /api/guardians/add-parent — coach adds parent/legal guardian for a minor
router.post('/add-parent',
  requireAuth,
  requireRole('coach', 'admin'),
  [
    body('minorUserId').isUUID().withMessage('Valid minor user ID is required'),
    body('guardianEmail').isEmail().normalizeEmail().withMessage('Valid guardian email is required'),
    body('relationship').optional().isIn(['parent', 'legal_guardian']).withMessage('Invalid relationship'),
  ],
  validate,
  guardianController.addParentGuardian
);

module.exports = router;
