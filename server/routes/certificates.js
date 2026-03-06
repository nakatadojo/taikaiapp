const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireTournamentOwner } = require('../middleware/tournamentOwner');
const upload = require('../middleware/upload');
const certificateController = require('../controllers/certificateController');

const router = express.Router();

// All certificate routes require auth + event_director role.
// Tournament ownership is verified inside each controller function.

// ── Template Upload ─────────────────────────────────────────────────────────

router.post('/:id/certificate-template',
  requireAuth,
  requireTournamentOwner,
  upload.single('template'),
  certificateController.uploadTemplate
);

// ── Get Template ────────────────────────────────────────────────────────────

router.get('/:id/certificate-template',
  requireAuth,
  requireTournamentOwner,
  certificateController.getTemplate
);

// ── Save Merge Tag Config ───────────────────────────────────────────────────

router.put('/:id/certificate-template/config',
  requireAuth,
  requireTournamentOwner,
  certificateController.saveConfig
);

// ── Delete Template ─────────────────────────────────────────────────────────

router.delete('/:id/certificate-template',
  requireAuth,
  requireTournamentOwner,
  certificateController.deleteTemplate
);

// ── Batch PDF ───────────────────────────────────────────────────────────────

router.get('/:id/certificates/batch.pdf',
  requireAuth,
  requireTournamentOwner,
  certificateController.generateBatchPDF
);

module.exports = router;
