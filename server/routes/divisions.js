const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const c = require('../controllers/divisionsController');

const router = express.Router();

router.get('/:id/divisions',
  requireAuth, requireRole('event_director', 'admin', 'super_admin'),
  c.getDivisions
);

router.post('/:id/divisions/sync',
  requireAuth, requireRole('event_director', 'admin', 'super_admin'),
  c.syncDivisions
);

router.post('/:id/events/:eventId/templates/sync',
  requireAuth, requireRole('event_director', 'admin', 'super_admin'),
  c.syncTemplates
);

module.exports = router;
