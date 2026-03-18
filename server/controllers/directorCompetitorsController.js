const DirectorCompetitorQueries = require('../db/queries/directorCompetitors');
const { broadcastCompetitorUpdate } = require('../websocket');
const tournamentQueries = require('../db/queries/tournaments');

async function getCompetitors(req, res, next) {
  try {
    const competitors = await DirectorCompetitorQueries.getAll(req.params.id);
    res.json({ competitors });
  } catch (err) { next(err); }
}

async function addCompetitor(req, res, next) {
  try {
    const tournamentId = req.params.id;
    // Ownership check
    const owned = await tournamentQueries.isOwnedBy(tournamentId, req.user.id);
    if (!owned) return res.status(403).json({ error: 'You do not own this tournament' });

    const { competitor, is_test } = req.body;
    if (!competitor || typeof competitor !== 'object') {
      return res.status(400).json({ error: 'competitor object is required' });
    }

    const created = await DirectorCompetitorQueries.create(tournamentId, competitor, is_test || false);
    broadcastCompetitorUpdate(tournamentId, 'add', created);
    res.status(201).json({ competitor: created });
  } catch (err) { next(err); }
}

async function updateCompetitor(req, res, next) {
  try {
    const { id: tournamentId, competitorId } = req.params;
    const owned = await tournamentQueries.isOwnedBy(tournamentId, req.user.id);
    if (!owned) return res.status(403).json({ error: 'You do not own this tournament' });

    const { competitor } = req.body;
    if (!competitor || typeof competitor !== 'object') {
      return res.status(400).json({ error: 'competitor object is required' });
    }

    const updated = await DirectorCompetitorQueries.update(competitorId, tournamentId, competitor);
    if (!updated) return res.status(404).json({ error: 'Competitor not found' });

    broadcastCompetitorUpdate(tournamentId, 'update', updated);
    res.json({ competitor: updated });
  } catch (err) { next(err); }
}

async function deleteCompetitor(req, res, next) {
  try {
    const { id: tournamentId, competitorId } = req.params;
    const owned = await tournamentQueries.isOwnedBy(tournamentId, req.user.id);
    if (!owned) return res.status(403).json({ error: 'You do not own this tournament' });

    const deleted = await DirectorCompetitorQueries.remove(competitorId, tournamentId);
    if (!deleted) return res.status(404).json({ error: 'Competitor not found' });

    broadcastCompetitorUpdate(tournamentId, 'delete', { id: competitorId });
    res.json({ message: 'Competitor deleted', id: competitorId });
  } catch (err) { next(err); }
}

module.exports = { getCompetitors, addCompetitor, updateCompetitor, deleteCompetitor };
