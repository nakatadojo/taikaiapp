const discountQueries = require('../db/queries/discounts');

/**
 * POST /api/admin/discount-codes
 * Create a discount code (admin only).
 */
async function createDiscount(req, res, next) {
  try {
    const { code, type, value, maxUses, expiresAt, active, tournamentId } = req.body;

    // Check for duplicate code
    const existing = await discountQueries.findByCode(code);
    if (existing) {
      return res.status(409).json({ error: 'A discount code with this name already exists' });
    }

    const discount = await discountQueries.create({
      code, type, value, maxUses, expiresAt, active, tournamentId,
      createdBy: req.user.id,
    });

    res.status(201).json({ discount });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/discount-codes
 * List all discount codes (admin only).
 */
async function getDiscounts(req, res, next) {
  try {
    const discounts = await discountQueries.getAll();
    res.json({ discounts });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/admin/discount-codes/:id
 * Update a discount code (admin only).
 */
async function updateDiscount(req, res, next) {
  try {
    const { code, type, value, maxUses, expiresAt, active, tournamentId } = req.body;

    const updates = {};
    if (code !== undefined) updates.code = code;
    if (type !== undefined) updates.type = type;
    if (value !== undefined) updates.value = value;
    if (maxUses !== undefined) updates.max_uses = maxUses;
    if (expiresAt !== undefined) updates.expires_at = expiresAt;
    if (active !== undefined) updates.active = active;
    if (tournamentId !== undefined) updates.tournament_id = tournamentId;

    const discount = await discountQueries.update(req.params.id, updates);
    if (!discount) {
      return res.status(404).json({ error: 'Discount code not found' });
    }

    res.json({ discount });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/admin/discount-codes/:id
 * Delete a discount code (admin only).
 */
async function deleteDiscount(req, res, next) {
  try {
    const result = await discountQueries.remove(req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Discount code not found' });
    }
    res.json({ message: 'Discount code deleted' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/registrations/validate-discount
 * Validate a discount code (any authenticated user).
 */
async function validateDiscount(req, res, next) {
  try {
    const { code, tournamentId } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Discount code is required' });
    }

    const result = await discountQueries.validate(code, tournamentId);

    if (!result.valid) {
      return res.status(400).json({ error: result.error });
    }

    const { discount } = result;
    res.json({
      valid: true,
      discount: {
        id: discount.id,
        code: discount.code,
        type: discount.type,
        value: parseFloat(discount.value),
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createDiscount,
  getDiscounts,
  updateDiscount,
  deleteDiscount,
  validateDiscount,
};
