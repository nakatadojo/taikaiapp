const CustomTabsQueries = require('../db/queries/customTabs');
const pool = require('../db/pool');

/**
 * GET /api/tournaments/:id/custom-tabs
 * Public: get visible custom tabs. Director: get all.
 */
async function getCustomTabs(req, res, next) {
  try {
    const { id: tournamentId } = req.params;

    // If authenticated director, return all tabs; otherwise only visible
    if (req.user) {
      const t = await pool.query('SELECT created_by FROM tournaments WHERE id = $1', [tournamentId]);
      if (t.rows[0] && t.rows[0].created_by === req.user.id) {
        const tabs = await CustomTabsQueries.getByTournament(tournamentId);
        return res.json({ tabs });
      }
    }

    const tabs = await CustomTabsQueries.getVisibleByTournament(tournamentId);
    res.json({ tabs });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/tournaments/:id/custom-tabs
 */
async function createCustomTab(req, res, next) {
  try {
    const { id: tournamentId } = req.params;
    const { tabName, tabOrder, contentHtml, visible } = req.body;

    if (!tabName) return res.status(400).json({ error: 'tabName is required' });

    const tab = await CustomTabsQueries.create({ tournamentId, tabName, tabOrder, contentHtml, visible });
    res.status(201).json({ tab });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/tournaments/:id/custom-tabs/:tabId
 */
async function updateCustomTab(req, res, next) {
  try {
    const { tabId } = req.params;
    const tab = await CustomTabsQueries.update(tabId, req.body);
    if (!tab) return res.status(404).json({ error: 'Tab not found' });
    res.json({ tab });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/tournaments/:id/custom-tabs/:tabId
 */
async function deleteCustomTab(req, res, next) {
  try {
    const { tabId } = req.params;
    const result = await CustomTabsQueries.delete(tabId);
    if (!result) return res.status(404).json({ error: 'Tab not found' });
    res.json({ message: 'Tab deleted' });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/tournaments/:id/custom-tabs/reorder
 * Body: { orderedIds: [uuid, uuid, ...] }
 */
async function reorderCustomTabs(req, res, next) {
  try {
    const { id: tournamentId } = req.params;
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds array required' });

    await CustomTabsQueries.reorder(tournamentId, orderedIds);
    const tabs = await CustomTabsQueries.getByTournament(tournamentId);
    res.json({ tabs });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/tournaments/:id/section-visibility
 * Body: { visibility: { competitors: bool, divisions: bool, brackets: bool, schedule: bool, hideCompetitorCount: bool } }
 */
async function updateSectionVisibility(req, res, next) {
  try {
    const { id: tournamentId } = req.params;
    const { visibility } = req.body;

    if (!visibility || typeof visibility !== 'object') {
      return res.status(400).json({ error: 'visibility object is required' });
    }

    await pool.query(
      'UPDATE tournaments SET section_visibility = $1 WHERE id = $2',
      [JSON.stringify(visibility), tournamentId]
    );

    res.json({ visibility });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCustomTabs,
  createCustomTab,
  updateCustomTab,
  deleteCustomTab,
  reorderCustomTabs,
  updateSectionVisibility,
};
