const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireTournamentOwner } = require('../middleware/tournamentOwner');
const { requireTournamentPermission } = require('../middleware/tournamentPermission');
const upload = require('../middleware/upload');
const { validateImageBytes } = require('../middleware/upload');
const certificateController = require('../controllers/certificateController');

const router = express.Router();

// ── Template Upload ─────────────────────────────────────────────────────────

router.post('/:id/certificate-template',
  requireAuth,
  requireTournamentOwner,
  upload.single('template'),
  validateImageBytes,
  certificateController.uploadTemplate
);

// ── Get Template — staff can read for certificate printing ──────────────────

router.get('/:id/certificate-template',
  requireAuth,
  requireTournamentPermission('read_data'),
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
