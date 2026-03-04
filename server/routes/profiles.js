const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const profileController = require('../controllers/profileController');

const router = express.Router();

// All profile routes require authentication
router.use(requireAuth);

// GET /api/profiles — Get all profiles for logged-in user
router.get('/', profileController.getProfiles);

// POST /api/profiles — Create a competitor profile
router.post('/',
  [
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('dateOfBirth').isISO8601().withMessage('Valid date of birth is required'),
    body('gender').isIn(['male', 'female']).withMessage('Gender must be male or female'),
    body('beltRank').optional().trim(),
    body('experienceLevel').optional().isIn(['beginner', 'novice', 'intermediate', 'advanced']),
    body('weight').optional().isFloat({ min: 0 }).withMessage('Weight must be a positive number'),
    body('academyName').optional().trim(),
    body('isSelf').optional().isBoolean(),
  ],
  validate,
  profileController.createProfile
);

// PUT /api/profiles/:id — Update a profile
router.put('/:id',
  [
    body('firstName').optional().trim().notEmpty(),
    body('lastName').optional().trim().notEmpty(),
    body('dateOfBirth').optional().isISO8601(),
    body('gender').optional().isIn(['male', 'female']),
    body('beltRank').optional(),
    body('experienceLevel').optional(),
    body('weight').optional(),
    body('academyName').optional(),
  ],
  validate,
  profileController.updateProfile
);

// DELETE /api/profiles/:id — Delete a profile
router.delete('/:id', profileController.deleteProfile);

module.exports = router;
