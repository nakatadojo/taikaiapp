const pool = require('../db/pool');
const DivisionQueries = require('../db/queries/divisions');
const { runAutoAssign } = require('../services/divisionAutoAssign');

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
    const isSuperAdmin = (req.user.roles || []).includes('super_admin');
    if (!isSuperAdmin && t.rows[0].created_by !== req.user.id) {
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
    const isSuperAdmin = (req.user.roles || []).includes('super_admin');
    if (!isSuperAdmin && t.rows[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Ensure every template has a stable UUID so the client can identify it for editing
    const { randomUUID } = require('crypto');
    const templatesWithIds = (criteriaTemplates || []).map(tmpl =>
      tmpl.id ? tmpl : { ...tmpl, id: randomUUID() }
    );

    const result = await DivisionQueries.upsertTemplates(eventId, templatesWithIds);
    res.json({ criteriaTemplates: result?.criteria_templates || [] });
  } catch (err) { next(err); }
}

/**
 * POST /api/tournaments/:id/divisions/auto-assign
 * Run server-side division assignment and broadcast to all connected devices.
 */
async function autoAssignDivisions(req, res, next) {
  try {
    const tournamentId = req.params.id;

    const t = await pool.query('SELECT created_by FROM tournaments WHERE id = $1', [tournamentId]);
    if (!t.rows[0]) return res.status(404).json({ error: 'Tournament not found' });
    const isSuperAdmin = (req.user.roles || []).includes('super_admin');
    if (!isSuperAdmin && t.rows[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const generatedDivisions = await runAutoAssign(tournamentId);
    res.json({ generatedDivisions });
  } catch (err) { next(err); }
}

async function syncTree(req, res, next) {
  try {
    const tournamentId = req.params.id;
    const { eventId } = req.params;
    const { tree } = req.body;

    const t = await pool.query('SELECT created_by FROM tournaments WHERE id = $1', [tournamentId]);
    if (!t.rows[0]) return res.status(404).json({ error: 'Tournament not found' });
    const isSuperAdmin = (req.user.roles || []).includes('super_admin');
    if (!isSuperAdmin && t.rows[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const result = await DivisionQueries.upsertTree(eventId, tree || null);
    res.json({ tree: result?.division_tree || null });
  } catch (err) { next(err); }
}

async function getTree(req, res, next) {
  try {
    const { eventId } = req.params;
    const tree = await DivisionQueries.getTree(eventId);
    res.json({ tree });
  } catch (err) { next(err); }
}

module.exports = { getDivisions, syncDivisions, syncTemplates, autoAssignDivisions, getTree, syncTree };
