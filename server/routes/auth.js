const express = require('express');
const { body, query } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const authController = require('../controllers/authController');

const router = express.Router();

// ── Rate Limiters ───────────────────────────────────────────────────────────

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Validation Rules ────────────────────────────────────────────────────────

const passwordRules = body('password')
  .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
  .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
  .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
  .matches(/\d/).withMessage('Password must contain at least one digit');

// ── Routes ──────────────────────────────────────────────────────────────────

// POST /api/auth/signup
router.post('/signup',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    passwordRules,
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('roles').optional().isArray().withMessage('Roles must be an array'),
  ],
  validate,
  authController.signup
);

// POST /api/auth/login
router.post('/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  authController.login
);

// GET /api/auth/verify-email?token=...
router.get('/verify-email',
  [
    query('token').notEmpty().withMessage('Verification token is required'),
  ],
  validate,
  authController.verifyEmail
);

// POST /api/auth/forgot-password
router.post('/forgot-password',
  strictLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  ],
  validate,
  authController.forgotPassword
);

// POST /api/auth/reset-password
router.post('/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    passwordRules,
  ],
  validate,
  authController.resetPassword
);

// GET /api/auth/me (requires authentication)
router.get('/me',
  requireAuth,
  authController.getMe
);

// PUT /api/auth/me (requires authentication)
router.put('/me',
  requireAuth,
  [
    body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
    body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
    body('phone').optional(),
    body('dateOfBirth').optional().isISO8601().withMessage('Date of birth must be a valid date'),
  ],
  validate,
  authController.updateMe
);

// GET /api/auth/settings (requires authentication)
router.get('/settings',
  requireAuth,
  authController.getSettings
);

// PUT /api/auth/settings (requires authentication)
// Validation handled in controller for complex nested objects
router.put('/settings',
  requireAuth,
  authController.updateSettings
);

// POST /api/auth/setup-account (for coach-created passwordless accounts)
router.post('/setup-account',
  authLimiter,
  [
    body('token').notEmpty().withMessage('Setup token is required'),
    passwordRules,
  ],
  validate,
  authController.setupAccount
);

// POST /api/auth/resend-verification
router.post('/resend-verification',
  strictLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  ],
  validate,
  authController.resendVerification
);

// POST /api/auth/logout
router.post('/logout',
  authController.logout
);

module.exports = router;
