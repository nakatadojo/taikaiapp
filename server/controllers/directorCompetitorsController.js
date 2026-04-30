const crypto = require('crypto');
const DirectorCompetitorQueries = require('../db/queries/directorCompetitors');
const creditQueries = require('../db/queries/credits');
const tournamentQueries = require('../db/queries/tournaments');
const pool = require('../db/pool');
const { sendCompetitorInviteEmail } = require('../email');
const { runAutoAssign } = require('../services/divisionAutoAssign');
const { assignDivision } = require('../services/divisionAssignment');

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
    res.status(201).json({ competitor: created });

    // Fire-and-forget: immediately place competitor into their division
    runAutoAssign(tournamentId, req.app.get('io')).catch(e => console.warn('[director] auto-assign after add failed:', e.message));

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

    res.json({ competitor: result });

    // Re-assign in case criteria-relevant fields (rank, age, weight) changed
    runAutoAssign(tournamentId, req.app.get('io')).catch(e => console.warn('[director] auto-assign after update failed:', e.message));
  } catch (err) { next(err); }
}

async function deleteCompetitor(req, res, next) {
  try {
    const { id: tournamentId, competitorId } = req.params;
    const owned = await tournamentQueries.isOwnedBy(tournamentId, req.user.id);
    if (!owned) return res.status(403).json({ error: 'You do not own this tournament' });

    let deleted = await DirectorCompetitorQueries.remove(competitorId, tournamentId);

    // If not found in director table, try cancelling the registration row
    // (registration-source competitors have profile_id or id = competitorId)
    if (!deleted) {
      const { rows } = await pool.query(
        `UPDATE registrations SET status = 'cancelled'
         WHERE tournament_id = $1
           AND (profile_id = $2 OR id = $2)
           AND status != 'cancelled'
         RETURNING id, payment_status`,
        [tournamentId, competitorId]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Competitor not found' });
      deleted = { id: rows[0].id, approved: false, is_test: false, source: 'registration' };
    }

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
const _UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function approveCompetitor(req, res, next) {
  try {
    const { id: tournamentId, competitorId } = req.params;
    if (!_UUID_RE.test(competitorId)) {
      return res.status(400).json({
        error: 'Invalid competitor ID. Please refresh the page — your local data may be out of date.',
        code: 'STALE_LOCAL_ID',
      });
    }
    const owned = await tournamentQueries.isOwnedBy(tournamentId, req.user.id);
    if (!owned) return res.status(403).json({ error: 'You do not own this tournament' });

    const tournament = await tournamentQueries.findById(tournamentId);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    // Fetch the competitor to determine if real or test
    const allCompetitors = await DirectorCompetitorQueries.getAll(tournamentId);
    const competitor = allCompetitors.find(c => String(c.id) === String(competitorId));
    if (!competitor) return res.status(404).json({ error: 'Competitor not found' });

    // Pay-later public registrations: no credit deduction needed — just run auto-assign
    if (competitor.source === 'registration') {
      runAutoAssign(tournamentId, req.app.get('io')).catch(e => console.warn('[director] auto-assign for pay-later failed:', e.message));
      return res.json({ competitor, source: 'registration' });
    }

    if (competitor.approved) {
      return res.status(409).json({ error: 'Competitor is already approved' });
    }

    // Block approval if any of this competitor's divisions already has scored matches
    const startedDivision = await _findStartedDivisionForCompetitor(competitor, tournamentId, tournament.date);
    if (startedDivision) {
      return res.status(409).json({
        error: 'This division has already started. Reset the bracket to approve new competitors.',
        code: 'DIVISION_STARTED',
        divisionName: startedDivision,
      });
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

      // Refresh divisions so approved status propagates immediately
      runAutoAssign(tournamentId, req.app.get('io')).catch(e => console.warn('[director] auto-assign after approve failed:', e.message));
      return res.json({ competitor: updated, newCreditBalance: deductResult.newBalance });
    }

    // Test competitor — approve for free
    const updated = await DirectorCompetitorQueries.approve(competitorId, tournamentId);
    if (!updated) return res.status(404).json({ error: 'Competitor not found' });

    // Refresh divisions so approved status propagates immediately
    runAutoAssign(tournamentId, req.app.get('io')).catch(e => console.warn('[director] auto-assign after approve failed:', e.message));
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
      return res.json({ competitor: result, newCreditBalance: newBalance });
    }

    res.json({ competitor: result });
  } catch (err) { next(err); }
}

/**
 * Check whether this competitor would be placed in a division that already
 * has a started (scored) bracket. Returns the division name if found, null otherwise.
 */
async function _findStartedDivisionForCompetitor(competitor, tournamentId, tournamentDate) {
  const compEvents = competitor.events || [];
  if (compEvents.length === 0) return null;

  const tRow = await pool.query('SELECT weight_unit FROM tournaments WHERE id = $1', [tournamentId]);
  const tournamentWeightUnit = tRow.rows[0]?.weight_unit || 'kg';

  const profile = {
    date_of_birth: competitor.dob || competitor.dateOfBirth || competitor.date_of_birth,
    gender: competitor.gender,
    belt_rank: competitor.rank || competitor.belt_rank,
    weight: competitor.weight,
    experience_level: competitor.experience || competitor.experience_level,
  };

  const eventsResult = await pool.query(
    `SELECT id, criteria_templates FROM tournament_events WHERE id = ANY($1::uuid[])`,
    [compEvents.map(String)]
  );

  for (const event of eventsResult.rows) {
    const templates = event.criteria_templates;
    if (!templates || !Array.isArray(templates) || templates.length === 0) continue;

    const divisionName = assignDivision(profile, templates, tournamentDate, tournamentWeightUnit);
    if (!divisionName) continue;

    const bracketResult = await pool.query(
      `SELECT data FROM tournament_brackets WHERE tournament_id = $1 AND division_name = $2`,
      [tournamentId, divisionName]
    );

    for (const row of bracketResult.rows) {
      if (_bracketHasScores(row.data)) return divisionName;
    }
  }
  return null;
}

/**
 * POST /api/tournaments/:id/competitors/batch-update
 *
 * Batch approve/unapprove/delete in one call so auto-assign runs once.
 * Body: { approveIds: [], unapproveIds: [], deleteIds: [] }
 */
async function batchUpdateCompetitors(req, res, next) {
  try {
    const tournamentId = req.params.id;
    const owned = await tournamentQueries.isOwnedBy(tournamentId, req.user.id);
    if (!owned) return res.status(403).json({ error: 'You do not own this tournament' });

    const tournament = await tournamentQueries.findById(tournamentId);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    const { approveIds = [], unapproveIds = [], deleteIds = [] } = req.body;
    const directorId = tournament.created_by;

    const allCompetitors = await DirectorCompetitorQueries.getAll(tournamentId);
    const byId = id => allCompetitors.find(c => String(c.id) === String(id));

    const errors = [];
    let creditsUsed = 0;

    // ── 1. Deletions ─────────────────────────────────────────────────────────
    for (const id of deleteIds) {
      await DirectorCompetitorQueries.remove(id, tournamentId);
    }

    // ── 2. Unapprovals ───────────────────────────────────────────────────────
    for (const id of unapproveIds) {
      const comp = byId(id);
      if (!comp) continue;
      if (comp.source === 'registration') continue; // pay-later handled separately
      const result = await DirectorCompetitorQueries.unapprove(id, tournamentId);
      if (!result) continue;
      if (result.error === 'BRACKET_LOCKED') {
        errors.push({ id, error: 'bracket_locked', name: `${comp.firstName} ${comp.lastName}` });
        continue;
      }
      // Refund credit for real unapproved competitors
      if (!comp.is_test && comp.approved) {
        await creditQueries.refundCredit(directorId, tournamentId, null,
          `Unapproval: ${comp.firstName} ${comp.lastName}`);
      }
    }

    // ── 3. Approvals ─────────────────────────────────────────────────────────
    // Filter to real unapproved director-managed competitors that need credits
    const toApproveReal = approveIds
      .map(byId).filter(Boolean)
      .filter(c => c.source !== 'registration' && !c.is_test && !c.approved);

    if (toApproveReal.length > 0) {
      const balance = await creditQueries.getBalance(directorId);
      if (balance < toApproveReal.length) {
        return res.status(402).json({
          error: `Not enough credits. Need ${toApproveReal.length}, have ${balance}.`,
          code: 'INSUFFICIENT_CREDITS',
          balance,
          needed: toApproveReal.length,
        });
      }
    }

    for (const id of approveIds) {
      const comp = byId(id);
      if (!comp) continue;

      // Pay-later registrations: no credit, just mark approved
      if (comp.source === 'registration') {
        continue;
      }
      if (comp.approved) continue; // already approved, skip

      const updated = await DirectorCompetitorQueries.approve(id, tournamentId);
      if (!updated) continue;

      if (!comp.is_test) {
        const deductResult = await creditQueries.deductForRegistration(
          directorId, 1, tournamentId, [null],
          `Approval: ${comp.firstName} ${comp.lastName}`
        );
        if (!deductResult.success) {
          await DirectorCompetitorQueries.unapprove(id, tournamentId);
          errors.push({ id, error: 'insufficient_credits', name: `${comp.firstName} ${comp.lastName}` });
          continue;
        }
        creditsUsed++;
      }
    }

    // ── 4. Single auto-assign run ─────────────────────────────────────────────
    runAutoAssign(tournamentId, req.app.get('io')).catch(e =>
      console.warn('[batch] auto-assign failed:', e.message)
    );

    const newBalance = creditsUsed > 0
      ? await creditQueries.getBalance(directorId)
      : undefined;

    res.json({
      message: 'Batch update complete',
      approved: approveIds.length,
      unapproved: unapproveIds.length,
      deleted: deleteIds.length,
      errors,
      ...(newBalance !== undefined ? { newCreditBalance: newBalance } : {}),
    });
  } catch (err) { next(err); }
}

/**
 * Return true if any match in the bracket data has recorded scores or results.
 */
function _bracketHasScores(data) {
  if (!data) return false;
  const str = JSON.stringify(data);
  if (/"winner"\s*:\s*(?!null\b)[^,}\]\s]/.test(str)) return true;
  if (/"completed"\s*:\s*true/.test(str)) return true;
  if (/"(?:score1?|score2|points|redScore|blueScore)"\s*:\s*[0-9]/.test(str)) return true;
  if (/"status"\s*:\s*"(?:completed|in-progress)"/.test(str)) return true;
  return false;
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

module.exports = { getCompetitors, addCompetitor, updateCompetitor, deleteCompetitor, approveCompetitor, unapproveCompetitor, batchUpdateCompetitors };
