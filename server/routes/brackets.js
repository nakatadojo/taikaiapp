const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const c = require('../controllers/bracketsController');

const router = express.Router();

router.get('/:id/brackets',
  requireAuth, requireRole('event_director', 'admin', 'super_admin'),
  c.getBrackets
);

router.post('/:id/brackets/sync',
  requireAuth, requireRole('event_director', 'admin', 'super_admin'),
  c.syncBrackets
);

// publish-all must come before :bracketId param routes
router.put('/:id/brackets/publish-all',
  requireAuth, requireRole('event_director', 'admin', 'super_admin'),
  c.setAllBracketsPublished
);

router.put('/:id/brackets/:bracketId/publish',
  requireAuth, requireRole('event_director', 'admin', 'super_admin'),
  c.setBracketPublished
);

router.delete('/:id/brackets/:bracketId',
  requireAuth, requireRole('event_director', 'admin', 'super_admin'),
  c.deleteBracket
);

module.exports = router;
