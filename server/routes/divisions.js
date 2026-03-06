const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const c = require('../controllers/divisionsController');

const router = express.Router();

router.get('/:id/divisions',
  requireAuth, requireRole('event_director'),
  c.getDivisions
);

router.post('/:id/divisions/sync',
  requireAuth, requireRole('event_director'),
  c.syncDivisions
);

router.post('/:id/events/:eventId/templates/sync',
  requireAuth, requireRole('event_director'),
  c.syncTemplates
);

module.exports = router;
