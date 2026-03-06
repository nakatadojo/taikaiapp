const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireTournamentOwner } = require('../middleware/tournamentOwner');
const c = require('../controllers/teamController');

const router = express.Router();

router.get('/:id/teams',
  requireAuth, requireTournamentOwner,
  c.getTeams
);

router.post('/:id/teams/sync',
  requireAuth, requireTournamentOwner,
  c.syncTeams
);

module.exports = router;
