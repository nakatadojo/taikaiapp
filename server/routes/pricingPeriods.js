const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireTournamentOwner } = require('../middleware/tournamentOwner');
const controller = require('../controllers/pricingPeriodController');

const router = express.Router();

// Public
router.get('/:id/pricing-periods', controller.list);

// Director
router.post('/:id/pricing-periods',
  requireAuth,
  requireTournamentOwner,
  controller.create
);

router.put('/:id/pricing-periods/bulk',
  requireAuth,
  requireTournamentOwner,
  controller.bulkReplace
);

router.put('/:id/pricing-periods/:pid',
  requireAuth,
  requireTournamentOwner,
  controller.update
);

router.delete('/:id/pricing-periods/:pid',
  requireAuth,
  requireTournamentOwner,
  controller.remove
);

module.exports = router;
