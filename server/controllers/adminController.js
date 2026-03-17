const roleQueries = require('../db/queries/roles');
const userQueries = require('../db/queries/users');

/**
 * POST /api/admin/users/:id/roles
 * Add a role to a user. Admin-only.
 */
async function addUserRole(req, res, next) {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ['competitor', 'coach', 'judge', 'assistant_coach', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    // Verify the target user exists
    const user = await userQueries.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await roleQueries.addRole(id, role);
    const roles = await roleQueries.getRolesForUser(id);

    res.json({
      message: `Role '${role}' added to ${user.email}`,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        roles,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/admin/users/:id/roles/:role
 * Remove a role from a user. Admin-only.
 */
async function removeUserRole(req, res, next) {
  try {
    const { id, role } = req.params;

    // Verify the target user exists
    const user = await userQueries.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent removing the last admin role if this is the requesting admin
    if (role === 'admin' && id === req.user.id) {
      return res.status(400).json({ error: 'Cannot remove your own admin role' });
    }

    await roleQueries.removeRole(id, role);
    const roles = await roleQueries.getRolesForUser(id);

    res.json({
      message: `Role '${role}' removed from ${user.email}`,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        roles,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/admin/users/:id
 * Permanently delete a user account. Admin-only.
 * Guards: cannot delete yourself; cannot delete another super_admin.
 */
async function deleteUser(req, res, next) {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    // Verify target user exists
    const user = await userQueries.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting another super_admin
    const targetRoles = await roleQueries.getRolesForUser(id);
    if (targetRoles.includes('super_admin')) {
      return res.status(403).json({ error: 'Cannot delete a super_admin account' });
    }

    await userQueries.deleteUser(id);

    res.json({ message: `User ${user.email} has been permanently deleted` });
  } catch (err) {
    next(err);
  }
}

module.exports = { addUserRole, removeUserRole, deleteUser };
