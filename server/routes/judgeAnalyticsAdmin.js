const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const controller = require('../controllers/judgeAnalyticsController');

const router = express.Router();

// GET — cross-tournament aggregate judge analytics (auth + super_admin)
router.get('/judge-analytics',
  requireAuth,
  requireRole('super_admin'),
  controller.getAdminAggregateStats
);

module.exports = router;
