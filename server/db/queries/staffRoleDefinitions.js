const pool = require('../pool');

/**
 * Valid permission types for staff roles.
 */
const VALID_PERMISSIONS = [
  'view_schedule',
  'operate_scoreboard',
  'view_results',
  'print_certificates',
  'publish_awards',
  'manage_checkin',
];

const StaffRoleDefinitionQueries = {
  VALID_PERMISSIONS,

  /**
   * Get all role definitions for a tournament.
   */
  async getByTournament(tournamentId) {
    const { rows } = await pool.query(
      `SELECT * FROM staff_role_definitions
       WHERE tournament_id = $1
       ORDER BY role_name`,
      [tournamentId]
    );
    return rows;
  },

  /**
   * Get a single role definition by ID.
   */
  async getById(id) {
    const { rows } = await pool.query(
      'SELECT * FROM staff_role_definitions WHERE id = $1',
      [id]
    );
    return rows[0];
  },

  /**
   * Create a new role definition.
   */
  async create(tournamentId, data) {
    const { role_name, permissions = [] } = data;
    const validPerms = permissions.filter(p => VALID_PERMISSIONS.includes(p));
    const { rows } = await pool.query(
      `INSERT INTO staff_role_definitions (tournament_id, role_name, permissions)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [tournamentId, role_name, JSON.stringify(validPerms)]
    );
    return rows[0];
  },

  /**
   * Update a role definition.
   */
  async update(id, data) {
    const { role_name, permissions } = data;
    const validPerms = permissions
      ? permissions.filter(p => VALID_PERMISSIONS.includes(p))
      : undefined;

    const { rows } = await pool.query(
      `UPDATE staff_role_definitions
       SET role_name = COALESCE($2, role_name),
           permissions = COALESCE($3, permissions)
       WHERE id = $1
       RETURNING *`,
      [id, role_name, validPerms ? JSON.stringify(validPerms) : undefined]
    );
    return rows[0];
  },

  /**
   * Delete a role definition.
   */
  async delete(id) {
    const { rowCount } = await pool.query(
      'DELETE FROM staff_role_definitions WHERE id = $1',
      [id]
    );
    return rowCount > 0;
  },

  /**
   * Assign a role definition to a tournament member.
   */
  async assignToMember(memberId, roleDefinitionId) {
    const { rows } = await pool.query(
      `UPDATE tournament_members
       SET role_definition_id = $2
       WHERE id = $1
       RETURNING *`,
      [memberId, roleDefinitionId]
    );
    return rows[0];
  },

  /**
   * Get members with their role definitions for a tournament.
   */
  async getMembersWithRoles(tournamentId) {
    const { rows } = await pool.query(
      `SELECT tm.*, srd.role_name AS custom_role_name, srd.permissions AS custom_permissions
       FROM tournament_members tm
       LEFT JOIN staff_role_definitions srd ON tm.role_definition_id = srd.id
       WHERE tm.tournament_id = $1
       ORDER BY tm.role, srd.role_name, tm.applied_at`,
      [tournamentId]
    );
    return rows;
  },
};

module.exports = StaffRoleDefinitionQueries;
