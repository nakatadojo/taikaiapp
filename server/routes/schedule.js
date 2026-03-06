const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const c = require('../controllers/scheduleController');

const router = express.Router();

router.get('/:id/schedule',
  requireAuth, requireRole('event_director'),
  c.getSchedule
);

router.post('/:id/schedule/sync',
  requireAuth, requireRole('event_director'),
  c.syncSchedule
);

router.put('/:id/schedule/publish',
  requireAuth, requireRole('event_director'),
  c.setSchedulePublished
);

module.exports = router;
