const PricingPeriodQueries = require('../db/queries/pricingPeriods');
const pool = require('../db/pool');

/**
 * GET /api/tournaments/:id/pricing-periods
 * Public — returns all pricing periods for a tournament.
 */
async function list(req, res, next) {
  try {
    const periods = await PricingPeriodQueries.getByTournament(req.params.id);
    const active = await PricingPeriodQueries.getActivePeriod(req.params.id);
    res.json({ periods, activeId: active ? active.id : null });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/tournaments/:id/pricing-periods
 * Director — create a new pricing period.
 */
async function create(req, res, next) {
  try {
    const { id: tournamentId } = req.params;
    const { name, start_date, end_date, base_event_price, addon_event_price } = req.body;

    if (!name || !start_date || !end_date || base_event_price == null || addon_event_price == null) {
      return res.status(400).json({ error: 'All fields are required: name, start_date, end_date, base_event_price, addon_event_price' });
    }

    if (new Date(end_date) <= new Date(start_date)) {
      return res.status(400).json({ error: 'end_date must be after start_date' });
    }

    const period = await PricingPeriodQueries.create(tournamentId, req.body);
    res.status(201).json({ period });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/tournaments/:id/pricing-periods/:pid
 * Director — update a pricing period.
 */
async function update(req, res, next) {
  try {
    const { pid } = req.params;
    const { start_date, end_date } = req.body;

    if (start_date && end_date && new Date(end_date) <= new Date(start_date)) {
      return res.status(400).json({ error: 'end_date must be after start_date' });
    }

    const period = await PricingPeriodQueries.update(pid, req.body);
    if (!period) return res.status(404).json({ error: 'Pricing period not found' });
    res.json({ period });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/tournaments/:id/pricing-periods/:pid
 * Director — delete a pricing period.
 */
async function remove(req, res, next) {
  try {
    const deleted = await PricingPeriodQueries.delete(req.params.pid);
    if (!deleted) return res.status(404).json({ error: 'Pricing period not found' });
    res.json({ message: 'Pricing period deleted' });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/tournaments/:id/pricing-periods/bulk
 * Director — replace all pricing periods (used by wizard save).
 */
async function bulkReplace(req, res, next) {
  try {
    const { id: tournamentId } = req.params;
    const { periods } = req.body;

    if (!Array.isArray(periods)) {
      return res.status(400).json({ error: 'periods array is required' });
    }

    // Validate each period
    for (const p of periods) {
      if (!p.name || !p.start_date || !p.end_date || p.base_event_price == null || p.addon_event_price == null) {
        return res.status(400).json({ error: `Invalid period: ${p.name || 'unnamed'} — all fields required` });
      }
      if (new Date(p.end_date) <= new Date(p.start_date)) {
        return res.status(400).json({ error: `Invalid date range for period: ${p.name}` });
      }
    }

    const results = await PricingPeriodQueries.bulkReplace(tournamentId, periods);
    res.json({ periods: results });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove, bulkReplace };
