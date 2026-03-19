const pool = require('../db/pool');
const ScheduleQueries = require('../db/queries/schedules');

async function getSchedule(req, res, next) {
  try {
    const data = await ScheduleQueries.get(req.params.id);
    if (!data) return res.status(404).json({ error: 'Tournament not found' });
    res.json({
      matSchedule: data.mat_schedule || {},
      scheduleSettings: data.schedule_settings || {},
      published: data.schedule_published || false,
    });
  } catch (err) { next(err); }
}

async function syncSchedule(req, res, next) {
  try {
    const tournamentId = req.params.id;
    const { matSchedule, scheduleSettings } = req.body;

    const t = await pool.query('SELECT created_by FROM tournaments WHERE id = $1', [tournamentId]);
    if (!t.rows[0]) return res.status(404).json({ error: 'Tournament not found' });
    const isSuperAdmin = (req.user.roles || []).includes('super_admin');
    if (!isSuperAdmin && t.rows[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const result = await ScheduleQueries.upsert(tournamentId, { matSchedule, scheduleSettings });
    res.json({ message: 'Schedule saved', published: result.schedule_published });
  } catch (err) { next(err); }
}

async function setSchedulePublished(req, res, next) {
  try {
    const tournamentId = req.params.id;
    const { published } = req.body;

    const t = await pool.query('SELECT created_by FROM tournaments WHERE id = $1', [tournamentId]);
    if (!t.rows[0]) return res.status(404).json({ error: 'Tournament not found' });
    const isSuperAdmin = (req.user.roles || []).includes('super_admin');
    if (!isSuperAdmin && t.rows[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const result = await ScheduleQueries.setPublished(tournamentId, !!published);
    res.json({ published: result.schedule_published });
  } catch (err) { next(err); }
}

module.exports = { getSchedule, syncSchedule, setSchedulePublished };
