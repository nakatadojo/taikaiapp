const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { requireTournamentOwner } = require('../middleware/tournamentOwner');
const controller = require('../controllers/tournamentMemberController');

const router = express.Router();

// POST /api/tournament-members — Apply for a role
router.post('/',
  requireAuth,
  [
    body('tournamentId').isUUID().withMessage('Valid tournament ID is required'),
    body('role').isIn(['coach', 'judge', 'staff', 'parent']).withMessage('Role must be coach, judge, staff, or parent'),
    body('staffRole').optional().isString().trim(),
  ],
  validate,
  controller.apply
);

// GET /api/tournament-members/:tournamentId — List members for a tournament
router.get('/:tournamentId',
  requireAuth,
  requireTournamentOwner,
  controller.list
);

// PATCH /api/tournament-members/:id/approve — Approve application
router.patch('/:id/approve',
  requireAuth,
  requireTournamentOwner,
  controller.approve
);

// PATCH /api/tournament-members/:id/decline — Decline application
router.patch('/:id/decline',
  requireAuth,
  requireTournamentOwner,
  controller.decline
);

module.exports = router;
