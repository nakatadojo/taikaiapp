const pool = require('../db/pool');

/**
 * Middleware that checks if the authenticated user has a specific
 * tournament-level permission via their staff role definition.
 *
 * Usage: requireTournamentPermission('operate_scoreboard')
 *
 * Checks:
 * 1. User is the tournament creator (event_director) — always allowed
 * 2. User has an approved tournament_members record with a staff_role_definition
 *    that includes the required permission
 *
 * Requires: req.params.id (tournament ID) and req.user (from requireAuth)
 */
function requireTournamentPermission(...requiredPermissions) {
  return async (req, res, next) => {
    try {
      const tournamentId = req.params.id;
      const userId = req.user.id;

      // Check if user is the tournament creator
      const { rows: [tournament] } = await pool.query(
        'SELECT created_by FROM tournaments WHERE id = $1',
        [tournamentId]
      );

      if (!tournament) {
        return res.status(404).json({ error: 'Tournament not found' });
      }

      // Tournament creator has all permissions
      if (tournament.created_by === userId) {
        return next();
      }

      // Super admins and admins have all permissions
      if (req.user.roles && (req.user.roles.includes('super_admin') || req.user.roles.includes('admin'))) {
        return next();
      }

      // Check tournament member's staff role permissions
      const { rows: [member] } = await pool.query(
        `SELECT tm.*, srd.permissions
         FROM tournament_members tm
         LEFT JOIN staff_role_definitions srd ON tm.role_definition_id = srd.id
         WHERE tm.tournament_id = $1
           AND tm.user_id = $2
           AND tm.status = 'approved'`,
        [tournamentId, userId]
      );

      if (!member) {
        return res.status(403).json({ error: 'Not authorized for this tournament' });
      }

      // If member has a role definition, check permissions
      if (member.permissions && Array.isArray(member.permissions)) {
        const hasPermission = requiredPermissions.some(p => member.permissions.includes(p));
        if (hasPermission) {
          return next();
        }
      }

      return res.status(403).json({
        error: 'Insufficient permissions',
        required: requiredPermissions,
      });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requireTournamentPermission };
