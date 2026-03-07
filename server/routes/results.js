const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireTournamentOwner } = require('../middleware/tournamentOwner');
const resultsController = require('../controllers/resultsController');

const router = express.Router();

// ── Public ──────────────────────────────────────────────────────────────────
router.get('/:id/results/public', resultsController.getPublicResults);

// ── Director (auth required) ────────────────────────────────────────────────
router.post('/:id/results/sync',
  requireAuth,
  requireTournamentOwner,
  resultsController.syncResults
);

router.get('/:id/results',
  requireAuth,
  requireTournamentOwner,
  resultsController.getResults
);

router.put('/:id/results/publish-all',
  requireAuth,
  requireTournamentOwner,
  resultsController.bulkPublish
);

router.put('/:id/results/unpublish-all',
  requireAuth,
  requireTournamentOwner,
  resultsController.bulkUnpublish
);

router.put('/:id/results/:resultId/publish',
  requireAuth,
  requireTournamentOwner,
  resultsController.publishDivision
);

router.put('/:id/results/:resultId/unpublish',
  requireAuth,
  requireTournamentOwner,
  resultsController.unpublishDivision
);

module.exports = router;
