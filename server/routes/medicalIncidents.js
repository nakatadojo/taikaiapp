const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const controller = require('../controllers/medicalIncidentController');

const router = express.Router();

// POST — log a new incident (auth required; staff or director verified in controller)
router.post('/:id/medical-incidents',
  requireAuth,
  controller.logIncident
);

// GET — list all incidents (auth + event_director; ownership verified in controller)
router.get('/:id/medical-incidents',
  requireAuth,
  requireRole('event_director'),
  controller.getIncidents
);

// GET — export incidents as CSV (auth + event_director; ownership verified in controller)
router.get('/:id/medical-incidents/export.csv',
  requireAuth,
  requireRole('event_director'),
  controller.exportIncidents
);

module.exports = router;
