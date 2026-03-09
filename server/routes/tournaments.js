const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { requireTournamentOwner } = require('../middleware/tournamentOwner');
const upload = require('../middleware/upload');
const tournamentController = require('../controllers/tournamentController');

const router = express.Router();

// ── Public Endpoints (no auth required) ──────────────────────────────────────

// GET /api/tournaments/directory — Published tournaments for public directory
router.get('/directory', tournamentController.getDirectory);

// GET /api/tournaments/slug/:slug — Get tournament by slug (public page)
router.get('/slug/:slug', tournamentController.getTournamentBySlug);

// GET /api/tournaments/:id/registration-settings — Public registration requirements
router.get('/:id/registration-settings',
  require('../controllers/documentController').getRegistrationSettings
);

// GET /api/tournaments — List all tournaments (legacy)
router.get('/', tournamentController.getTournaments);

// ── Director Endpoints (MUST be before /:id param routes) ───────────────────

// GET /api/tournaments/director/mine — My tournaments
router.get('/director/mine',
  requireAuth,
  tournamentController.getMyTournaments
);

// GET /api/tournaments/director/stats — Dashboard analytics for director
router.get('/director/stats',
  requireAuth,
  tournamentController.getDirectorStats
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

// PUT /api/tournaments/:id — Update tournament (must own)
router.put('/:id',
  requireAuth,
  requireTournamentOwner,
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
  requireTournamentOwner,
  tournamentController.getRegistrants
);

// PUT /api/tournaments/:id/publish — Publish/unpublish tournament
router.put('/:id/publish',
  requireAuth,
  requireTournamentOwner,
  tournamentController.publishTournament
);

// POST /api/tournaments/:id/clone — Clone a tournament
router.post('/:id/clone',
  requireAuth,
  requireTournamentOwner,
  tournamentController.cloneTournament
);

// POST /api/tournaments/:id/cover-image — Upload cover image
router.post('/:id/cover-image',
  requireAuth,
  requireTournamentOwner,
  upload.single('coverImage'),
  tournamentController.uploadCoverImage
);

// POST /api/tournaments/:id/events — Create event
router.post('/:id/events',
  requireAuth,
  requireTournamentOwner,
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
  requireTournamentOwner,
  tournamentController.updateEvent
);

// DELETE /api/tournaments/:id — Delete tournament
router.delete('/:id',
  requireAuth,
  requireTournamentOwner,
  tournamentController.deleteTournament
);

// DELETE /api/tournaments/:id/events/:eventId — Delete event
router.delete('/:id/events/:eventId',
  requireAuth,
  requireTournamentOwner,
  tournamentController.deleteEvent
);

// POST /api/tournaments/:id/sync — Bulk sync events
router.post('/:id/sync',
  requireAuth,
  requireTournamentOwner,
  [body('events').isArray().withMessage('Events must be an array')],
  validate,
  tournamentController.syncEvents
);

// ── Director Competitors / Clubs (JSONB sync) ────────────────────────────────

// GET /api/tournaments/:id/competitors
router.get('/:id/competitors', requireAuth, requireTournamentOwner, tournamentController.getCompetitors);

// POST /api/tournaments/:id/competitors/sync
router.post('/:id/competitors/sync', requireAuth, requireTournamentOwner, tournamentController.syncCompetitors);

// POST /api/tournaments/:id/competitors/:competitorId/checkin — check in a director-added competitor
router.post('/:id/competitors/:competitorId/checkin', requireAuth, requireTournamentOwner, tournamentController.checkInDirectorCompetitor);

// DELETE /api/tournaments/:id/competitors/:competitorId/checkin — undo check-in
router.delete('/:id/competitors/:competitorId/checkin', requireAuth, requireTournamentOwner, tournamentController.undoCheckInDirectorCompetitor);

// GET /api/tournaments/:id/clubs
router.get('/:id/clubs', requireAuth, requireTournamentOwner, tournamentController.getClubs);

// POST /api/tournaments/:id/clubs/sync
router.post('/:id/clubs/sync', requireAuth, requireTournamentOwner, tournamentController.syncClubs);

// ── Director Officials / Staff / Instructors (JSONB sync) ────────────────────

// GET /api/tournaments/:id/officials
router.get('/:id/officials', requireAuth, requireTournamentOwner, tournamentController.getOfficials);

// POST /api/tournaments/:id/officials/sync
router.post('/:id/officials/sync', requireAuth, requireTournamentOwner, tournamentController.syncOfficials);

// GET /api/tournaments/:id/staff
router.get('/:id/staff', requireAuth, requireTournamentOwner, tournamentController.getStaff);

// POST /api/tournaments/:id/staff/sync
router.post('/:id/staff/sync', requireAuth, requireTournamentOwner, tournamentController.syncStaff);

// GET /api/tournaments/:id/instructors
router.get('/:id/instructors', requireAuth, requireTournamentOwner, tournamentController.getInstructors);

// POST /api/tournaments/:id/instructors/sync
router.post('/:id/instructors/sync', requireAuth, requireTournamentOwner, tournamentController.syncInstructors);

// ── Director Discount Codes ──────────────────────────────────────────────
const discountQueries = require('../db/queries/discounts');

// GET /api/tournaments/:id/discount-codes
router.get('/:id/discount-codes',
  requireAuth,
  requireTournamentOwner,
  async (req, res, next) => {
    try {
      // Verify tournament belongs to director
      const tournament = await require('../db/queries/tournaments').findById(req.params.id);
      if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
      if (tournament.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      const codes = await discountQueries.getByTournament(req.params.id);
      res.json({ discountCodes: codes });
    } catch (err) { next(err); }
  }
);

// POST /api/tournaments/:id/discount-codes
router.post('/:id/discount-codes',
  requireAuth,
  requireTournamentOwner,
  [
    body('code').trim().notEmpty().withMessage('Code is required'),
    body('type').isIn(['percentage', 'fixed']).withMessage('Type must be percentage or fixed'),
    body('value').isFloat({ min: 0 }).withMessage('Value must be a positive number'),
    body('maxUses').optional({ nullable: true }).isInt({ min: 1 }),
    body('expiresAt').optional({ nullable: true }).isISO8601(),
    body('active').optional().isBoolean(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const tournament = await require('../db/queries/tournaments').findById(req.params.id);
      if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
      if (tournament.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      // Check duplicate
      const existing = await discountQueries.findByCode(req.body.code);
      if (existing) return res.status(409).json({ error: 'A discount code with this name already exists' });

      const discount = await discountQueries.create({
        code: req.body.code,
        type: req.body.type,
        value: req.body.value,
        maxUses: req.body.maxUses,
        expiresAt: req.body.expiresAt,
        active: req.body.active,
        tournamentId: req.params.id,
        createdBy: req.user.id,
      });
      res.status(201).json({ discount });
    } catch (err) { next(err); }
  }
);

// PUT /api/tournaments/:id/discount-codes/:codeId
router.put('/:id/discount-codes/:codeId',
  requireAuth,
  requireTournamentOwner,
  [
    body('code').optional().trim().notEmpty(),
    body('type').optional().isIn(['percentage', 'fixed']),
    body('value').optional().isFloat({ min: 0 }),
    body('maxUses').optional({ nullable: true }),
    body('expiresAt').optional({ nullable: true }),
    body('active').optional().isBoolean(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const tournament = await require('../db/queries/tournaments').findById(req.params.id);
      if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
      if (tournament.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      const updates = {};
      const { code, type, value, maxUses, expiresAt, active } = req.body;
      if (code !== undefined) updates.code = code;
      if (type !== undefined) updates.type = type;
      if (value !== undefined) updates.value = value;
      if (maxUses !== undefined) updates.max_uses = maxUses;
      if (expiresAt !== undefined) updates.expires_at = expiresAt;
      if (active !== undefined) updates.active = active;

      const discount = await discountQueries.update(req.params.codeId, updates);
      if (!discount) return res.status(404).json({ error: 'Discount code not found' });
      res.json({ discount });
    } catch (err) { next(err); }
  }
);

// DELETE /api/tournaments/:id/discount-codes/:codeId
router.delete('/:id/discount-codes/:codeId',
  requireAuth,
  requireTournamentOwner,
  async (req, res, next) => {
    try {
      const tournament = await require('../db/queries/tournaments').findById(req.params.id);
      if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
      if (tournament.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      const result = await discountQueries.remove(req.params.codeId);
      if (!result) return res.status(404).json({ error: 'Discount code not found' });
      res.json({ message: 'Discount code deleted' });
    } catch (err) { next(err); }
  }
);

// ── Director Event Staff ───────────────────────────────────────────────────
const eventStaffQueries = require('../db/queries/eventStaff');

// GET /api/tournaments/:id/staff
router.get('/:id/staff',
  requireAuth,
  requireTournamentOwner,
  async (req, res, next) => {
    try {
      const tournament = await tournaments.findById(req.params.id);
      if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
      if (tournament.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      const staff = await eventStaffQueries.getByTournament(req.params.id);
      res.json({ staff });
    } catch (err) { next(err); }
  }
);

// POST /api/tournaments/:id/staff
router.post('/:id/staff',
  requireAuth,
  requireTournamentOwner,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('role').isIn(['judge', 'ring_coordinator', 'table_worker', 'medical', 'volunteer', 'announcer', 'photographer'])
      .withMessage('Invalid role'),
    body('email').optional({ nullable: true }).isEmail(),
    body('phone').optional({ nullable: true }),
    body('status').optional().isIn(['pending', 'confirmed', 'declined']),
    body('notes').optional({ nullable: true }),
    body('tshirtSize').optional({ nullable: true }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const tournament = await tournaments.findById(req.params.id);
      if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
      if (tournament.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      const staff = await eventStaffQueries.create({
        tournamentId: req.params.id,
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        role: req.body.role,
        status: req.body.status || 'pending',
        notes: req.body.notes,
        tshirtSize: req.body.tshirtSize,
        createdBy: req.user.id,
      });
      res.status(201).json({ staff });
    } catch (err) { next(err); }
  }
);

// PUT /api/tournaments/:id/staff/:staffId
router.put('/:id/staff/:staffId',
  requireAuth,
  requireTournamentOwner,
  [
    body('name').optional().trim().notEmpty(),
    body('role').optional().isIn(['judge', 'ring_coordinator', 'table_worker', 'medical', 'volunteer', 'announcer', 'photographer']),
    body('email').optional({ nullable: true }),
    body('phone').optional({ nullable: true }),
    body('status').optional().isIn(['pending', 'confirmed', 'declined']),
    body('notes').optional({ nullable: true }),
    body('tshirtSize').optional({ nullable: true }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const tournament = await tournaments.findById(req.params.id);
      if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
      if (tournament.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      const updates = {};
      const { name, email, phone, role, status, notes, tshirtSize } = req.body;
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (phone !== undefined) updates.phone = phone;
      if (role !== undefined) updates.role = role;
      if (status !== undefined) updates.status = status;
      if (notes !== undefined) updates.notes = notes;
      if (tshirtSize !== undefined) updates.tshirt_size = tshirtSize;

      const staff = await eventStaffQueries.update(req.params.staffId, updates);
      if (!staff) return res.status(404).json({ error: 'Staff member not found' });
      res.json({ staff });
    } catch (err) { next(err); }
  }
);

// DELETE /api/tournaments/:id/staff/:staffId
router.delete('/:id/staff/:staffId',
  requireAuth,
  requireTournamentOwner,
  async (req, res, next) => {
    try {
      const tournament = await tournaments.findById(req.params.id);
      if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
      if (tournament.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      const result = await eventStaffQueries.remove(req.params.staffId);
      if (!result) return res.status(404).json({ error: 'Staff member not found' });
      res.json({ message: 'Staff member removed' });
    } catch (err) { next(err); }
  }
);

module.exports = router;
