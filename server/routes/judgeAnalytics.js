const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireTournamentOwner } = require('../middleware/tournamentOwner');
const controller = require('../controllers/judgeAnalyticsController');

const router = express.Router();

// POST — sync judge vote records from client (auth + tournament owner; ownership in controller)
router.post('/:id/judge-votes/sync',
  requireAuth,
  requireTournamentOwner,
  controller.syncVotes
);

// GET — aggregated judge analytics for a tournament (auth + tournament owner; ownership in controller)
router.get('/:id/judge-analytics',
  requireAuth,
  requireTournamentOwner,
  controller.getTournamentStats
);

module.exports = router;
