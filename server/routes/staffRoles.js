const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireTournamentOwner } = require('../middleware/tournamentOwner');
const controller = require('../controllers/staffRoleController');

const router = express.Router();

// Staff role definitions
router.get('/:id/staff-roles',
  requireAuth,
  requireTournamentOwner,
  controller.list
);

router.post('/:id/staff-roles',
  requireAuth,
  requireTournamentOwner,
  controller.create
);

router.put('/:id/staff-roles/:roleId',
  requireAuth,
  requireTournamentOwner,
  controller.update
);

router.delete('/:id/staff-roles/:roleId',
  requireAuth,
  requireTournamentOwner,
  controller.remove
);

// Member role assignment
router.put('/:id/members/:memberId/assign-role',
  requireAuth,
  requireTournamentOwner,
  controller.assignRole
);

router.get('/:id/members-with-roles',
  requireAuth,
  requireTournamentOwner,
  controller.listMembersWithRoles
);

module.exports = router;
