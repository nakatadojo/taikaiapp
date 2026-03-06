const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const upload = require('../middleware/upload');
const certificateController = require('../controllers/certificateController');

const router = express.Router();

// All certificate routes require auth + event_director role.
// Tournament ownership is verified inside each controller function.

// ── Template Upload ─────────────────────────────────────────────────────────

router.post('/:id/certificate-template',
  requireAuth,
  requireRole('event_director'),
  upload.single('template'),
  certificateController.uploadTemplate
);

// ── Get Template ────────────────────────────────────────────────────────────

router.get('/:id/certificate-template',
  requireAuth,
  requireRole('event_director'),
  certificateController.getTemplate
);

// ── Save Merge Tag Config ───────────────────────────────────────────────────

router.put('/:id/certificate-template/config',
  requireAuth,
  requireRole('event_director'),
  certificateController.saveConfig
);

// ── Delete Template ─────────────────────────────────────────────────────────

router.delete('/:id/certificate-template',
  requireAuth,
  requireRole('event_director'),
  certificateController.deleteTemplate
);

// ── Batch PDF ───────────────────────────────────────────────────────────────

router.get('/:id/certificates/batch.pdf',
  requireAuth,
  requireRole('event_director'),
  certificateController.generateBatchPDF
);

module.exports = router;
