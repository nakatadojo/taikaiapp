const StaffRoleDefinitionQueries = require('../db/queries/staffRoleDefinitions');

/**
 * GET /api/tournaments/:id/staff-roles
 * Director — list all custom staff role definitions.
 */
async function list(req, res, next) {
  try {
    const roles = await StaffRoleDefinitionQueries.getByTournament(req.params.id);
    res.json({
      roles,
      availablePermissions: StaffRoleDefinitionQueries.VALID_PERMISSIONS,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/tournaments/:id/staff-roles
 * Director — create a new staff role definition.
 */
async function create(req, res, next) {
  try {
    const { role_name, permissions } = req.body;

    if (!role_name || !role_name.trim()) {
      return res.status(400).json({ error: 'role_name is required' });
    }

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'permissions must be an array' });
    }

    const role = await StaffRoleDefinitionQueries.create(req.params.id, {
      role_name: role_name.trim(),
      permissions,
    });
    res.status(201).json({ role });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A role with that name already exists for this tournament' });
    }
    next(err);
  }
}

/**
 * PUT /api/tournaments/:id/staff-roles/:roleId
 * Director — update a staff role definition.
 */
async function update(req, res, next) {
  try {
    const { roleId } = req.params;
    const { role_name, permissions } = req.body;

    const role = await StaffRoleDefinitionQueries.update(roleId, {
      role_name: role_name ? role_name.trim() : undefined,
      permissions,
    });

    if (!role) return res.status(404).json({ error: 'Role not found' });
    res.json({ role });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A role with that name already exists for this tournament' });
    }
    next(err);
  }
}

/**
 * DELETE /api/tournaments/:id/staff-roles/:roleId
 * Director — delete a staff role definition.
 */
async function remove(req, res, next) {
  try {
    const deleted = await StaffRoleDefinitionQueries.delete(req.params.roleId);
    if (!deleted) return res.status(404).json({ error: 'Role not found' });
    res.json({ message: 'Role deleted' });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/tournaments/:id/members/:memberId/assign-role
 * Director — assign a custom role definition to a tournament member.
 */
async function assignRole(req, res, next) {
  try {
    const { memberId } = req.params;
    const { role_definition_id } = req.body;

    // Allow null to unassign
    if (role_definition_id !== null && role_definition_id !== undefined) {
      const roleDef = await StaffRoleDefinitionQueries.getById(role_definition_id);
      if (!roleDef) return res.status(404).json({ error: 'Role definition not found' });
    }

    const member = await StaffRoleDefinitionQueries.assignToMember(
      memberId,
      role_definition_id || null
    );

    if (!member) return res.status(404).json({ error: 'Member not found' });
    res.json({ member });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tournaments/:id/members-with-roles
 * Director — list members with their custom role assignments.
 */
async function listMembersWithRoles(req, res, next) {
  try {
    const members = await StaffRoleDefinitionQueries.getMembersWithRoles(req.params.id);
    res.json({ members });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove, assignRole, listMembersWithRoles };
