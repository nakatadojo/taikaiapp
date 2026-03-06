const pool = require('../db/pool');

/**
 * GET /api/tournaments/:id/competitors/public
 * Public list of registered competitors (name, academy, events).
 */
async function getPublicCompetitors(req, res, next) {
  try {
    const { id: tournamentId } = req.params;

    // Check section visibility
    const t = await pool.query(
      'SELECT section_visibility FROM tournaments WHERE id = $1',
      [tournamentId]
    );
    if (!t.rows[0]) return res.status(404).json({ error: 'Tournament not found' });

    const visibility = t.rows[0].section_visibility || {};
    if (visibility.competitors === false) {
      return res.json({ competitors: [], hidden: true });
    }

    const { rows } = await pool.query(
      `SELECT
         cp.first_name, cp.last_name, cp.academy_name,
         array_agg(DISTINCT te.name) FILTER (WHERE te.name IS NOT NULL) AS events
       FROM registrations r
       JOIN competitor_profiles cp ON r.profile_id = cp.id
       LEFT JOIN registration_events re ON re.registration_id = r.id
       LEFT JOIN tournament_events te ON re.event_id = te.id
       WHERE r.tournament_id = $1 AND r.payment_status IN ('paid', 'waived')
       GROUP BY cp.id, cp.first_name, cp.last_name, cp.academy_name
       ORDER BY cp.last_name, cp.first_name`,
      [tournamentId]
    );

    res.json({ competitors: rows });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tournaments/:id/schedule/public
 * Placeholder — returns empty until scheduling is server-synced.
 */
async function getPublicSchedule(req, res, next) {
  try {
    const { id: tournamentId } = req.params;

    const t = await pool.query(
      'SELECT section_visibility FROM tournaments WHERE id = $1',
      [tournamentId]
    );
    if (!t.rows[0]) return res.status(404).json({ error: 'Tournament not found' });

    const visibility = t.rows[0].section_visibility || {};
    if (visibility.schedule === false) {
      return res.json({ schedule: [], hidden: true });
    }

    // Schedule data is currently in localStorage only — return empty
    res.json({ schedule: [], message: 'Schedule not yet published' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tournaments/:id/brackets/public
 * Placeholder — returns empty until brackets are server-synced.
 */
async function getPublicBrackets(req, res, next) {
  try {
    const { id: tournamentId } = req.params;

    const t = await pool.query(
      'SELECT section_visibility FROM tournaments WHERE id = $1',
      [tournamentId]
    );
    if (!t.rows[0]) return res.status(404).json({ error: 'Tournament not found' });

    const visibility = t.rows[0].section_visibility || {};
    if (visibility.brackets === false) {
      return res.json({ brackets: [], hidden: true });
    }

    // Bracket data is currently in localStorage only — return empty
    res.json({ brackets: [], message: 'Brackets not yet published' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPublicCompetitors,
  getPublicSchedule,
  getPublicBrackets,
};
