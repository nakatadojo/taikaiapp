const express = require('express');
const crypto = require('crypto');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { requireTournamentOwner } = require('../middleware/tournamentOwner');
const pool = require('../db/pool');
const userQueries = require('../db/queries/users');
const { sendTournamentInviteEmail } = require('../email');

const router = express.Router();

// ── POST /api/tournaments/:id/invitations — Send invitation ─────────────────
router.post('/:id/invitations',
  requireAuth,
  requireTournamentOwner,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('role').isIn(['coach', 'judge', 'staff']).withMessage('Role must be coach, judge, or staff'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const tournamentId = req.params.id;
      const { email, role } = req.body;
      const invitedBy = req.user.id;
      const tournament = req.tournament;

      // Check if invitation already exists
      const existing = await pool.query(
        `SELECT id, status FROM tournament_invitations
         WHERE tournament_id = $1 AND email = $2 AND role = $3`,
        [tournamentId, email, role]
      );
      if (existing.rows.length > 0) {
        const inv = existing.rows[0];
        if (inv.status === 'accepted') {
          return res.status(409).json({ error: 'This person has already accepted an invitation for this role' });
        }
        // Resend the pending invitation
        const token = crypto.randomBytes(32).toString('hex');
        await pool.query(
          `UPDATE tournament_invitations SET token = $1, created_at = NOW() WHERE id = $2`,
          [token, inv.id]
        );

        // Check if user already has an account
        const existingUser = await userQueries.findByEmail(email);
        const inviterName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;

        await sendTournamentInviteEmail(email, {
          tournamentName: tournament.name,
          role,
          inviterName,
          hasAccount: !!existingUser,
          token,
        });

        return res.json({ message: 'Invitation resent', invitation: { id: inv.id, email, role, status: 'pending' } });
      }

      // Check if the user already has an account
      const existingUser = await userQueries.findByEmail(email);
      const token = crypto.randomBytes(32).toString('hex');

      if (existingUser) {
        // User exists — add them directly as an approved tournament member
        // Check if they're already a member with this role
        const memberCheck = await pool.query(
          `SELECT id FROM tournament_members
           WHERE user_id = $1 AND tournament_id = $2 AND role = $3::user_role`,
          [existingUser.id, tournamentId, role]
        );

        if (memberCheck.rows.length === 0) {
          await pool.query(
            `INSERT INTO tournament_members (user_id, tournament_id, role, status, applied_at, reviewed_at, reviewed_by)
             VALUES ($1, $2, $3::user_role, 'approved', NOW(), NOW(), $4)`,
            [existingUser.id, tournamentId, role, invitedBy]
          );
        }

        // Save invitation as accepted
        await pool.query(
          `INSERT INTO tournament_invitations (tournament_id, email, role, token, invited_by, status, accepted_at)
           VALUES ($1, $2, $3, $4, $5, 'accepted', NOW())`,
          [tournamentId, email, role, token, invitedBy]
        );

        const inviterName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;

        await sendTournamentInviteEmail(email, {
          tournamentName: tournament.name,
          role,
          inviterName,
          hasAccount: true,
          token,
        });

        return res.status(201).json({
          message: `${existingUser.first_name} has been added as ${role} and notified by email`,
          invitation: { id: null, email, role, status: 'accepted' },
        });
      }

      // User doesn't exist — save pending invitation, send signup invite
      const result = await pool.query(
        `INSERT INTO tournament_invitations (tournament_id, email, role, token, invited_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [tournamentId, email, role, token, invitedBy]
      );

      const inviterName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;

      await sendTournamentInviteEmail(email, {
        tournamentName: tournament.name,
        role,
        inviterName,
        hasAccount: false,
        token,
      });

      res.status(201).json({
        message: `Invitation sent to ${email}`,
        invitation: { id: result.rows[0].id, email, role, status: 'pending' },
      });
    } catch (err) {
      if (err.code === '23505') { // unique constraint
        return res.status(409).json({ error: 'An invitation already exists for this email and role' });
      }
      next(err);
    }
  }
);

// ── GET /api/tournaments/:id/invitations — List invitations ─────────────────
router.get('/:id/invitations',
  requireAuth,
  requireTournamentOwner,
  async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT ti.*, u.first_name AS inviter_first_name, u.last_name AS inviter_last_name
         FROM tournament_invitations ti
         LEFT JOIN users u ON u.id = ti.invited_by
         WHERE ti.tournament_id = $1
         ORDER BY ti.created_at DESC`,
        [req.params.id]
      );
      res.json({ invitations: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// ── DELETE /api/tournaments/:id/invitations/:invitationId — Cancel ───────────
router.delete('/:id/invitations/:invitationId',
  requireAuth,
  requireTournamentOwner,
  async (req, res, next) => {
    try {
      const result = await pool.query(
        `DELETE FROM tournament_invitations WHERE id = $1 AND tournament_id = $2 AND status = 'pending' RETURNING id`,
        [req.params.invitationId, req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Pending invitation not found' });
      }
      res.json({ message: 'Invitation cancelled' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
