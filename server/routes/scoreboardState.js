const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireTournamentPermission } = require('../middleware/tournamentPermission');
const scoreboardStateController = require('../controllers/scoreboardStateController');

const router = express.Router();

// Live scoreboard state — GET is public (TV displays are unauthenticated)
router.get('/:id/scoreboard-state',
  scoreboardStateController.getScoreboardState
);

router.put('/:id/scoreboard-state',
  requireAuth,
  requireTournamentPermission('operate_scoreboard', { ring: req => req.body?.state?.ring }),
  scoreboardStateController.setScoreboardState
);

// Scoreboard audit log — append one action event
router.post('/:id/scoreboard-actions',
  requireAuth,
  requireTournamentPermission('operate_scoreboard'),
  scoreboardStateController.appendScoreboardAction
);

// Operator mat lock — acquire, release, heartbeat, force-take
router.post('/:id/scoreboard-lock',
  requireAuth,
  requireTournamentPermission('operate_scoreboard'),
  scoreboardStateController.acquireScoreboardLock
);

router.delete('/:id/scoreboard-lock',
  requireAuth,
  requireTournamentPermission('operate_scoreboard'),
  scoreboardStateController.releaseScoreboardLock
);

router.post('/:id/scoreboard-lock/heartbeat',
  requireAuth,
  requireTournamentPermission('operate_scoreboard'),
  scoreboardStateController.heartbeatScoreboardLock
);

router.post('/:id/scoreboard-lock/take',
  requireAuth,
  requireTournamentPermission('operate_scoreboard'),
  scoreboardStateController.forceScoreboardLock
);

// Staging display settings — GET is public (TV/staging displays are unauthenticated)
router.get('/:id/staging-settings',
  scoreboardStateController.getStagingSettings
);

router.put('/:id/staging-settings',
  requireAuth,
  requireTournamentPermission('operate_scoreboard'),
  scoreboardStateController.setStagingSettings
);

module.exports = router;
