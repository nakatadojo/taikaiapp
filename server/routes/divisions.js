const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireTournamentOwner } = require('../middleware/tournamentOwner');
const c = require('../controllers/divisionsController');

const router = express.Router();

router.get('/:id/divisions',
  requireAuth, requireTournamentOwner,
  c.getDivisions
);

router.post('/:id/divisions/sync',
  requireAuth, requireTournamentOwner,
  c.syncDivisions
);

router.post('/:id/events/:eventId/templates/sync',
  requireAuth, requireTournamentOwner,
  c.syncTemplates
);

router.post('/:id/divisions/auto-assign',
  requireAuth, requireTournamentOwner,
  c.autoAssignDivisions
);

module.exports = router;
