const crypto = require('crypto');
const DirectorCompetitorQueries = require('../db/queries/directorCompetitors');
const creditQueries = require('../db/queries/credits');
const { broadcastCompetitorUpdate } = require('../websocket');
const tournamentQueries = require('../db/queries/tournaments');
const pool = require('../db/pool');
const { sendCompetitorInviteEmail } = require('../email');

async function getCompetitors(req, res, next) {
  try {
    const competitors = await DirectorCompetitorQueries.getAll(req.params.id);
    res.json({ competitors });
  } catch (err) { next(err); }
}

async function addCompetitor(req, res, next) {
  try {
    const tournamentId = req.params.id;
    const owned = await tournamentQueries.isOwnedBy(tournamentId, req.user.id);
    if (!owned) return res.status(403).json({ error: 'You do not own this tournament' });

    const { competitor, is_test } = req.body;
    if (!competitor || typeof competitor !== 'object') {
      return res.status(400).json({ error: 'competitor object is required' });
    }

    const created = await DirectorCompetitorQueries.create(tournamentId, competitor, is_test || false);
    broadcastCompetitorUpdate(tournamentId, 'add', created);
    res.status(201).json({ competitor: created });

    // Fire-and-forget: create passwordless account + send invite if email provided
    if (competitor.email && !is_test) {
      _sendCompetitorInvite({ competitor, tournamentId, addedByUserId: req.user.id }).catch(e =>
        console.warn('[director] competitor invite failed:', e.message)
      );
    }
  } catch (err) { next(err); }
}

async function updateCompetitor(req, res, next) {
  try {
    const { id: tournamentId, competitorId } = req.params;
    const owned = await tournamentQueries.isOwnedBy(tournamentId, req.user.id);
    if (!owned) return res.status(403).json({ error: 'You do not own this tournament' });

    const { competitor } = req.body;
    if (!competitor || typeof competitor !== 'object') {
      return res.status(400).json({ error: 'competitor object is required' });
    }

    const result = await DirectorCompetitorQueries.update(competitorId, tournamentId, competitor);

    if (!result) return res.status(404).json({ error: 'Competitor not found' });
    if (result.error === 'TEST_COMPETITOR') {
      return res.status(403).json({ error: 'Test competitors cannot be edited' });
    }

    broadcastCompetitorUpdate(tournamentId, 'update', result);
    res.json({ competitor: result });
  } catch (err) { next(err); }
}

async function deleteCompetitor(req, res, next) {
  try {
    const { id: tournamentId, competitorId } = req.params;
    const owned = await tournamentQueries.isOwnedBy(tournamentId, req.user.id);
    if (!owned) return res.status(403).json({ error: 'You do not own this tournament' });

    const deleted = await DirectorCompetitorQueries.remove(competitorId, tournamentId);
    if (!deleted) return res.status(404).json({ error: 'Competitor not found' });

    // Refund credit if this was an approved real competitor.
    // Pass null for registrationId — director competitors have no row in the
    // registrations table and passing competitorId would violate the FK.
    if (deleted.approved && !deleted.is_test) {
      const tournament = await tournamentQueries.findById(tournamentId);
      if (tournament?.created_by) {
        await creditQueries.refundCredit(
          tournament.created_by,
          tournamentId,
          null,
          `Competitor deleted: refund for approval`
        );
      }
    }

    broadcastCompetitorUpdate(tournamentId, 'delete', { id: competitorId });
    res.json({ message: 'Competitor deleted', id: competitorId });
  } catch (err) { next(err); }
}

/**
 * PATCH /api/tournaments/:id/competitors/:competitorId/approve
 *
 * Approve a director-added competitor so they flow into divisions.
 * For real (non-test) competitors: deducts 1 credit from the director.
 * Hard-blocks with 402 if the director has insufficient credits.
 * Test competitors: free, no credit check.
 */
async function approveCompetitor(req, res, next) {
  try {
    const { id: tournamentId, competitorId } = req.params;
    const owned = await tournamentQueries.isOwnedBy(tournamentId, req.user.id);
    if (!owned) return res.status(403).json({ error: 'You do not own this tournament' });

    const tournament = await tournamentQueries.findById(tournamentId);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    // Fetch the competitor to determine if real or test
    const allCompetitors = await DirectorCompetitorQueries.getAll(tournamentId);
    const competitor = allCompetitors.find(c => String(c.id) === String(competitorId) && c.source === 'director');
    if (!competitor) return res.status(404).json({ error: 'Competitor not found' });

    if (competitor.approved) {
      return res.status(409).json({ error: 'Competitor is already approved' });
    }

    // Credit check for real competitors only
    if (!competitor.is_test) {
      const directorId = tournament.created_by;
      const balance = await creditQueries.getBalance(directorId);
      if (balance < 1) {
        return res.status(402).json({
          error: 'Insufficient credits. Purchase credits to approve competitors.',
          code: 'INSUFFICIENT_CREDITS',
          balance,
        });
      }

      // Set approved first, then deduct — if deduct fails we can still roll back
      const updated = await DirectorCompetitorQueries.approve(competitorId, tournamentId);
      if (!updated) return res.status(404).json({ error: 'Competitor not found' });

      const deductResult = await creditQueries.deductForRegistration(
        directorId,
        1,
        tournamentId,
        [null], // director competitors have no row in registrations table — pass null to avoid FK violation
        `Approval: ${competitor.firstName} ${competitor.lastName}`
      );

      if (!deductResult.success) {
        // Race condition — another approval consumed the last credit simultaneously.
        // Roll back the approval.
        await DirectorCompetitorQueries.unapprove(competitorId, tournamentId);
        return res.status(402).json({
          error: 'Insufficient credits. Purchase credits to approve competitors.',
          code: 'INSUFFICIENT_CREDITS',
          balance: deductResult.balance,
        });
      }

      broadcastCompetitorUpdate(tournamentId, 'update', { id: competitorId, approved: true });
      return res.json({ competitor: updated, newCreditBalance: deductResult.newBalance });
    }

    // Test competitor — approve for free
    const updated = await DirectorCompetitorQueries.approve(competitorId, tournamentId);
    if (!updated) return res.status(404).json({ error: 'Competitor not found' });

    broadcastCompetitorUpdate(tournamentId, 'update', { id: competitorId, approved: true });
    res.json({ competitor: updated });
  } catch (err) { next(err); }
}

