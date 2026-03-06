const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireTournamentPermission } = require('../middleware/tournamentPermission');
const controller = require('../controllers/checkinController');

const router = express.Router();

// Stats must come before parameterized routes
router.get('/:id/checkin/stats',
  requireAuth,
  requireTournamentPermission('manage_checkin'),
  controller.stats
);

router.get('/:id/checkin',
  requireAuth,
  requireTournamentPermission('manage_checkin'),
  controller.list
);

router.post('/:id/checkin',
  requireAuth,
  requireTournamentPermission('manage_checkin'),
  controller.checkin
);

// mat-call must come before the parameterized DELETE
router.put('/:id/checkin/:registrationId/mat-call',
  requireAuth,
  requireTournamentPermission('manage_checkin'),
  controller.matCall
);

router.delete('/:id/checkin/:registrationId',
  requireAuth,
  requireTournamentPermission('manage_checkin'),
  controller.undoCheckin
);

module.exports = router;
