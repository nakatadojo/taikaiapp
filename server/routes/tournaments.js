const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const upload = require('../middleware/upload');
const tournamentController = require('../controllers/tournamentController');

const router = express.Router();

// ── Public Endpoints (no auth required) ──────────────────────────────────────

// GET /api/tournaments/directory — Published tournaments for public directory
router.get('/directory', tournamentController.getDirectory);

// GET /api/tournaments/slug/:slug — Get tournament by slug (public page)
router.get('/slug/:slug', tournamentController.getTournamentBySlug);

// GET /api/tournaments — List all tournaments (legacy)
router.get('/', tournamentController.getTournaments);

// ── Director Endpoints (MUST be before /:id param routes) ───────────────────

// GET /api/tournaments/director/mine — My tournaments
router.get('/director/mine',
  requireAuth,
  requireRole('event_director', 'admin', 'super_admin'),
  tournamentController.getMyTournaments
);

// GET /api/tournaments/:id — Get single tournament with events
router.get('/:id', tournamentController.getTournament);

// GET /api/tournaments/:id/events/eligible/:profileId — Eligible events for a profile
router.get('/:id/events/eligible/:profileId',
  requireAuth,
  tournamentController.getEligibleEvents
);

// POST /api/tournaments — Create tournament
router.post('/',
  requireAuth,
  requireRole('event_director', 'admin', 'super_admin'),
  [
    body('name').trim().notEmpty().withMessage('Tournament name is required'),
    body('date').optional().isISO8601(),
    body('location').optional().trim(),
    body('registrationOpen').optional().isBoolean(),
    body('baseEventPrice').optional().isFloat({ min: 0 }),
    body('addonEventPrice').optional().isFloat({ min: 0 }),
    body('slug').optional().trim(),
    body('description').optional().trim(),
    body('city').optional().trim(),
    body('state').optional().trim(),
    body('venueName').optional().trim(),
    body('venueAddress').optional().trim(),
    body('published').optional().isBoolean(),
    body('organizationName').optional().trim(),
    body('contactEmail').optional().isEmail(),
    body('registrationDeadline').optional().isISO8601(),
    body('sanctioningBody').optional().isIn(['aau', 'wkf', 'simple', 'custom']),
  ],
  validate,
  tournamentController.createTournament
);

// PUT /api/tournaments/:id — Update tournament (must own or super_admin)
router.put('/:id',
  requireAuth,
  requireRole('event_director', 'admin', 'super_admin'),
  [
    body('name').optional().trim().notEmpty(),
    body('date').optional().isISO8601(),
    body('location').optional().trim(),
    body('registrationOpen').optional().isBoolean(),
    body('baseEventPrice').optional().isFloat({ min: 0 }),
    body('addonEventPrice').optional().isFloat({ min: 0 }),
    body('slug').optional().trim(),
    body('description').optional().trim(),
    body('city').optional().trim(),
    body('state').optional().trim(),
    body('venueName').optional().trim(),
    body('venueAddress').optional().trim(),
    body('published').optional().isBoolean(),
    body('organizationName').optional().trim(),
    body('contactEmail').optional().isEmail(),
    body('registrationDeadline').optional().isISO8601(),
    body('sanctioningBody').optional().isIn(['aau', 'wkf', 'simple', 'custom']),
  ],
  validate,
  tournamentController.updateTournament
);

// GET /api/tournaments/:id/registrations — Director view of registrants
router.get('/:id/registrations',
  requireAuth,
  requireRole('event_director', 'admin', 'super_admin'),
  tournamentController.getRegistrants
);

// PUT /api/tournaments/:id/publish — Publish/unpublish tournament
router.put('/:id/publish',
  requireAuth,
  requireRole('event_director', 'admin', 'super_admin'),
  tournamentController.publishTournament
);

// POST /api/tournaments/:id/cover-image — Upload cover image
router.post('/:id/cover-image',
  requireAuth,
  requireRole('event_director', 'admin', 'super_admin'),
  upload.single('coverImage'),
  tournamentController.uploadCoverImage
);

// POST /api/tournaments/:id/events — Create event
router.post('/:id/events',
  requireAuth,
  requireRole('event_director', 'admin', 'super_admin'),
  [
    body('name').trim().notEmpty().withMessage('Event name is required'),
    body('eventType').optional().trim(),
    body('division').optional().trim(),
    body('gender').optional().isIn(['male', 'female', 'mixed']),
    body('ageMin').optional().isInt({ min: 0 }),
    body('ageMax').optional().isInt({ min: 0 }),
    body('rankMin').optional().trim(),
    body('rankMax').optional().trim(),
    body('priceOverride').optional().isFloat({ min: 0 }),
    body('addonPriceOverride').optional().isFloat({ min: 0 }),
    body('maxCompetitors').optional().isInt({ min: 1 }),
  ],
  validate,
  tournamentController.createEvent
);

// PUT /api/tournaments/:id/events/:eventId — Update event
router.put('/:id/events/:eventId',
  requireAuth,
  requireRole('event_director', 'admin', 'super_admin'),
  tournamentController.updateEvent
);

// DELETE /api/tournaments/:id/events/:eventId — Delete event
router.delete('/:id/events/:eventId',
  requireAuth,
  requireRole('event_director', 'admin', 'super_admin'),
  tournamentController.deleteEvent
);

// POST /api/tournaments/:id/sync — Bulk sync events
router.post('/:id/sync',
  requireAuth,
  requireRole('event_director', 'admin', 'super_admin'),
  [body('events').isArray().withMessage('Events must be an array')],
  validate,
  tournamentController.syncEvents
);

module.exports = router;