/**
 * DELETE /api/tournaments/:id/competitors/:competitorId/approve
 *
 * Unapprove a competitor, removing them from division flow.
 * For real competitors: refunds 1 credit, but only if bracket_placed = false.
 * If bracket_placed = true: hard-blocks with 403 — credit is permanently consumed.
 * Test competitors: always unapprove-able, no credit involved.
 */
async function unapproveCompetitor(req, res, next) {
  try {
    const { id: tournamentId, competitorId } = req.params;
    const owned = await tournamentQueries.isOwnedBy(tournamentId, req.user.id);
    if (!owned) return res.status(403).json({ error: 'You do not own this tournament' });

    const tournament = await tournamentQueries.findById(tournamentId);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    const result = await DirectorCompetitorQueries.unapprove(competitorId, tournamentId);

    if (!result) return res.status(404).json({ error: 'Competitor not found' });

    if (result.error === 'BRACKET_LOCKED') {
      return res.status(403).json({
        error: 'This competitor has been placed in a bracket. Delete the bracket first to unapprove them.',
        code: 'BRACKET_LOCKED',
      });
    }

    // Refund credit for real competitors.
    // Pass null for registrationId — same FK reason as in approveCompetitor.
    if (!result.is_test) {
      const directorId = tournament.created_by;
      await creditQueries.refundCredit(
        directorId,
        tournamentId,
        null,
        `Unapproval refund`
      );
      const newBalance = await creditQueries.getBalance(directorId);
      broadcastCompetitorUpdate(tournamentId, 'update', { id: competitorId, approved: false });
      return res.json({ competitor: result, newCreditBalance: newBalance });
    }

    broadcastCompetitorUpdate(tournamentId, 'update', { id: competitorId, approved: false });
    res.json({ competitor: result });
  } catch (err) { next(err); }
}

async function _sendCompetitorInvite({ competitor, tournamentId, addedByUserId }) {
  const email = (competitor.email || '').toLowerCase().trim();
  if (!email) return;

  const tournament = await tournamentQueries.findById(tournamentId);
  const tournamentName = tournament ? tournament.name : 'a tournament';

  const addedByRes = await pool.query('SELECT first_name, last_name, email FROM users WHERE id = $1', [addedByUserId]);
  const addedBy = addedByRes.rows[0];
  const addedByName = addedBy ? `${addedBy.first_name || ''} ${addedBy.last_name || ''}`.trim() || addedBy.email : 'The organizer';

  // Find or create passwordless user
  const existing = await pool.query('SELECT id, account_claimed FROM users WHERE lower(email) = $1', [email]);
  let userId, claimed;
  if (existing.rows.length > 0) {
    userId = existing.rows[0].id;
    claimed = existing.rows[0].account_claimed;
  } else {
    const firstName = competitor.firstName || competitor.first_name || '';
    const lastName = competitor.lastName || competitor.last_name || '';
    const newUser = await pool.query(
      `INSERT INTO users (email, first_name, last_name, account_claimed)
       VALUES ($1, $2, $3, false)
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id, account_claimed`,
      [email, firstName, lastName]
    );
    userId = newUser.rows[0].id;
    claimed = newUser.rows[0].account_claimed;
  }

  if (claimed) return; // already has an account — don't re-invite

  // Generate 7-day claim token
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await pool.query(
    `UPDATE users SET verification_token = $1, verification_expires = $2 WHERE id = $3`,
    [token, expires, userId]
  );

  const fullName = `${competitor.firstName || competitor.first_name || ''} ${competitor.lastName || competitor.last_name || ''}`.trim() || email;
  await sendCompetitorInviteEmail({
    toEmail: email,
    toName: fullName,
    tournamentName,
    addedByName,
    claimUrl: `${process.env.APP_URL || 'http://localhost:3000'}/claim-account?token=${token}`,
  });
}

module.exports = { getCompetitors, addCompetitor, updateCompetitor, deleteCompetitor, approveCompetitor, unapproveCompetitor };
