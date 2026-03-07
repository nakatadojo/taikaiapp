const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireTournamentOwner } = require('../middleware/tournamentOwner');
const publicDataController = require('../controllers/publicDataController');
const customTabController = require('../controllers/customTabController');

const router = express.Router();

// ── Public endpoints ────────────────────────────────────────────────────────
router.get('/:id/competitors/public', publicDataController.getPublicCompetitors);
router.get('/:id/schedule/public', publicDataController.getPublicSchedule);
router.get('/:id/brackets/public', publicDataController.getPublicBrackets);

// ── Custom tabs (public read, director write) ───────────────────────────────
router.get('/:id/custom-tabs', customTabController.getCustomTabs);

router.post('/:id/custom-tabs',
  requireAuth,
  requireTournamentOwner,
  customTabController.createCustomTab
);

router.put('/:id/custom-tabs/reorder',
  requireAuth,
  requireTournamentOwner,
  customTabController.reorderCustomTabs
);

router.put('/:id/custom-tabs/:tabId',
  requireAuth,
  requireTournamentOwner,
  customTabController.updateCustomTab
);

router.delete('/:id/custom-tabs/:tabId',
  requireAuth,
  requireTournamentOwner,
  customTabController.deleteCustomTab
);

// ── Section visibility ──────────────────────────────────────────────────────
router.put('/:id/section-visibility',
  requireAuth,
  requireTournamentOwner,
  customTabController.updateSectionVisibility
);

module.exports = router;
