const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
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
  requireRole('event_director', 'admin', 'super_admin'),
  customTabController.createCustomTab
);

router.put('/:id/custom-tabs/reorder',
  requireAuth,
  requireRole('event_director', 'admin', 'super_admin'),
  customTabController.reorderCustomTabs
);

router.put('/:id/custom-tabs/:tabId',
  requireAuth,
  requireRole('event_director', 'admin', 'super_admin'),
  customTabController.updateCustomTab
);

router.delete('/:id/custom-tabs/:tabId',
  requireAuth,
  requireRole('event_director', 'admin', 'super_admin'),
  customTabController.deleteCustomTab
);

// ── Section visibility ──────────────────────────────────────────────────────
router.put('/:id/section-visibility',
  requireAuth,
  requireRole('event_director', 'admin', 'super_admin'),
  customTabController.updateSectionVisibility
);

module.exports = router;
