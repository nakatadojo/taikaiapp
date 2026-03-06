const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const resultsController = require('../controllers/resultsController');

const router = express.Router();

// ── Public ──────────────────────────────────────────────────────────────────
router.get('/:id/results/public', resultsController.getPublicResults);

// ── Director (auth required) ────────────────────────────────────────────────
router.post('/:id/results/sync',
  requireAuth,
  requireRole('event_director'),
  resultsController.syncResults
);

router.get('/:id/results',
  requireAuth,
  requireRole('event_director'),
  resultsController.getResults
);

router.put('/:id/results/publish-all',
  requireAuth,
  requireRole('event_director'),
  resultsController.bulkPublish
);

router.put('/:id/results/unpublish-all',
  requireAuth,
  requireRole('event_director'),
  resultsController.bulkUnpublish
);

router.put('/:id/results/:resultId/publish',
  requireAuth,
  requireRole('event_director'),
  resultsController.publishDivision
);

router.put('/:id/results/:resultId/unpublish',
  requireAuth,
  requireRole('event_director'),
  resultsController.unpublishDivision
);

module.exports = router;
