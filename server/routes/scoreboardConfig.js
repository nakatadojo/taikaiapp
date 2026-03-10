const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireTournamentOwner } = require('../middleware/tournamentOwner');
const scoreboardConfigController = require('../controllers/scoreboardConfigController');

const router = express.Router();

router.get('/:id/scoreboard-config',
  requireAuth,
  requireTournamentOwner,
  scoreboardConfigController.getConfig
);

router.put('/:id/scoreboard-config',
  requireAuth,
  requireTournamentOwner,
  scoreboardConfigController.saveConfig
);

module.exports = router;
