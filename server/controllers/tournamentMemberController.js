const tournamentMemberQueries = require('../db/queries/tournamentMembers');
const notificationQueries = require('../db/queries/notifications');
const tournamentQueries = require('../db/queries/tournaments');
const userQueries = require('../db/queries/users');

/**
 * POST /api/tournament-members
 * Apply for a role at a tournament (coach, judge, staff, parent).
 */
async function apply(req, res, next) {
  try {
    const { tournamentId, role, staffRole } = req.body;
    const validRoles = ['coach', 'judge', 'staff', 'parent'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be coach, judge, staff, or parent.' });
    }

    const tournament = await tournamentQueries.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const member = await tournamentMemberQueries.create({
      userId: req.user.id,
      tournamentId,
      role,
      staffRole: role === 'staff' ? staffRole : null,
    });

    // Create notification for tournament director
    const applicant = await userQueries.findById(req.user.id);
    const applicantName = `${applicant.first_name} ${applicant.last_name}`;

    await notificationQueries.create({
      recipientId: tournament.created_by,
      tournamentId,
      type: 'role_request',
      payload: {
        memberId: member.id,
        applicantName,
        applicantEmail: applicant.email,
        role,
        staffRole: member.staff_role,
        tournamentName: tournament.name,
      },
    });

    // Send email to director (non-blocking)
    try {
      const { sendRoleRequestEmail } = require('../email');
      const director = await userQueries.findById(tournament.created_by);
      if (director) {
        await sendRoleRequestEmail(director.email, {
          applicantName,
          role,
          staffRole: member.staff_role,
          tournamentName: tournament.name,
          tournamentId,
        });
      }
    } catch (emailErr) {
      console.warn('Failed to send role request email:', emailErr.message);
    }

    res.status(201).json({ member });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tournament-members/:tournamentId
 * List all members for a tournament (director/admin only).
 */
async function list(req, res, next) {
  try {
    // Access already verified by requireTournamentOwner middleware (owner, super_admin, or approved staff)
    const status = req.query.status || undefined;
    const members = await tournamentMemberQueries.getByTournament(req.params.tournamentId, { status });
    res.json({ members });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/tournament-members/:id/approve
 * Approve a pending role application.
 */
async function approve(req, res, next) {
  try {
    const existing = await tournamentMemberQueries.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const tournament = await tournamentQueries.findById(existing.tournament_id);
    const userRoles = req.user.roles || [];
    if (tournament.created_by !== req.user.id && !userRoles.includes('super_admin')) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const member = await tournamentMemberQueries.approve(req.params.id, req.user.id);
    if (!member) {
      return res.status(400).json({ error: 'Application is not pending' });
    }

    // Notify the applicant
    await notificationQueries.create({
      recipientId: member.user_id,
      tournamentId: member.tournament_id,
      type: 'role_approved',
      payload: {
        role: member.role,
        tournamentName: existing.tournament_name,
      },
    });

    // Send approval email (non-blocking)
    try {
      const { sendRoleApprovedEmail } = require('../email');
      await sendRoleApprovedEmail(existing.email, {
        applicantName: `${existing.first_name} ${existing.last_name}`,
        role: member.role,
        tournamentName: existing.tournament_name,
        tournamentId: member.tournament_id,
      });
    } catch (emailErr) {
      console.warn('Failed to send role approved email:', emailErr.message);
    }

    res.json({ member });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/tournament-members/:id/decline
 * Decline a pending role application.
 */
async function decline(req, res, next) {
  try {
    const existing = await tournamentMemberQueries.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const tournament = await tournamentQueries.findById(existing.tournament_id);
    const userRoles = req.user.roles || [];
    if (tournament.created_by !== req.user.id && !userRoles.includes('super_admin')) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const member = await tournamentMemberQueries.decline(req.params.id, req.user.id);
    if (!member) {
      return res.status(400).json({ error: 'Application is not pending' });
    }

    // Notify the applicant
    await notificationQueries.create({
      recipientId: member.user_id,
      tournamentId: member.tournament_id,
      type: 'role_declined',
      payload: {
        role: member.role,
        tournamentName: existing.tournament_name,
      },
    });

    // Send decline email (non-blocking)
    try {
      const { sendRoleDeclinedEmail } = require('../email');
      await sendRoleDeclinedEmail(existing.email, {
        applicantName: `${existing.first_name} ${existing.last_name}`,
        role: member.role,
        tournamentName: existing.tournament_name,
      });
    } catch (emailErr) {
      console.warn('Failed to send role declined email:', emailErr.message);
    }

    res.json({ member });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/my/tournaments
 * Get all tournament memberships for the current user.
 */
async function myTournaments(req, res, next) {
  try {
    const memberships = await tournamentMemberQueries.getByUser(req.user.id);
    res.json({ memberships });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/my/membership/:id
 * Get a single membership record (must be the member's own).
 */
async function getMembership(req, res, next) {
  try {
    const member = await tournamentMemberQueries.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Membership not found' });
    }
    // Only the member themselves can view this
    if (member.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    res.json({ member });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/my/staff-dashboard
 * Get approved staff/judge assignments for the current user.
 */
async function staffDashboard(req, res, next) {
  try {
    const assignments = await tournamentMemberQueries.getStaffDashboard(req.user.id);
    res.json({ assignments });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tournament-members/:tournamentId/public
 * Public list of approved members (coaches, judges, staff).
 */
async function listPublic(req, res, next) {
  try {
    const members = await tournamentMemberQueries.getByTournament(req.params.tournamentId, { status: 'approved' });
    // Only return public-safe fields
    const publicMembers = members.map(m => ({
      id: m.id,
      first_name: m.first_name,
      last_name: m.last_name,
      role: m.role,
      staff_role: m.staff_role,
    }));
    res.json({ members: publicMembers });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/tournament-members/:id/checkin
 * Mark a member (official/staff/coach) as checked in on event day.
 * Requires: authenticated user must own the tournament the member belongs to.
 */
async function checkIn(req, res, next) {
  try {
    // Look up member first to get the tournament_id, then verify ownership
    const existing = await tournamentMemberQueries.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const tournament = await tournamentQueries.findById(existing.tournament_id);
    if (!tournament || tournament.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const member = await tournamentMemberQueries.checkIn(req.params.id, req.user.id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found or not approved' });
    }
    res.json({ member });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/tournament-members/:id/checkin
 * Undo a member check-in.
 * Requires: authenticated user must own the tournament the member belongs to.
 */
async function undoCheckIn(req, res, next) {
  try {
    // Look up member first to get the tournament_id, then verify ownership
    const existing = await tournamentMemberQueries.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const tournament = await tournamentQueries.findById(existing.tournament_id);
    if (!tournament || tournament.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const member = await tournamentMemberQueries.undoCheckIn(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json({ member });
  } catch (err) {
    next(err);
  }
}

module.exports = { apply, list, listPublic, approve, decline, myTournaments, getMembership, staffDashboard, checkIn, undoCheckIn };
