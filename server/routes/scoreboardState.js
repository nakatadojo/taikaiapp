const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireTournamentOwner } = require('../middleware/tournamentOwner');
const scoreboardStateController = require('../controllers/scoreboardStateController');

const router = express.Router();

// Live scoreboard state — read/write by director + approved staff
router.get('/:id/scoreboard-state',
  requireAuth,
  requireTournamentOwner,
  scoreboardStateController.getScoreboardState
);

router.put('/:id/scoreboard-state',
  requireAuth,
  requireTournamentOwner,
  scoreboardStateController.setScoreboardState
);

// Staging display settings — read/write by director + approved staff
router.get('/:id/staging-settings',
  requireAuth,
  requireTournamentOwner,
  scoreboardStateController.getStagingSettings
);

router.put('/:id/staging-settings',
  requireAuth,
  requireTournamentOwner,
  scoreboardStateController.setStagingSettings
);

module.exports = router;
