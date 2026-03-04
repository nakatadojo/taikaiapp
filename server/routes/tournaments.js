const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const tournamentController = require('../controllers/tournamentController');

const router = express.Router();

// ── Public Endpoints (no auth required) ──────────────────────────────────────

// GET /api/tournaments — List all tournaments
router.get('/', tournamentController.getTournaments);

// GET /api/tournaments/:id — Get single tournament with events
router.get('/:id', tournamentController.getTournament);

// GET /api/tournaments/:id/events/eligible/:profileId — Eligible events for a profile
router.get('/:id/events/eligible/:profileId',
  requireAuth,
  tournamentController.getEligibleEvents
);

// ── Admin Endpoints ──────────────────────────────────────────────────────────

// POST /api/tournaments (admin only) — Create tournament
router.post('/',
  requireAuth,
  requireRole('admin'),
  [
    body('name').trim().notEmpty().withMessage('Tournament name is required'),
    body('date').optional().isISO8601(),
    body('location').optional().trim(),
    body('registrationOpen').optional().isBoolean(),
    body('baseEventPrice').optional().isFloat({ min: 0 }),
    body('addonEventPrice').optional().isFloat({ min: 0 }),
  ],
  validate,
  tournamentController.createTournament
);

// PUT /api/tournaments/:id (admin only) — Update tournament
router.put('/:id',
  requireAuth,
  requireRole('admin'),
  [
    body('name').optional().trim().notEmpty(),
    body('date').optional().isISO8601(),
    body('location').optional().trim(),
    body('registrationOpen').optional().isBoolean(),
    body('baseEventPrice').optional().isFloat({ min: 0 }),
    body('addonEventPrice').optional().isFloat({ min: 0 }),
  ],
  validate,
  tournamentController.updateTournament
);

// POST /api/tournaments/:id/events (admin only) — Create event
router.post('/:id/events',
  requireAuth,
  requireRole('admin'),
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

// PUT /api/tournaments/:id/events/:eventId (admin only) — Update event
router.put('/:id/events/:eventId',
  requireAuth,
  requireRole('admin'),
  tournamentController.updateEvent
);

// DELETE /api/tournaments/:id/events/:eventId (admin only) — Delete event
router.delete('/:id/events/:eventId',
  requireAuth,
  requireRole('admin'),
  tournamentController.deleteEvent
);

// POST /api/tournaments/:id/sync (admin only) — Bulk sync events
router.post('/:id/sync',
  requireAuth,
  requireRole('admin'),
  [
    body('events').isArray().withMessage('Events must be an array'),
  ],
  validate,
  tournamentController.syncEvents
);

module.exports = router;
