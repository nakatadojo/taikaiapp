const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const controller = require('../controllers/staffRoleController');

const router = express.Router();

// Staff role definitions
router.get('/:id/staff-roles',
  requireAuth,
  requireRole('event_director', 'admin', 'super_admin'),
  controller.list
);

router.post('/:id/staff-roles',
  requireAuth,
  requireRole('event_director', 'admin', 'super_admin'),
  controller.create
);

router.put('/:id/staff-roles/:roleId',
  requireAuth,
  requireRole('event_director', 'admin', 'super_admin'),
  controller.update
);

router.delete('/:id/staff-roles/:roleId',
  requireAuth,
  requireRole('event_director', 'admin', 'super_admin'),
  controller.remove
);

// Member role assignment
router.put('/:id/members/:memberId/assign-role',
  requireAuth,
  requireRole('event_director', 'admin', 'super_admin'),
  controller.assignRole
);

router.get('/:id/members-with-roles',
  requireAuth,
  requireRole('event_director', 'admin', 'super_admin'),
  controller.listMembersWithRoles
);

module.exports = router;
