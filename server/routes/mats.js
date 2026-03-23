const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireTournamentOwner } = require('../middleware/tournamentOwner');
const controller = require('../controllers/matsController');

const router = express.Router();

// ── Mats Config ───────────────────────────────────────────────────────────────
router.get('/:id/mats',
  requireAuth,
  requireTournamentOwner,
  controller.getMats
);

router.post('/:id/mats/sync',
  requireAuth,
  requireTournamentOwner,
  controller.syncMats
);

// ── Mat Scoreboards ───────────────────────────────────────────────────────────
router.get('/:id/mat-scoreboards',
  requireAuth,
  requireTournamentOwner,
  controller.getMatScoreboards
);

router.post('/:id/mat-scoreboards/sync',
  requireAuth,
  requireTournamentOwner,
  controller.syncMatScoreboards
);

module.exports = router;
