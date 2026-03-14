const express = require('express');
const { validate } = require('../controllers/discountCodeController');

const router = express.Router();

// Public — validate a code (no auth — called during public registration)
router.post('/:id/discount-codes/validate', validate);

module.exports = router;
