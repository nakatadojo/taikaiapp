const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireTournamentOwner } = require('../middleware/tournamentOwner');
const sponsorController = require('../controllers/sponsorController');

const router = express.Router();

// ── Public endpoint (no auth) ──────────────────────────────────────────────
router.get('/:id/sponsors/public', sponsorController.getPublicSponsors);

// ── Director endpoints (auth + event_director) ─────────────────────────────

// Reorder must come before /:sponsorId to avoid treating "reorder" as a UUID
router.put('/:id/sponsors/reorder',
  requireAuth,
  requireTournamentOwner,
  sponsorController.reorderSponsors
);

router.post('/:id/sponsors',
  requireAuth,
  requireTournamentOwner,
  sponsorController.createSponsor
);

router.get('/:id/sponsors',
  requireAuth,
  requireTournamentOwner,
  sponsorController.getSponsors
);

router.put('/:id/sponsors/:sponsorId',
  requireAuth,
  requireTournamentOwner,
  sponsorController.updateSponsor
);

router.delete('/:id/sponsors/:sponsorId',
  requireAuth,
  requireTournamentOwner,
  sponsorController.deleteSponsor
);

router.patch('/:id/sponsors/:sponsorId/toggle',
  requireAuth,
  requireTournamentOwner,
  sponsorController.toggleSponsorVisibility
);

module.exports = router;
