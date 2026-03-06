const pool = require('../pool');

async function get(tournamentId) {
  const { rows } = await pool.query(
    `SELECT mat_schedule, schedule_settings, schedule_published
     FROM tournaments WHERE id = $1`,
    [tournamentId]
  );
  return rows[0] || null;
}

async function upsert(tournamentId, { matSchedule, scheduleSettings }) {
  const { rows } = await pool.query(
    `UPDATE tournaments
     SET mat_schedule = $2, schedule_settings = $3, updated_at = NOW()
     WHERE id = $1
     RETURNING mat_schedule, schedule_settings, schedule_published`,
    [tournamentId, JSON.stringify(matSchedule || {}), JSON.stringify(scheduleSettings || {})]
  );
  return rows[0];
}

async function setPublished(tournamentId, published) {
  const { rows } = await pool.query(
    `UPDATE tournaments SET schedule_published = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING schedule_published`,
    [tournamentId, published]
  );
  return rows[0];
}

module.exports = { get, upsert, setPublished };
