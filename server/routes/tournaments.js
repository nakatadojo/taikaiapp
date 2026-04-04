const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { requireTournamentOwner } = require('../middleware/tournamentOwner');
const { requireTournamentPermission } = require('../middleware/tournamentPermission');
const upload = require('../middleware/upload');
const { validateImageBytes } = require('../middleware/upload');
const tournamentController = require('../controllers/tournamentController');
const directorCompetitorsController = require('../controllers/directorCompetitorsController');
const { getRegistrationFields } = require('../controllers/registrationFieldsController');
const directorSettingsController = require('../controllers/directorSettingsController');

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

// GET /api/tournaments/:id/registration-fields — Dynamic form field options (public)
router.get('/:id/registration-fields', getRegistrationFields);

// GET /api/tournaments — List all tournaments (legacy)
router.get('/', optionalAuth, tournamentController.getTournaments);

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
// optionalAuth populates req.user so owners can view their own unpublished draft
router.get('/:id', optionalAuth, tournamentController.getTournament);

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
  validateImageBytes,
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
    body('ageMin').optional({ nullable: true }).isInt({ min: 0 }),
    body('ageMax').optional({ nullable: true }).isInt({ min: 0 }),
    body('rankMin').optional({ nullable: true }).trim(),
    body('rankMax').optional({ nullable: true }).trim(),
    body('priceOverride').optional({ nullable: true }).isFloat({ min: 0 }),
    body('addonPriceOverride').optional({ nullable: true }).isFloat({ min: 0 }),
    body('maxCompetitors').optional({ nullable: true }).isInt({ min: 1 }),
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

// ── Director Competitors — per-record API (DB-first) ────────────────────────

// GET /api/tournaments/:id/competitors — staff can read
router.get('/:id/competitors', requireAuth, requireTournamentPermission('read_data'), directorCompetitorsController.getCompetitors);

// POST /api/tournaments/:id/competitors/sync — keep for legacy sendBeacon (must be before /:competitorId)
router.post('/:id/competitors/sync', requireAuth, requireTournamentOwner, tournamentController.syncCompetitors);

// POST /api/tournaments/:id/competitors — add a single competitor
router.post('/:id/competitors', requireAuth, directorCompetitorsController.addCompetitor);

// PUT /api/tournaments/:id/competitors/:competitorId — update a single competitor
router.put('/:id/competitors/:competitorId', requireAuth, directorCompetitorsController.updateCompetitor);

// DELETE /api/tournaments/:id/competitors/:competitorId — delete a single competitor (must be before checkin routes)
router.delete('/:id/competitors/:competitorId', requireAuth, directorCompetitorsController.deleteCompetitor);

// PATCH /api/tournaments/:id/competitors/:competitorId/approve — approve a competitor (deducts credit for real competitors)
router.patch('/:id/competitors/:competitorId/approve', requireAuth, directorCompetitorsController.approveCompetitor);

// DELETE /api/tournaments/:id/competitors/:competitorId/approve — unapprove (refunds credit if not bracket-placed)
router.delete('/:id/competitors/:competitorId/approve', requireAuth, directorCompetitorsController.unapproveCompetitor);

// POST /api/tournaments/:id/competitors/:competitorId/checkin — staff can check in
router.post('/:id/competitors/:competitorId/checkin', requireAuth, requireTournamentPermission('manage_checkin'), tournamentController.checkInDirectorCompetitor);

// DELETE /api/tournaments/:id/competitors/:competitorId/checkin — staff can undo check-in
router.delete('/:id/competitors/:competitorId/checkin', requireAuth, requireTournamentPermission('manage_checkin'), tournamentController.undoCheckInDirectorCompetitor);

// GET /api/tournaments/:id/clubs — staff can read
router.get('/:id/clubs', requireAuth, requireTournamentPermission('read_data'), tournamentController.getClubs);

// POST /api/tournaments/:id/clubs/sync — owner or approved staff
router.post('/:id/clubs/sync', requireAuth, requireTournamentOwner, tournamentController.syncClubs);

// ── Director Officials / Staff / Instructors (JSONB sync) ────────────────────

// GET /api/tournaments/:id/officials — staff can read
router.get('/:id/officials', requireAuth, requireTournamentPermission('read_data'), tournamentController.getOfficials);

