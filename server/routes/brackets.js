const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireTournamentOwner } = require('../middleware/tournamentOwner');
const c = require('../controllers/bracketsController');

const router = express.Router();

router.get('/:id/brackets',
  requireAuth, requireTournamentOwner,
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
