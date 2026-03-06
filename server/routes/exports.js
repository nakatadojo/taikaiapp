const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireTournamentOwner } = require('../middleware/tournamentOwner');
const exportController = require('../controllers/exportController');

const router = express.Router();

// All export routes require auth + event_director role.
// Tournament ownership is verified inside each controller function.

// ── Registrants ─────────────────────────────────────────────────────────────

router.get('/:id/export/registrants.csv',
  requireAuth,
  requireTournamentOwner,
  exportController.exportRegistrantsCSV
);

router.get('/:id/export/registrants.pdf',
  requireAuth,
  requireTournamentOwner,
  exportController.exportRegistrantsPDF
);

// ── Results ─────────────────────────────────────────────────────────────────

router.get('/:id/export/results.csv',
  requireAuth,
  requireTournamentOwner,
  exportController.exportResultsCSV
);

router.get('/:id/export/results.pdf',
  requireAuth,
  requireTournamentOwner,
  exportController.exportResultsPDF
);

// ── Check-in ────────────────────────────────────────────────────────────────

router.get('/:id/export/checkin.csv',
  requireAuth,
  requireTournamentOwner,
  exportController.exportCheckinCSV
);

module.exports = router;