// POST /api/tournaments/:id/officials/sync — owner only
router.post('/:id/officials/sync', requireAuth, requireTournamentOwner, tournamentController.syncOfficials);

// GET /api/tournaments/:id/staff — staff can read
router.get('/:id/staff', requireAuth, requireTournamentPermission('read_data'), tournamentController.getStaff);

// POST /api/tournaments/:id/staff/sync — owner only
router.post('/:id/staff/sync', requireAuth, requireTournamentOwner, tournamentController.syncStaff);

// GET /api/tournaments/:id/instructors — staff can read
router.get('/:id/instructors', requireAuth, requireTournamentPermission('read_data'), tournamentController.getInstructors);

// POST /api/tournaments/:id/instructors/sync — owner only
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
      // Check duplicate within this tournament only — different tournaments may share code names
      const existing = await discountQueries.getByTournament(req.params.id);
      const duplicate = existing.find(d => d.code === req.body.code.toLowerCase());
      if (duplicate) return res.status(409).json({ error: 'A discount code with this name already exists for this tournament' });

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

// GET /api/tournaments/:id/event-staff
// NOTE: renamed from /:id/staff to avoid shadowing the JSONB staff route above (BUG-005 fix).
router.get('/:id/event-staff',
  requireAuth,
  requireTournamentOwner,
  async (req, res, next) => {
    try {
      // req.tournament is already verified and attached by requireTournamentOwner
      const staff = await eventStaffQueries.getByTournament(req.params.id);
      res.json({ staff });
    } catch (err) { next(err); }
  }
);

// POST /api/tournaments/:id/event-staff
router.post('/:id/event-staff',
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

// PUT /api/tournaments/:id/event-staff/:staffId
router.put('/:id/event-staff/:staffId',
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

// DELETE /api/tournaments/:id/event-staff/:staffId
router.delete('/:id/event-staff/:staffId',
  requireAuth,
  requireTournamentOwner,
  async (req, res, next) => {
    try {
      const result = await eventStaffQueries.remove(req.params.staffId);
      if (!result) return res.status(404).json({ error: 'Staff member not found' });
      res.json({ message: 'Staff member removed' });
    } catch (err) { next(err); }
  }
);

// ── Test Data Generator ──────────────────────────────────────────────────────
const testDataController = require('../controllers/testDataController');

router.post('/:id/generate-test-data', requireAuth, requireTournamentOwner, testDataController.generateTestData);
router.post('/:id/clear-test-data', requireAuth, requireTournamentOwner, testDataController.clearTestData);

// ── Team Registration ────────────────────────────────────────────────────────
const { getTeams, createTeam, updateTeam, markTeamPayment, deleteTeam, addTeamMember } = require('../controllers/teamsController');

// GET /api/tournaments/:id/teams — list teams (director + authenticated users)
router.get('/:id/teams', requireAuth, getTeams);

// POST /api/tournaments/:id/teams — create a team
router.post('/:id/teams', requireAuth, createTeam);

// POST /api/tournaments/:id/teams/:teamId/members — atomically add a member (race-safe)
router.post('/:id/teams/:teamId/members', requireAuth, addTeamMember);

// PUT /api/tournaments/:id/teams/:teamId — update team (creator or director)
router.put('/:id/teams/:teamId', requireAuth, updateTeam);

// PATCH /api/tournaments/:id/teams/:teamId/payment — mark payment (director only)
router.patch('/:id/teams/:teamId/payment', requireAuth, markTeamPayment);

// DELETE /api/tournaments/:id/teams/:teamId — delete team (director only)
router.delete('/:id/teams/:teamId', requireAuth, deleteTeam);

// ── Director Stripe & Payment Settings ───────────────────────────────────────

// GET  /api/director/stripe-settings — read director's own masked Stripe keys
router.get('/director/stripe-settings', requireAuth, directorSettingsController.getStripeSettings);

// PUT  /api/director/stripe-settings — save director's Stripe keys
router.put('/director/stripe-settings', requireAuth, directorSettingsController.updateStripeSettings);

// PATCH /api/tournaments/:id/payment-mode — set payment_mode for a tournament
router.patch('/:id/payment-mode', requireAuth, tournamentController.setPaymentMode);

module.exports = router;
