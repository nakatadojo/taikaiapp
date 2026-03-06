const pool = require('../db/pool');
const SponsorQueries = require('../db/queries/sponsors');

/**
 * Helper: verify the authenticated user owns the tournament.
 * Returns the tournament row or sends an error response.
 */
async function verifyOwnership(req, res) {
  const tournamentId = req.params.id;
  const t = await pool.query('SELECT created_by FROM tournaments WHERE id = $1', [tournamentId]);
  if (!t.rows[0]) {
    res.status(404).json({ error: 'Tournament not found' });
    return null;
  }
  if (t.rows[0].created_by !== req.user.id) {
    res.status(403).json({ error: 'Not authorized' });
    return null;
  }
  return t.rows[0];
}

/**
 * POST /api/tournaments/:id/sponsors
 * Create a new sponsor.
 */
async function createSponsor(req, res, next) {
  try {
    const owner = await verifyOwnership(req, res);
    if (!owner) return;

    const { name, logo_url, description, website_url, category, discount_code, display_order, visible } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Sponsor name is required' });
    }

    const validCategories = ['hotel', 'restaurant', 'dojo', 'sponsor', 'other'];
    if (category && !validCategories.includes(category)) {
      return res.status(400).json({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
    }

    const sponsor = await SponsorQueries.create(req.params.id, {
      name: name.trim(),
      logo_url,
      description,
      website_url,
      category,
      discount_code,
      display_order,
      visible,
    });

    res.status(201).json({ sponsor });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tournaments/:id/sponsors
 * List all sponsors for a tournament (director view, includes hidden).
 */
async function getSponsors(req, res, next) {
  try {
    const owner = await verifyOwnership(req, res);
    if (!owner) return;

    const sponsors = await SponsorQueries.getByTournament(req.params.id);
    res.json({ sponsors });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tournaments/:id/sponsors/public
 * List visible sponsors (public, no auth).
 */
async function getPublicSponsors(req, res, next) {
  try {
    const tournamentId = req.params.id;

    // Verify the tournament exists
    const t = await pool.query('SELECT id FROM tournaments WHERE id = $1', [tournamentId]);
    if (!t.rows[0]) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const sponsors = await SponsorQueries.getVisibleByTournament(tournamentId);
    res.json({ sponsors });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/tournaments/:id/sponsors/:sponsorId
 * Update a sponsor.
 */
async function updateSponsor(req, res, next) {
  try {
    const owner = await verifyOwnership(req, res);
    if (!owner) return;

    const { sponsorId } = req.params;
    const { name, logo_url, description, website_url, category, discount_code, display_order, visible } = req.body;

    const validCategories = ['hotel', 'restaurant', 'dojo', 'sponsor', 'other'];
    if (category && !validCategories.includes(category)) {
      return res.status(400).json({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
    }

    const sponsor = await SponsorQueries.update(sponsorId, {
      name,
      logo_url,
      description,
      website_url,
      category,
      discount_code,
      display_order,
      visible,
    });

    if (!sponsor) {
      return res.status(404).json({ error: 'Sponsor not found' });
    }

    res.json({ sponsor });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/tournaments/:id/sponsors/:sponsorId
 * Remove a sponsor.
 */
async function deleteSponsor(req, res, next) {
  try {
    const owner = await verifyOwnership(req, res);
    if (!owner) return;

    const result = await SponsorQueries.remove(req.params.sponsorId);
    if (!result) {
      return res.status(404).json({ error: 'Sponsor not found' });
    }

    res.json({ message: 'Sponsor deleted' });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/tournaments/:id/sponsors/reorder
 * Update display_order for all sponsors.
 * Body: { orderedIds: [uuid, uuid, ...] }
 */
async function reorderSponsors(req, res, next) {
  try {
    const owner = await verifyOwnership(req, res);
    if (!owner) return;

    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'orderedIds array required' });
    }

    await SponsorQueries.reorder(req.params.id, orderedIds);
    const sponsors = await SponsorQueries.getByTournament(req.params.id);
    res.json({ sponsors });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/tournaments/:id/sponsors/:sponsorId/toggle
 * Toggle visible flag for a sponsor.
 */
async function toggleSponsorVisibility(req, res, next) {
  try {
    const owner = await verifyOwnership(req, res);
    if (!owner) return;

    const sponsor = await SponsorQueries.toggleVisibility(req.params.sponsorId);
    if (!sponsor) {
      return res.status(404).json({ error: 'Sponsor not found' });
    }

    res.json({ sponsor });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createSponsor,
  getSponsors,
  getPublicSponsors,
  updateSponsor,
  deleteSponsor,
  reorderSponsors,
  toggleSponsorVisibility,
};
