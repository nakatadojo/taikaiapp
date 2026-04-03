const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireTournamentOwner } = require('../middleware/tournamentOwner');
const c = require('../controllers/leaderboardController');

const router = express.Router();

// ── Public endpoints ─────────────────────────────────────────────────────────
// Individual competitor leaderboard
router.get('/:id/leaderboard', c.getLeaderboard);

// Club / academy medal tally
router.get('/:id/leaderboard/clubs', c.getClubTally);

// ── Director endpoints (auth required) ──────────────────────────────────────
router.get('/:id/leaderboard/rules',
  requireAuth,
  requireTournamentOwner,
  c.getRules
);

router.put('/:id/leaderboard/rules',
  requireAuth,
  requireTournamentOwner,
  c.setRules
);

module.exports = router;
