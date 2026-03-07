const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireTournamentOwner } = require('../middleware/tournamentOwner');
const controller = require('../controllers/medicalIncidentController');

const router = express.Router();

// POST — log a new incident (auth required; staff or director verified in controller)
router.post('/:id/medical-incidents',
  requireAuth,
  controller.logIncident
);

// GET — list all incidents (auth + tournament owner; ownership verified in controller)
router.get('/:id/medical-incidents',
  requireAuth,
  requireTournamentOwner,
  controller.getIncidents
);

// GET — export incidents as CSV (auth + tournament owner; ownership verified in controller)
router.get('/:id/medical-incidents/export.csv',
  requireAuth,
  requireTournamentOwner,
  controller.exportIncidents
);

module.exports = router;
