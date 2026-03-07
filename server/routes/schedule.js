const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireTournamentOwner } = require('../middleware/tournamentOwner');
const c = require('../controllers/scheduleController');

const router = express.Router();

router.get('/:id/schedule',
  requireAuth, requireTournamentOwner,
  c.getSchedule
);

router.post('/:id/schedule/sync',
  requireAuth, requireTournamentOwner,
  c.syncSchedule
);

router.put('/:id/schedule/publish',
  requireAuth, requireTournamentOwner,
  c.setSchedulePublished
);

module.exports = router;
