const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireTournamentOwner } = require('../middleware/tournamentOwner');
const { requireTournamentPermission } = require('../middleware/tournamentPermission');
const c = require('../controllers/bracketsController');

const router = express.Router();

// Staff can read brackets (for scoreboard operation)
router.get('/:id/brackets',
  requireAuth, requireTournamentPermission('read_data'),
  c.getBrackets
);

// Public-readable: returns whether any brackets have started (for registration warning)
// Must come before :bracketId param routes
router.get('/:id/brackets/started',
  c.getBracketsStartedStatus
);

router.post('/:id/brackets/sync',
  requireAuth, requireTournamentOwner,
  c.syncBrackets
);

// publish-all must come before :bracketId param routes
router.put('/:id/brackets/publish-all',
  requireAuth, requireTournamentOwner,
  c.setAllBracketsPublished
);

router.put('/:id/brackets/:bracketId/publish',
  requireAuth, requireTournamentOwner,
  c.setBracketPublished
);

// Single-bracket read (public — needed for display polling)
router.get('/:id/brackets/:bracketId',
  requireAuth, requireTournamentPermission('read_data'),
  c.getSingleBracket
);

// Single-bracket write (immediate, avoids bulk-sync race condition)
router.put('/:id/brackets/:bracketId',
  requireAuth, requireTournamentOwner,
  c.upsertSingleBracket
);

router.delete('/:id/brackets/:bracketId',
  requireAuth, requireTournamentOwner,
  c.deleteBracket
);

// Reset bracket — wipe scores/results, keep structure
router.post('/:id/brackets/:bracketId/reset',
  requireAuth, requireTournamentOwner,
  c.resetBracket
);

module.exports = router;
