const express = require('express');
const { requireAuth } = require('../middleware/auth');
const controller = require('../controllers/tournamentMemberController');

const router = express.Router();

// GET /api/my/tournaments — Get current user's tournament memberships
router.get('/tournaments', requireAuth, controller.myTournaments);

// GET /api/my/staff-dashboard — Get staff/judge assignments for current user
router.get('/staff-dashboard', requireAuth, controller.staffDashboard);

// GET /api/my/membership/:id — Get a single membership (for badge page)
router.get('/membership/:id', requireAuth, controller.getMembership);

module.exports = router;
