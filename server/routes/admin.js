const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const adminController = require('../controllers/adminController');

const router = express.Router();

// All admin routes require authentication + admin role
router.use(requireAuth, requireRole('admin'));

// POST /api/admin/users/:id/roles — Add role to user
router.post('/users/:id/roles',
  [
    body('role').notEmpty().withMessage('Role is required'),
  ],
  validate,
  adminController.addUserRole
);

// DELETE /api/admin/users/:id/roles/:role — Remove role from user
router.delete('/users/:id/roles/:role',
  adminController.removeUserRole
);

module.exports = router;
