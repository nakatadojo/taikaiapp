const pool = require('../db/pool');
const DivisionQueries = require('../db/queries/divisions');

async function getDivisions(req, res, next) {
  try {
    const generatedDivisions = await DivisionQueries.get(req.params.id);
    res.json({ generatedDivisions });
  } catch (err) { next(err); }
}

async function syncDivisions(req, res, next) {
  try {
    const tournamentId = req.params.id;
    const { generatedDivisions } = req.body;

    const t = await pool.query('SELECT created_by FROM tournaments WHERE id = $1', [tournamentId]);
    if (!t.rows[0]) return res.status(404).json({ error: 'Tournament not found' });
    if (t.rows[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await DivisionQueries.upsert(tournamentId, generatedDivisions);
    res.json({ message: 'Divisions saved' });
  } catch (err) { next(err); }
}

async function syncTemplates(req, res, next) {
  try {
    const tournamentId = req.params.id;
    const { eventId } = req.params;
    const { criteriaTemplates } = req.body;

    const t = await pool.query('SELECT created_by FROM tournaments WHERE id = $1', [tournamentId]);
    if (!t.rows[0]) return res.status(404).json({ error: 'Tournament not found' });
    if (t.rows[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const result = await DivisionQueries.upsertTemplates(eventId, criteriaTemplates);
    res.json({ criteriaTemplates: result?.criteria_templates || [] });
  } catch (err) { next(err); }
}

module.exports = { getDivisions, syncDivisions, syncTemplates };
