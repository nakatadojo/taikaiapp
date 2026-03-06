const tournamentQueries = require('../db/queries/tournaments');
const pool = require('../db/pool');

/**
 * Middleware that checks if the authenticated user owns the tournament
 * (or is an approved staff member, or is a super_admin).
 * Replaces requireRole('tournament owner') for tournament-scoped routes.
 *
 * Reads tournament ID from req.params.tournamentId or req.params.id.
 * Attaches req.tournament and req.isTournamentOwner to the request.
 */
function requireTournamentOwner(req, res, next) {
  const tournamentId = req.params.tournamentId || req.params.id;
  if (!tournamentId) {
    return res.status(400).json({ error: 'Tournament ID required' });
  }

  // Use async IIFE to keep middleware signature clean
  (async () => {
    const tournament = await tournamentQueries.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const userId = req.user.id;
    const isOwner = tournament.created_by === userId;

    // Super admins always have access
    const userRoles = req.user.roles || [];
    const isSuperAdmin = userRoles.includes('super_admin');

    if (isOwner || isSuperAdmin) {
      req.tournament = tournament;
      req.isTournamentOwner = isOwner;
      return next();
    }

    // Check if user is an approved staff member for this tournament
    const staffCheck = await pool.query(
      `SELECT id FROM tournament_members
       WHERE user_id = $1 AND tournament_id = $2 AND status = 'approved'
       LIMIT 1`,
      [userId, tournamentId]
    );

    if (staffCheck.rows.length > 0) {
      req.tournament = tournament;
      req.isTournamentOwner = false;
      return next();
    }

    return res.status(403).json({ error: 'You do not have access to this tournament' });
  })().catch(next);
}

module.exports = { requireTournamentOwner };
