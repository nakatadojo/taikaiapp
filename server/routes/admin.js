const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const adminController = require('../controllers/adminController');
const discountController = require('../controllers/discountController');

const router = express.Router();

// All admin routes require authentication + admin or super_admin role
router.use(requireAuth, requireRole('admin', 'super_admin'));

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

// DELETE /api/admin/users/:id — Permanently delete a user account
router.delete('/users/:id',
  adminController.deleteUser
);

// POST /api/admin/users/:id/reset-password — Force-reset a user's password
router.post('/users/:id/reset-password',
  [
    body('newPassword').notEmpty().withMessage('newPassword is required'),
  ],
  validate,
  adminController.resetUserPassword
);

// ── Discount Codes ───────────────────────────────────────────────────────────

// POST /api/admin/discount-codes — Create discount code
router.post('/discount-codes',
  [
    body('code').trim().notEmpty().withMessage('Code is required'),
    body('type').isIn(['percentage', 'fixed']).withMessage('Type must be percentage or fixed'),
    body('value').isFloat({ min: 0 }).withMessage('Value must be a positive number'),
    body('maxUses').optional({ nullable: true }).isInt({ min: 1 }),
    body('expiresAt').optional({ nullable: true }).isISO8601(),
    body('active').optional().isBoolean(),
    body('tournamentId').optional({ nullable: true }).isUUID(),
  ],
  validate,
  discountController.createDiscount
);

// GET /api/admin/discount-codes — List all discount codes
router.get('/discount-codes', discountController.getDiscounts);

// PUT /api/admin/discount-codes/:id — Update discount code
router.put('/discount-codes/:id',
  [
    body('code').optional().trim().notEmpty(),
    body('type').optional().isIn(['percentage', 'fixed']),
    body('value').optional().isFloat({ min: 0 }),
    body('maxUses').optional({ nullable: true }),
    body('expiresAt').optional({ nullable: true }),
    body('active').optional().isBoolean(),
    body('tournamentId').optional({ nullable: true }),
  ],
  validate,
  discountController.updateDiscount
);

// DELETE /api/admin/discount-codes/:id — Delete discount code
router.delete('/discount-codes/:id', discountController.deleteDiscount);

module.exports = router;
