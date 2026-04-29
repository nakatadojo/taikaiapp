const pool = require('../db/pool');
const ScheduleQueries = require('../db/queries/schedules');
const BracketQueries = require('../db/queries/brackets');

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
      `SELECT first_name, last_name, academy_name, events FROM (
         SELECT
           cp.first_name, cp.last_name, cp.academy_name,
           array_agg(DISTINCT te.name) FILTER (WHERE te.name IS NOT NULL) AS events
         FROM registrations r
         JOIN competitor_profiles cp ON r.profile_id = cp.id
         LEFT JOIN registration_events re ON re.registration_id = r.id
         LEFT JOIN tournament_events te ON re.event_id = te.id
         WHERE r.tournament_id = $1 AND r.status != 'cancelled'
         GROUP BY cp.id, cp.first_name, cp.last_name, cp.academy_name

         UNION ALL

         SELECT
           (data->>'firstName') AS first_name,
           (data->>'lastName')  AS last_name,
           (data->>'club')      AS academy_name,
           ARRAY[]::text[]      AS events
         FROM tournament_director_competitors
         WHERE tournament_id = $1
       ) combined
       ORDER BY last_name, first_name`,
      [tournamentId]
    );

    res.json({ competitors: rows });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tournaments/:id/schedule/public
 * Returns schedule data when published by the director.
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
      return res.json({ schedule: {}, hidden: true });
    }

    const data = await ScheduleQueries.get(tournamentId);
    if (!data || !data.schedule_published) {
      return res.json({ schedule: {}, published: false, message: 'Schedule not yet published' });
    }

    res.json({
      schedule: data.mat_schedule || {},
      scheduleSettings: data.schedule_settings || {},
      published: true,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tournaments/:id/brackets/public
 * Returns published brackets from the server.
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
      return res.json({ brackets: {}, hidden: true });
    }

    const rows = await BracketQueries.getAllPublished(tournamentId);
    if (rows.length === 0) {
      return res.json({ brackets: {}, message: 'Brackets not yet published' });
    }

    const byId = {};
    for (const b of rows) { byId[b.id] = b.data; }
    res.json({ brackets: byId });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPublicCompetitors,
  getPublicSchedule,
  getPublicBrackets,
};
