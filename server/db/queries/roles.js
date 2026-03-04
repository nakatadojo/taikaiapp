const pool = require('../pool');

async function getRolesForUser(userId) {
  const result = await pool.query(
    'SELECT role FROM user_roles WHERE user_id = $1',
    [userId]
  );
  return result.rows.map(r => r.role);
}

async function addRole(userId, role) {
  await pool.query(
    'INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT (user_id, role) DO NOTHING',
    [userId, role]
  );
}

async function addRoles(userId, roles) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const role of roles) {
      await client.query(
        'INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT (user_id, role) DO NOTHING',
        [userId, role]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function removeRole(userId, role) {
  await pool.query(
    'DELETE FROM user_roles WHERE user_id = $1 AND role = $2',
    [userId, role]
  );
}

module.exports = { getRolesForUser, addRole, addRoles, removeRole };
