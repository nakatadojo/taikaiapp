const pool = require('../db/pool');
const BracketQueries = require('../db/queries/brackets');

async function getBrackets(req, res, next) {
  try {
    const rows = await BracketQueries.getAll(req.params.id);
    const byId = {};
    for (const b of rows) { byId[b.id] = b.data; }
    res.json({ brackets: byId });
  } catch (err) { next(err); }
}

async function syncBrackets(req, res, next) {
  try {
    const tournamentId = req.params.id;
    const { brackets } = req.body;

    const t = await pool.query('SELECT created_by FROM tournaments WHERE id = $1', [tournamentId]);
    if (!t.rows[0]) return res.status(404).json({ error: 'Tournament not found' });
    if (t.rows[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const bracketArray = Object.values(brackets || {});
    if (bracketArray.length === 0) return res.json({ message: 'No brackets to sync', count: 0 });

    const results = await BracketQueries.bulkUpsert(tournamentId, bracketArray);
    res.json({ message: `Synced ${results.length} bracket(s)`, count: results.length });
  } catch (err) { next(err); }
}

async function deleteBracket(req, res, next) {
  try {
    const tournamentId = req.params.id;
    const { bracketId } = req.params;

    const t = await pool.query('SELECT created_by FROM tournaments WHERE id = $1', [tournamentId]);
    if (!t.rows[0]) return res.status(404).json({ error: 'Tournament not found' });
    if (t.rows[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const deleted = await BracketQueries.remove(tournamentId, bracketId);
    if (!deleted) return res.status(404).json({ error: 'Bracket not found' });
    res.json({ message: 'Bracket deleted', id: deleted.id });
  } catch (err) { next(err); }
}

async function setBracketPublished(req, res, next) {
  try {
    const tournamentId = req.params.id;
    const { bracketId } = req.params;
    const { published } = req.body;

    const t = await pool.query('SELECT created_by FROM tournaments WHERE id = $1', [tournamentId]);
    if (!t.rows[0]) return res.status(404).json({ error: 'Tournament not found' });
    if (t.rows[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const result = await BracketQueries.setPublished(tournamentId, bracketId, !!published);
    if (!result) return res.status(404).json({ error: 'Bracket not found' });
    res.json(result);
  } catch (err) { next(err); }
}

async function setAllBracketsPublished(req, res, next) {
  try {
    const tournamentId = req.params.id;
    const { published } = req.body;

    const t = await pool.query('SELECT created_by FROM tournaments WHERE id = $1', [tournamentId]);
    if (!t.rows[0]) return res.status(404).json({ error: 'Tournament not found' });
    if (t.rows[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const results = await BracketQueries.setAllPublished(tournamentId, !!published);
    res.json({ message: `Updated ${results.length} bracket(s)`, count: results.length });
  } catch (err) { next(err); }
}

module.exports = { getBrackets, syncBrackets, deleteBracket, setBracketPublished, setAllBracketsPublished };
