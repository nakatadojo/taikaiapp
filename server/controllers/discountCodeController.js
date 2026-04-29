const DiscountCodeQueries = require('../db/queries/discountCodes');

/**
 * GET /api/tournaments/:id/discount-codes
 * Director only — list all codes for the tournament.
 */
async function list(req, res, next) {
  try {
    const codes = await DiscountCodeQueries.getByTournament(req.params.id);
    res.json({ codes });
  } catch (err) { next(err); }
}

/**
 * POST /api/tournaments/:id/discount-codes/validate
 * Public — validate a code and return the discount info (without redeeming it).
 * Body: { code }
 */
async function validate(req, res, next) {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'code is required' });

    const dc = await DiscountCodeQueries.validate(req.params.id, code);
    if (!dc) {
      return res.status(404).json({ error: 'Invalid or expired discount code' });
    }

    res.json({
      valid: true,
      id: dc.id,
      code: dc.code,
      description: dc.description,
      discount_type: dc.discount_type,   // 'percentage' | 'flat'
      discount_value: parseFloat(dc.discount_value),
      scope: dc.scope,                   // 'total' | 'event'
      event_id: dc.event_id,
      event_name: dc.event_name,
    });
  } catch (err) { next(err); }
}

/**
 * POST /api/tournaments/:id/discount-codes
 * Director only — create a discount code.
 */
async function create(req, res, next) {
  try {
    const { code, description, discount_type, discount_value, scope, event_id, max_uses, valid_from, valid_until } = req.body;

    if (!code || !discount_type || discount_value == null) {
      return res.status(400).json({ error: 'code, discount_type, and discount_value are required' });
    }
    if (!['percentage', 'flat'].includes(discount_type)) {
      return res.status(400).json({ error: 'discount_type must be "percentage" or "flat"' });
    }
    if (discount_type === 'percentage' && (discount_value <= 0 || discount_value > 100)) {
      return res.status(400).json({ error: 'Percentage discount must be between 1 and 100' });
    }
    if (scope === 'event' && !event_id) {
      return res.status(400).json({ error: 'event_id is required when scope is "event"' });
    }

    const dc = await DiscountCodeQueries.create(req.params.id, req.body);
    res.status(201).json({ code: dc });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A discount code with that name already exists for this tournament' });
    }
    next(err);
  }
}

/**
 * PUT /api/tournaments/:id/discount-codes/:cid
 * Director only — update a discount code.
 */
async function update(req, res, next) {
  try {
    const dc = await DiscountCodeQueries.update(req.params.cid, req.body);
    if (!dc) return res.status(404).json({ error: 'Discount code not found' });
    res.json({ code: dc });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A discount code with that name already exists' });
    }
    next(err);
  }
}

/**
 * DELETE /api/tournaments/:id/discount-codes/:cid
 * Director only — delete a discount code.
 */
async function remove(req, res, next) {
  try {
    const deleted = await DiscountCodeQueries.delete(req.params.cid);
    if (!deleted) return res.status(404).json({ error: 'Discount code not found' });
    res.json({ message: 'Discount code deleted' });
  } catch (err) { next(err); }
}

module.exports = { validate };
