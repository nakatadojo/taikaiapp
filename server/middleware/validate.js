const { validationResult } = require('express-validator');

/**
 * Express middleware that checks for validation errors from express-validator.
 * Returns 400 with error details if validation fails.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

module.exports = { validate };
