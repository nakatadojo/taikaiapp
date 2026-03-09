const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireTournamentOwner } = require('../middleware/tournamentOwner');
const c = require('../controllers/discountCodeController');

const router = express.Router();

// Public — validate a code (no auth — called during public registration)
router.post('/:id/discount-codes/validate', c.validate);

// Director — manage codes
router.get('/:id/discount-codes', requireAuth, requireTournamentOwner, c.list);
router.post('/:id/discount-codes', requireAuth, requireTournamentOwner, c.create);
router.put('/:id/discount-codes/:cid', requireAuth, requireTournamentOwner, c.update);
router.delete('/:id/discount-codes/:cid', requireAuth, requireTournamentOwner, c.remove);

module.exports = router;
