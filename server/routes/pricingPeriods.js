const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const controller = require('../controllers/pricingPeriodController');

const router = express.Router();

// Public
router.get('/:id/pricing-periods', controller.list);

// Director
router.post('/:id/pricing-periods',
  requireAuth,
  requireRole('event_director', 'admin', 'super_admin'),
  controller.create
);

router.put('/:id/pricing-periods/bulk',
  requireAuth,
  requireRole('event_director', 'admin', 'super_admin'),
  controller.bulkReplace
);

router.put('/:id/pricing-periods/:pid',
  requireAuth,
  requireRole('event_director', 'admin', 'super_admin'),
  controller.update
);

router.delete('/:id/pricing-periods/:pid',
  requireAuth,
  requireRole('event_director', 'admin', 'super_admin'),
  controller.remove
);

module.exports = router;
