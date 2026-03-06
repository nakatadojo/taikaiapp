const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireTournamentOwner } = require('../middleware/tournamentOwner');
const feedbackController = require('../controllers/feedbackController');

const router = express.Router();

// ── Public endpoints (no auth) ──────────────────────────────────────────────
// These use /api/feedback/:formId — mounted on /api/feedback

router.get('/:formId', feedbackController.getPublicForm);
router.post('/:formId/respond', feedbackController.submitResponse);

module.exports = router;

// ── Tournament-scoped routes (auth + event_director) ────────────────────────
// These use /api/tournaments/:id/feedback-form — mounted on /api/tournaments

const tournamentRouter = express.Router();

tournamentRouter.put('/:id/feedback-form',
  requireAuth,
  requireTournamentOwner,
  feedbackController.configureForm
);

tournamentRouter.get('/:id/feedback-form',
  requireAuth,
  requireTournamentOwner,
  feedbackController.getFormConfig
);

tournamentRouter.get('/:id/feedback-form/responses',
  requireAuth,
  requireTournamentOwner,
  feedbackController.getResponses
);

tournamentRouter.get('/:id/feedback-form/stats',
  requireAuth,
  requireTournamentOwner,
  feedbackController.getStats
);

tournamentRouter.get('/:id/feedback-form/export.csv',
  requireAuth,
  requireTournamentOwner,
  feedbackController.exportResponses
);

module.exports.tournamentRouter = tournamentRouter;
