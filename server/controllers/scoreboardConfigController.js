const ScoreboardConfigQueries = require('../db/queries/scoreboardConfig');

async function getConfig(req, res, next) {
  try {
    const { id: tournamentId } = req.params;
    const row = await ScoreboardConfigQueries.getByTournament(tournamentId);
    res.json({ config: row ? row.config : null });
  } catch (err) {
    next(err);
  }
}

async function saveConfig(req, res, next) {
  try {
    const { id: tournamentId } = req.params;
    const { config } = req.body;

    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'config object is required' });
    }

    const row = await ScoreboardConfigQueries.upsert(tournamentId, config);
    res.json({ message: 'Scoreboard config saved', config: row.config });
  } catch (err) {
    next(err);
  }
}

module.exports = { getConfig, saveConfig };
