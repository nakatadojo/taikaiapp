const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireTournamentPermission } = require('../middleware/tournamentPermission');
const scoreboardStateController = require('../controllers/scoreboardStateController');

const router = express.Router();

// Live scoreboard state — read/write by director + approved staff
router.get('/:id/scoreboard-state',
  requireAuth,
  requireTournamentPermission('read_data'),
  scoreboardStateController.getScoreboardState
);

router.put('/:id/scoreboard-state',
  requireAuth,
  requireTournamentPermission('operate_scoreboard'),
  scoreboardStateController.setScoreboardState
);

// Staging display settings — read/write by director + approved staff
router.get('/:id/staging-settings',
  requireAuth,
  requireTournamentPermission('read_data'),
  scoreboardStateController.getStagingSettings
);

router.put('/:id/staging-settings',
  requireAuth,
  requireTournamentPermission('operate_scoreboard'),
  scoreboardStateController.setStagingSettings
);

module.exports = router;
