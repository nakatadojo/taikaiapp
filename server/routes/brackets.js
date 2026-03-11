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

router.delete('/:id/brackets/:bracketId',
  requireAuth, requireTournamentOwner,
  c.deleteBracket
);

module.exports = router;
