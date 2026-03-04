const express = require('express');
const { body, query } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const academyController = require('../controllers/academyController');
const upload = require('../middleware/upload');

const router = express.Router();

// Rate limiter for public search endpoint
const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many search requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Public routes (no auth) ─────────────────────────────────────────────────

// GET /api/academies/search?q=... — Public autocomplete (rate-limited)
router.get('/search',
  searchLimiter,
  [
    query('q').trim().isLength({ min: 2 }).withMessage('Search query must be at least 2 characters'),
  ],
  validate,
  academyController.searchAcademies
);

// ── Authenticated routes ────────────────────────────────────────────────────

// All routes below require authentication
router.use(requireAuth);

// POST /api/academies — Create academy (coach only)
router.post('/',
  requireRole('coach', 'admin'),
  [
    body('name').trim().notEmpty().withMessage('Academy name is required'),
  ],
  validate,
  academyController.createAcademy
);

// GET /api/academies/my — Get my academy
router.get('/my',
  academyController.getMyAcademy
);

// PUT /api/academies/:id — Update academy
router.put('/:id',
  requireRole('coach', 'admin'),
  academyController.updateAcademy
);

// POST /api/academies/:id/logo — Upload academy logo (coach only)
router.post('/:id/logo',
  requireRole('coach', 'admin'),
  upload.single('logo'),
  academyController.uploadLogo
);

// GET /api/academies/:id/members — List members
router.get('/:id/members',
  academyController.getMembers
);

// POST /api/academies/:id/members — Add member (coach only)
router.post('/:id/members',
  requireRole('coach', 'admin'),
  [
    body('email').optional().isEmail().withMessage('Valid email required'),
    body('role').optional().isIn(['head_coach', 'assistant_coach', 'competitor']).withMessage('Invalid role'),
  ],
  validate,
  academyController.addMember
);

// DELETE /api/academies/:id/members/:userId — Remove member (coach only)
router.delete('/:id/members/:userId',
  requireRole('coach', 'admin'),
  academyController.removeMember
);

// POST /api/academies/:id/register-competitor — Register competitor member (coach only)
router.post('/:id/register-competitor',
  requireRole('coach', 'admin'),
  [
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('dateOfBirth').optional().isISO8601().withMessage('Date of birth must be a valid date'),
  ],
  validate,
  academyController.registerCompetitorMember
);

// POST /api/academies/:id/register-assistant — Register assistant coach (coach only)
router.post('/:id/register-assistant',
  requireRole('coach', 'admin'),
  [
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  ],
  validate,
  academyController.registerAssistantCoach
);

// GET /api/academies/:id/registrations — Get academy registrations
router.get('/:id/registrations',
  academyController.getAcademyRegistrations
);

// GET /api/academies/:id/membership-requests — Get pending requests (coach only)
router.get('/:id/membership-requests',
  requireRole('coach', 'admin'),
  academyController.getMembershipRequests
);

// PUT /api/academies/:id/membership-requests/:requestId — Review request (coach only)
router.put('/:id/membership-requests/:requestId',
  requireRole('coach', 'admin'),
  [
    body('action').isIn(['approve', 'deny']).withMessage('Action must be "approve" or "deny"'),
  ],
  validate,
  academyController.reviewMembershipRequest
);

// POST /api/academies/:id/bulk-register — Bulk register for events (coach only)
router.post('/:id/bulk-register',
  requireRole('coach', 'admin'),
  [
    body('tournamentId').isUUID().withMessage('Valid tournament ID is required'),
    body('registrations').isArray({ min: 1 }).withMessage('At least one registration is required'),
  ],
  validate,
  academyController.bulkRegisterForEvents
);

module.exports = router;
