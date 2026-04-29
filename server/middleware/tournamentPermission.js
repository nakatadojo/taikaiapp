const pool = require('../db/pool');

/**
 * Middleware that checks if the authenticated user has a specific
 * tournament-level permission via their staff role definition.
 *
 * Usage:
 *   requireTournamentPermission('operate_scoreboard')
 *   requireTournamentPermission('operate_scoreboard', { ring: req => req.body?.state?.ring })
 *
 * The optional second argument is a config object:
 *   ring — function that extracts the requested ring from the request,
 *           or a string key to look up in req.body / req.query / req.params.
 *           When supplied, the member's assigned_rings array is checked if
 *           it is non-null and non-empty.  null assigned_rings = no restriction.
 *
 * Checks (in order):
 * 1. Super admin — always allowed
 * 2. Tournament creator — always allowed
 * 3. Approved tournament_member with a staff_role_definition that includes
 *    the required permission
 * 4. If a ring extractor is provided and the member has assigned_rings set,
 *    the requested ring must be in that array
 *
 * Requires: req.params.id (tournament ID) and req.user (from requireAuth)
 */
function requireTournamentPermission(...args) {
  // Last arg may be a config object with optional `ring` extractor
  let ringExtractor = null;
  const requiredPermissions = [];
  for (const arg of args) {
    if (typeof arg === 'string') {
      requiredPermissions.push(arg);
    } else if (arg && typeof arg === 'object' && arg.ring) {
      ringExtractor = arg.ring;
    }
  }

  return async (req, res, next) => {
    try {
      const tournamentId = req.params.id;
      const userId       = req.user.id;

      // Guard against non-UUID ids to avoid a PostgreSQL cast error (500)
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tournamentId)) {
        return res.status(404).json({ error: 'Tournament not found' });
      }

      // Super admins always have full access
      const userRoles = req.user.roles || [];
      if (userRoles.includes('super_admin')) return next();

      // Check if user is the tournament creator
      const { rows: [tournament] } = await pool.query(
        'SELECT created_by FROM tournaments WHERE id = $1',
        [tournamentId]
      );
      if (!tournament) {
        return res.status(404).json({ error: 'Tournament not found' });
      }
      if (tournament.created_by === userId) return next();

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

      // If member has a role definition, check specific permissions
      if (member.permissions && Array.isArray(member.permissions)) {
        const hasPermission = requiredPermissions.some(p => member.permissions.includes(p));
        if (!hasPermission) {
          return res.status(403).json({
            error: 'Insufficient permissions',
            required: requiredPermissions,
          });
        }

        // Per-mat ring restriction check
        if (ringExtractor) {
          const requestedRing = String(
            typeof ringExtractor === 'function'
              ? ringExtractor(req)
              : (req.body?.[ringExtractor] ?? req.query?.[ringExtractor] ?? req.params?.[ringExtractor] ?? '')
          );
          const assignedRings = member.assigned_rings; // JSONB array or null
          if (Array.isArray(assignedRings) && assignedRings.length > 0) {
            if (!assignedRings.map(String).includes(requestedRing)) {
              return res.status(403).json({
                error: 'You are not assigned to this ring.',
                assignedRings,
                requestedRing,
              });
            }
          }
          // null / empty assigned_rings = no ring restriction
        }

        return next();
      }

      // Member has no role definition — deny access
      return res.status(403).json({
        error: 'No role assigned. Ask the tournament director to assign you a staff role before you can access this resource.',
      });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requireTournamentPermission };
