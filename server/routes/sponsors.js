const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const sponsorController = require('../controllers/sponsorController');

const router = express.Router();

// ── Public endpoint (no auth) ──────────────────────────────────────────────
router.get('/:id/sponsors/public', sponsorController.getPublicSponsors);

// ── Director endpoints (auth + event_director) ─────────────────────────────

// Reorder must come before /:sponsorId to avoid treating "reorder" as a UUID
router.put('/:id/sponsors/reorder',
  requireAuth,
  requireRole('event_director'),
  sponsorController.reorderSponsors
);

router.post('/:id/sponsors',
  requireAuth,
  requireRole('event_director'),
  sponsorController.createSponsor
);

router.get('/:id/sponsors',
  requireAuth,
  requireRole('event_director'),
  sponsorController.getSponsors
);

router.put('/:id/sponsors/:sponsorId',
  requireAuth,
  requireRole('event_director'),
  sponsorController.updateSponsor
);

router.delete('/:id/sponsors/:sponsorId',
  requireAuth,
  requireRole('event_director'),
  sponsorController.deleteSponsor
);

router.patch('/:id/sponsors/:sponsorId/toggle',
  requireAuth,
  requireRole('event_director'),
  sponsorController.toggleSponsorVisibility
);

module.exports = router;
