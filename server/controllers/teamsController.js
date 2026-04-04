/**
 * teamsController.js
 *
 * Handles team registration CRUD for tournament teams.
 * Supports: getTeams, createTeam, updateTeam, markTeamPayment
 *
 * After createTeam, sends invite emails to members without accounts.
 */

'use strict';

const pool = require('../db/pool');
const { sendTeamInviteEmail } = require('../email');
const crypto = require('crypto');

const APP_URL = () => process.env.APP_URL || 'http://localhost:3000';

// ── GET /api/tournaments/:id/teams ────────────────────────────────────────────

async function getTeams(req, res, next) {
  try {
    const { id: tournamentId } = req.params;

    const result = await pool.query(
      `SELECT tt.*,
              te.name        AS event_name,
              te.event_type  AS event_type,
              te.team_price  AS team_price,
              a.name         AS academy_name,
              a.logo_url     AS academy_logo
       FROM tournament_teams tt
       LEFT JOIN tournament_events te ON te.id = tt.event_id
       LEFT JOIN academies a ON a.id = tt.academy_id
       WHERE tt.tournament_id = $1
       ORDER BY tt.team_name`,
      [tournamentId]
    );

    // For each team, annotate members with account info
    const teams = await Promise.all(result.rows.map(async (team) => {
      const members = Array.isArray(team.members) ? team.members : [];
      const emails = members.map(m => m.email).filter(Boolean);

      let usersByEmail = {};
      if (emails.length > 0) {
        const userRes = await pool.query(
          `SELECT id, email, account_claimed
           FROM users
           WHERE email = ANY($1::text[])`,
          [emails]
        );
        usersByEmail = Object.fromEntries(userRes.rows.map(u => [u.email.toLowerCase(), u]));
      }

      const annotated = members.map(m => {
        const u = m.email ? usersByEmail[m.email.toLowerCase()] : null;
        return {
          ...m,
          user_id: m.user_id || (u ? u.id : null),
          account_claimed: u ? u.account_claimed : false,
        };
      });

      return {
        ...team,
        academy_id: team.academy_id,
        academy_name: team.academy_name,
        members: annotated,
      };
    }));

    res.json({ teams });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/tournaments/:id/teams ───────────────────────────────────────────

async function createTeam(req, res, next) {
  try {
    const { id: tournamentId } = req.params;
    const { event_id, team_name, members, academy_id } = req.body;

    if (!event_id || !team_name || !Array.isArray(members)) {
      return res.status(400).json({ error: 'event_id, team_name, and members array are required' });
    }

    if (team_name.trim().length === 0 || team_name.trim().length > 60) {
      return res.status(400).json({ error: 'team_name must be 1–60 characters' });
    }

    // Validate event exists and is a team event
    const eventRes = await pool.query(
      `SELECT id, event_type, team_size, team_price FROM tournament_events
       WHERE id = $1 AND tournament_id = $2`,
      [event_id, tournamentId]
    );
    if (eventRes.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found in this tournament' });
    }
    const event = eventRes.rows[0];
    const isTeamEvent = ['team-kata', 'team-kumite'].includes(event.event_type) ||
                        (event.team_size != null && event.team_size > 1);
    if (!isTeamEvent) {
      return res.status(400).json({ error: 'Event is not a team event' });
    }

    // Check team name uniqueness (case-insensitive)
    const dupCheck = await pool.query(
      `SELECT id FROM tournament_teams
       WHERE tournament_id = $1 AND lower(team_name) = lower($2)`,
      [tournamentId, team_name.trim()]
    );
    if (dupCheck.rows.length > 0) {
      return res.status(409).json({ error: 'A team with this name already exists for this tournament' });
    }

    // Generate a unique team code
    const teamCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    const insertRes = await pool.query(
      `INSERT INTO tournament_teams
         (tournament_id, event_id, team_code, team_name, members, registered_by, payment_status, academy_id)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, 'unpaid', $7)
       RETURNING *`,
      [
        tournamentId,
        event_id,
        teamCode,
        team_name.trim(),
        JSON.stringify(members),
        req.user?.id || null,
        academy_id || null,
      ]
    );

    const newTeam = insertRes.rows[0];

    // ── Post-create: send invite emails to members without accounts ──────────

    // Get tournament name for emails
    const tournRes = await pool.query(
      'SELECT name FROM tournaments WHERE id = $1',
      [tournamentId]
    );
    const tournamentName = tournRes.rows[0]?.name || 'the tournament';

    const addedByName = req.user
      ? `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.email
      : 'The organizer';

    // Fire-and-forget invite emails (don't fail the request if emails fail)
    _sendTeamInvites({
      members,
      tournamentName,
      teamName: newTeam.team_name,
      addedByName,
    }).catch(err => console.error('Team invite email error:', err));

    res.status(201).json({ team: newTeam });
  } catch (err) {
    next(err);
  }
}

// ── Helper: send invite emails after team creation ────────────────────────────

async function _sendTeamInvites({ members, tournamentName, teamName, addedByName }) {
  for (const member of members) {
    const email = member.email;
    if (!email) continue;

    // Skip registrant (is_registrant flag) — they're already confirmed
    if (member.is_registrant) continue;

    // Skip members that already have a confirmed user_id (existing account)
    if (member.user_id) {
      // Could send informational email here if desired — skipping for now
      continue;
    }

    let userId = null;
    let claimed = false;

    // Check if user exists
    const existingRes = await pool.query(
      'SELECT id, account_claimed FROM users WHERE lower(email) = lower($1)',
      [email]
    );

    if (existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];
      userId = existing.id;
      claimed = existing.account_claimed;
    } else {
      // Create passwordless user
      const newUserRes = await pool.query(
        `INSERT INTO users (email, account_claimed, first_name, last_name)
         VALUES ($1, false, $2, $3)
         ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
         RETURNING id, account_claimed`,
        [email.toLowerCase(), member.first_name || member.name?.split(' ')[0] || '', member.last_name || member.name?.split(' ').slice(1).join(' ') || '']
      );
      userId = newUserRes.rows[0].id;
      claimed = false;
    }

    if (claimed) {
      // Already has an account — send informational email only (optional, skip for now)
      continue;
    }

    // Generate/refresh verification token (7 days)
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO verification_tokens (user_id, token, expires_at, type)
       VALUES ($1, $2, $3, 'account_claim')
       ON CONFLICT DO NOTHING`,
      [userId, token, expires]
    ).catch(err => {
      console.error(`[teams] Failed to insert verification token for user ${userId}:`, err.message);
    });

    // Try updating users.verification_token directly (common pattern in this codebase)
    await pool.query(
      `UPDATE users SET verification_token = $1, verification_expires = $2 WHERE id = $3`,
      [token, expires, userId]
    ).catch(err => {
      console.error(`[teams] Failed to set verification_token on users row for user ${userId}:`, err.message);
    });

    const claimUrl = `${APP_URL()}/claim-account?token=${token}`;
    const toName = member.first_name
      ? `${member.first_name} ${member.last_name || ''}`.trim()
      : member.name || email;

    await sendTeamInviteEmail({
      toEmail: email,
      toName,
      teamName,
      tournamentName,
      addedByName,
      claimUrl,
    }).catch(err => console.error(`Failed to send team invite to ${email}:`, err.message));
  }
}

// ── PUT /api/tournaments/:id/teams/:teamId ────────────────────────────────────

async function updateTeam(req, res, next) {
  try {
    const { id: tournamentId, teamId } = req.params;
    const { team_name, members } = req.body;

    // Verify team exists in this tournament
    const teamRes = await pool.query(
      'SELECT * FROM tournament_teams WHERE id = $1 AND tournament_id = $2',
      [teamId, tournamentId]
    );
    if (teamRes.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }
    const team = teamRes.rows[0];

    // Authorization: team creator or director (tournament owner)
    const tournRes = await pool.query('SELECT created_by FROM tournaments WHERE id = $1', [tournamentId]);
    if (!tournRes.rows.length) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    const isDirector = tournRes.rows[0].created_by === req.user?.id;
    const isCreator = team.registered_by === req.user?.id;
    if (!isDirector && !isCreator) {
      return res.status(403).json({ error: 'Not authorized to update this team' });
    }

    const updates = [];
    const values = [];
    let idx = 1;

    if (team_name !== undefined) {
      // Check uniqueness (excluding current team)
      const dupCheck = await pool.query(
        `SELECT id FROM tournament_teams
         WHERE tournament_id = $1 AND lower(team_name) = lower($2) AND id != $3`,
        [tournamentId, team_name.trim(), teamId]
      );
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({ error: 'A team with this name already exists' });
      }
      updates.push(`team_name = $${idx++}`);
      values.push(team_name.trim());
    }

    if (members !== undefined) {
      updates.push(`members = $${idx++}::jsonb`);
      values.push(JSON.stringify(members));
    }

    if (updates.length === 0) {
      return res.json({ team });
    }

    updates.push(`updated_at = NOW()`);
    values.push(teamId);

    const updRes = await pool.query(
      `UPDATE tournament_teams SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    res.json({ team: updRes.rows[0] });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/tournaments/:id/teams/:teamId/payment ─────────────────────────

async function markTeamPayment(req, res, next) {
  try {
    const { id: tournamentId, teamId } = req.params;
    const { payment_status } = req.body;

    if (!['paid', 'waived', 'unpaid'].includes(payment_status)) {
      return res.status(400).json({ error: 'payment_status must be paid, waived, or unpaid' });
    }

    // Director only
    const tournRes = await pool.query('SELECT created_by FROM tournaments WHERE id = $1', [tournamentId]);
    if (!tournRes.rows.length) return res.status(404).json({ error: 'Tournament not found' });
    if (tournRes.rows[0].created_by !== req.user?.id) {
      return res.status(403).json({ error: 'Director access required' });
    }

    const updRes = await pool.query(
      `UPDATE tournament_teams
       SET payment_status = $1, updated_at = NOW()
       WHERE id = $2 AND tournament_id = $3
       RETURNING *`,
      [payment_status, teamId, tournamentId]
    );

    if (updRes.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json({ team: updRes.rows[0] });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/tournaments/:id/teams/:teamId/members ──────────────────────────
// Atomically appends a single member object to the team's JSONB members array.
// Uses PostgreSQL's || operator for a true atomic append — no read-modify-write
// race condition. Safe for concurrent registrations.

async function addTeamMember(req, res, next) {
  try {
    const { id: tournamentId, teamId } = req.params;
    const { member } = req.body;

    if (!member || typeof member !== 'object') {
      return res.status(400).json({ error: 'member object is required' });
    }

    // Verify team exists in this tournament
    const teamRes = await pool.query(
      'SELECT id, members FROM tournament_teams WHERE id = $1 AND tournament_id = $2',
      [teamId, tournamentId]
    );
    if (teamRes.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Atomic JSONB array append — avoids full read-modify-write race
    const updRes = await pool.query(
      `UPDATE tournament_teams
       SET members = members || $1::jsonb, updated_at = NOW()
       WHERE id = $2 AND tournament_id = $3
       RETURNING *`,
      [JSON.stringify([member]), teamId, tournamentId]
    );

    res.json({ team: updRes.rows[0] });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/tournaments/:id/teams/:teamId ─────────────────────────────────

async function deleteTeam(req, res, next) {
  try {
    const { id: tournamentId, teamId } = req.params;

    // Director only
    const tournRes = await pool.query('SELECT created_by FROM tournaments WHERE id = $1', [tournamentId]);
    if (!tournRes.rows.length) return res.status(404).json({ error: 'Tournament not found' });
    if (tournRes.rows[0].created_by !== req.user?.id) {
      return res.status(403).json({ error: 'Director access required' });
    }

    const delRes = await pool.query(
      'DELETE FROM tournament_teams WHERE id = $1 AND tournament_id = $2 RETURNING id',
      [teamId, tournamentId]
    );
    if (delRes.rows.length === 0) return res.status(404).json({ error: 'Team not found' });

    res.json({ message: 'Team deleted' });
  } catch (err) { next(err); }
}

module.exports = { getTeams, createTeam, updateTeam, markTeamPayment, deleteTeam, addTeamMember };
