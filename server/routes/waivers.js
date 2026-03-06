const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const waiverController = require('../controllers/waiverController');

const router = express.Router();

// ── AUTH routes (specific paths — must come BEFORE :token wildcard) ──────────

// GET /api/waivers/coach/all — Get all waivers created by the logged-in coach
router.get('/coach/all', requireAuth, waiverController.getCoachWaivers);

// GET /api/waivers/registration/:registrationId — Get waivers for a registration
router.get('/registration/:registrationId', requireAuth, waiverController.getWaiversForRegistration);

// ── PUBLIC routes (token-based, no auth) ────────────────────────────────────

// GET /api/waivers/:token — Get waiver details for signing page
router.get('/:token', waiverController.getWaiverByToken);

// POST /api/waivers/:token/sign — Sign a waiver
router.post('/:token/sign',
  [
    body('parentName').trim().notEmpty().withMessage('Your full name is required'),
  ],
  validate,
  waiverController.signWaiver
);

module.exports = router;
