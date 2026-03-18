const express = require('express');
const { body, query } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const academyController = require('../controllers/academyController');
const upload = require('../middleware/upload');
const { validateImageBytes } = require('../middleware/upload');
const { csvImportMembers, uploadCsv } = require('../controllers/academyCsvController');

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

// POST /api/academies — Create academy (any authenticated user)
router.post('/',
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

// PUT /api/academies/:id — Update academy (ownership verified in controller)
router.put('/:id',
  academyController.updateAcademy
);

// POST /api/academies/:id/logo — Upload academy logo (ownership verified in controller)
router.post('/:id/logo',
  upload.single('logo'),
  validateImageBytes,
  academyController.uploadLogo
);

// GET /api/academies/:id/members — List members
router.get('/:id/members',
  academyController.getMembers
);

// POST /api/academies/:id/members — Add member (ownership verified in controller)
router.post('/:id/members',
  [
    body('email').optional().isEmail().withMessage('Valid email required'),
    body('role').optional().isIn(['head_coach', 'assistant_coach', 'competitor']).withMessage('Invalid role'),
  ],
  validate,
  academyController.addMember
);

// DELETE /api/academies/:id/members/:userId — Remove member (ownership verified in controller)
router.delete('/:id/members/:userId',
  academyController.removeMember
);

// POST /api/academies/:id/register-competitor — Register competitor member (ownership verified in controller)
router.post('/:id/register-competitor',
  [
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('dateOfBirth').optional().isISO8601().withMessage('Date of birth must be a valid date'),
  ],
  validate,
  academyController.registerCompetitorMember
);

// POST /api/academies/:id/register-assistant — Register assistant coach (ownership verified in controller)
router.post('/:id/register-assistant',
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

// GET /api/academies/:id/membership-requests — Get pending requests (ownership verified in controller)
router.get('/:id/membership-requests',
  academyController.getMembershipRequests
);

// PUT /api/academies/:id/membership-requests/:requestId — Review request (ownership verified in controller)
router.put('/:id/membership-requests/:requestId',
  [
    body('action').isIn(['approve', 'deny']).withMessage('Action must be "approve" or "deny"'),
  ],
  validate,
  academyController.reviewMembershipRequest
);

// POST /api/academies/:id/bulk-register — Bulk register for events (ownership verified in controller)
router.post('/:id/bulk-register',
  [
    body('tournamentId').isUUID().withMessage('Valid tournament ID is required'),
    body('registrations').isArray({ min: 1 }).withMessage('At least one registration is required'),
  ],
  validate,
  academyController.bulkRegisterForEvents
);

// POST /api/academies/:id/transfer — Transfer dojo ownership (ownership verified in controller)
router.post('/:id/transfer',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  ],
  validate,
  academyController.transferOwnership
);

// PUT /api/academies/:id/members/:userId/rank — Update member rank (ownership verified in controller)
router.put('/:id/members/:userId/rank',
  academyController.updateMemberRank
);

// POST /api/academies/:id/members/csv-import — Bulk import from CSV (ownership verified in controller)
router.post('/:id/members/csv-import',
  requireAuth,
  uploadCsv,
  csvImportMembers
);

module.exports = router;
