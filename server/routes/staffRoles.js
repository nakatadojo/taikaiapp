const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireTournamentOwner, requireTournamentCreator } = require('../middleware/tournamentOwner');
const controller = require('../controllers/staffRoleController');

const router = express.Router();

// Staff role definitions — director-only (requireTournamentCreator enforces owner, not just any staff)
router.get('/:id/staff-roles',
  requireAuth,
  requireTournamentOwner,
  requireTournamentCreator,
  controller.list
);

router.post('/:id/staff-roles',
  requireAuth,
  requireTournamentOwner,
  requireTournamentCreator,
  controller.create
);

router.put('/:id/staff-roles/:roleId',
  requireAuth,
  requireTournamentOwner,
  requireTournamentCreator,
  controller.update
);

router.delete('/:id/staff-roles/:roleId',
  requireAuth,
  requireTournamentOwner,
  requireTournamentCreator,
  controller.remove
);

// Member role assignment — director-only
router.put('/:id/members/:memberId/assign-role',
  requireAuth,
  requireTournamentOwner,
  requireTournamentCreator,
  controller.assignRole
);

router.get('/:id/members-with-roles',
  requireAuth,
  requireTournamentOwner,
  requireTournamentCreator,
  controller.listMembersWithRoles
);

module.exports = router;
