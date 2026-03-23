const pool = require('../db/pool');

// ── Shared ownership check ────────────────────────────────────────────────────

async function verifyOwner(req, res) {
  const { rows } = await pool.query(
    'SELECT id, created_by FROM tournaments WHERE id = $1',
    [req.params.id]
  );
  if (!rows[0]) { res.status(404).json({ error: 'Tournament not found' }); return null; }
  const isSuperAdmin = (req.user.roles || []).includes('super_admin');
  if (!isSuperAdmin && rows[0].created_by !== req.user.id) {
    res.status(403).json({ error: 'Not authorized' }); return null;
  }
  return rows[0];
}

// ── Mats Config ───────────────────────────────────────────────────────────────

async function getMats(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT mats_config FROM tournaments WHERE id = $1',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Tournament not found' });
    res.json({ mats: rows[0].mats_config || [] });
  } catch (err) { next(err); }
}

async function syncMats(req, res, next) {
  try {
    const t = await verifyOwner(req, res);
    if (!t) return;
    const { mats } = req.body;
    if (!Array.isArray(mats)) return res.status(400).json({ error: 'mats must be an array' });
    await pool.query(
      'UPDATE tournaments SET mats_config = $1 WHERE id = $2',
      [JSON.stringify(mats), req.params.id]
    );
    res.json({ mats });
  } catch (err) { next(err); }
}

// ── Mat Scoreboards ───────────────────────────────────────────────────────────

async function getMatScoreboards(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT mat_scoreboards FROM tournaments WHERE id = $1',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Tournament not found' });
    res.json({ matScoreboards: rows[0].mat_scoreboards || {} });
  } catch (err) { next(err); }
}

async function syncMatScoreboards(req, res, next) {
  try {
    const t = await verifyOwner(req, res);
    if (!t) return;
    const { matScoreboards } = req.body;
    if (!matScoreboards || typeof matScoreboards !== 'object') {
      return res.status(400).json({ error: 'matScoreboards must be an object' });
    }
    await pool.query(
      'UPDATE tournaments SET mat_scoreboards = $1 WHERE id = $2',
      [JSON.stringify(matScoreboards), req.params.id]
    );
    res.json({ matScoreboards });
  } catch (err) { next(err); }
}

module.exports = { getMats, syncMats, getMatScoreboards, syncMatScoreboards };
