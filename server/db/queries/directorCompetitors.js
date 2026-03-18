const pool = require('../pool');

async function getAll(tournamentId) {
  const { rows } = await pool.query(
    `SELECT id, data, is_test, created_at, updated_at
     FROM tournament_director_competitors
     WHERE tournament_id = $1
     ORDER BY created_at ASC`,
    [tournamentId]
  );
  // Return each row as a competitor object with the id merged into data
  return rows.map(r => ({ id: r.id, is_test: r.is_test, ...r.data }));
}

async function create(tournamentId, competitorData, isTest = false) {
  const { id: _drop, ...dataWithoutId } = competitorData;
  const { rows } = await pool.query(
    `INSERT INTO tournament_director_competitors (tournament_id, data, is_test)
     VALUES ($1, $2::jsonb, $3)
     RETURNING id, data, is_test, created_at, updated_at`,
    [tournamentId, JSON.stringify(dataWithoutId), isTest]
  );
  const r = rows[0];
  return { id: r.id, is_test: r.is_test, ...r.data };
}

async function update(id, tournamentId, competitorData) {
  const { id: _drop, ...dataWithoutId } = competitorData;
  const { rows } = await pool.query(
    `UPDATE tournament_director_competitors
     SET data = $3::jsonb, updated_at = NOW()
     WHERE id = $1 AND tournament_id = $2
     RETURNING id, data, is_test`,
    [id, tournamentId, JSON.stringify(dataWithoutId)]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return { id: r.id, is_test: r.is_test, ...r.data };
}

async function remove(id, tournamentId) {
  const { rows } = await pool.query(
    `DELETE FROM tournament_director_competitors
     WHERE id = $1 AND tournament_id = $2
     RETURNING id`,
    [id, tournamentId]
  );
  return rows[0] || null;
}

async function clearTestData(tournamentId) {
  const { rows } = await pool.query(
    `DELETE FROM tournament_director_competitors
     WHERE tournament_id = $1 AND is_test = TRUE
     RETURNING id`,
    [tournamentId]
  );
  return rows.length;
}

async function bulkCreate(tournamentId, competitors, isTest = false) {
  if (!competitors || competitors.length === 0) return [];
  const results = [];
  for (const comp of competitors) {
    const created = await create(tournamentId, comp, isTest);
    results.push(created);
  }
  return results;
}

module.exports = { getAll, create, update, remove, clearTestData, bulkCreate };
