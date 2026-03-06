const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const exportController = require('../controllers/exportController');

const router = express.Router();

// All export routes require auth + event_director role.
// Tournament ownership is verified inside each controller function.

// ── Registrants ─────────────────────────────────────────────────────────────

router.get('/:id/export/registrants.csv',
  requireAuth,
  requireRole('event_director'),
  exportController.exportRegistrantsCSV
);

router.get('/:id/export/registrants.pdf',
  requireAuth,
  requireRole('event_director'),
  exportController.exportRegistrantsPDF
);

// ── Results ─────────────────────────────────────────────────────────────────

router.get('/:id/export/results.csv',
  requireAuth,
  requireRole('event_director'),
  exportController.exportResultsCSV
);

router.get('/:id/export/results.pdf',
  requireAuth,
  requireRole('event_director'),
  exportController.exportResultsPDF
);

// ── Check-in ────────────────────────────────────────────────────────────────

router.get('/:id/export/checkin.csv',
  requireAuth,
  requireRole('event_director'),
  exportController.exportCheckinCSV
);

module.exports = router;
