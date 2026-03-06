const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const c = require('../controllers/teamController');

const router = express.Router();

router.get('/:id/teams',
  requireAuth, requireRole('event_director'),
  c.getTeams
);

router.post('/:id/teams/sync',
  requireAuth, requireRole('event_director'),
  c.syncTeams
);

module.exports = router;
