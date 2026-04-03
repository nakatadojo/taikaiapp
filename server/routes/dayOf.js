const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireTournamentOwner } = require('../middleware/tournamentOwner');
const c = require('../controllers/dayOfController');

const router = express.Router();

// All day-of routes are director-only.
// They are mounted under /api/tournaments so paths are relative to /:id.

router.get('/:id/registrations/:registrationId/events',
  requireAuth,
  requireTournamentOwner,
  c.listEvents
);

router.post('/:id/registrations/:registrationId/events/add',
  requireAuth,
  requireTournamentOwner,
  c.addEvent
);

router.post('/:id/registrations/:registrationId/events/remove',
  requireAuth,
  requireTournamentOwner,
  c.removeEvent
);

module.exports = router;
