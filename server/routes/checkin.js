const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireTournamentPermission } = require('../middleware/tournamentPermission');
const controller = require('../controllers/checkinController');

const router = express.Router();

// Fixed-path routes first (before parameterized :registrationId routes)
router.get('/:id/checkin/stats',
  requireAuth,
  requireTournamentPermission('manage_checkin'),
  controller.stats
);

router.get('/:id/checkin/absent-withdrawn',
  requireAuth,
  requireTournamentPermission('manage_checkin'),
  controller.absentAndWithdrawn
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

// Absent / withdrawn status routes
router.post('/:id/checkin/absent',
  requireAuth,
  requireTournamentPermission('manage_checkin'),
  controller.markAbsent
);

router.post('/:id/checkin/withdrawn',
  requireAuth,
  requireTournamentPermission('manage_checkin'),
  controller.markWithdrawn
);

// mat-call before parameterized DELETE
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
