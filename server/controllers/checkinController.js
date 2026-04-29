const CheckinQueries = require('../db/queries/checkins');
const pool = require('../db/pool');
const { sendDivisionReadyEmail } = require('../email');

/**
 * GET /api/tournaments/:id/checkin
 * List all registrations with check-in status.
 */
async function list(req, res, next) {
  try {
    const competitors = await CheckinQueries.getByTournament(req.params.id);
    const stats = await CheckinQueries.getStats(req.params.id);
    res.json({ competitors, stats });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/tournaments/:id/checkin
 * Check in a competitor (status = 'checked_in').
 * Body: { registrationId, notes?, actualWeight?, weightVerified?, aauVerified? }
 */
async function checkin(req, res, next) {
  try {
    const { registrationId, notes, actualWeight, weightVerified, aauVerified } = req.body;
    if (!registrationId) {
      return res.status(400).json({ error: 'registrationId is required' });
    }

    const regCheck = await pool.query(
      `SELECT id FROM registrations WHERE id = $1 AND tournament_id = $2 AND status != 'cancelled'`,
      [registrationId, req.params.id]
    );
    if (regCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Registration not found in this tournament' });
    }

    const record = await CheckinQueries.create({
      tournamentId: req.params.id,
      registrationId,
      checkedInBy: req.user.id,
      notes,
      actualWeight: actualWeight != null ? parseFloat(actualWeight) : null,
      weightVerified: !!weightVerified,
      aauVerified: !!aauVerified,
    });

    const stats = await CheckinQueries.getStats(req.params.id);
    res.status(201).json({ checkin: record, stats });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Competitor is already checked in' });
    }
    next(err);
  }
}

/**
 * POST /api/tournaments/:id/checkin/absent
 * Mark a competitor as absent (no-show).
 * Body: { registrationId, reason? }
 */
async function markAbsent(req, res, next) {
  try {
    const { registrationId, reason } = req.body;
    if (!registrationId) {
      return res.status(400).json({ error: 'registrationId is required' });
    }

    const regCheck = await pool.query(
      `SELECT id FROM registrations WHERE id = $1 AND tournament_id = $2 AND status != 'cancelled'`,
      [registrationId, req.params.id]
    );
    if (regCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Registration not found in this tournament' });
    }

    const record = await CheckinQueries.markAbsent({
      tournamentId: req.params.id,
      registrationId,
      markedBy: req.user.id,
      reason,
    });

    const stats = await CheckinQueries.getStats(req.params.id);
    res.json({ checkin: record, stats });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/tournaments/:id/checkin/withdrawn
 * Mark a competitor as withdrawn (pulled out day-of).
 * Body: { registrationId, reason? }
 */
async function markWithdrawn(req, res, next) {
  try {
    const { registrationId, reason } = req.body;
    if (!registrationId) {
      return res.status(400).json({ error: 'registrationId is required' });
    }

    const regCheck = await pool.query(
      `SELECT id FROM registrations WHERE id = $1 AND tournament_id = $2 AND status != 'cancelled'`,
      [registrationId, req.params.id]
    );
    if (regCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Registration not found in this tournament' });
    }

    const record = await CheckinQueries.markWithdrawn({
      tournamentId: req.params.id,
      registrationId,
      markedBy: req.user.id,
      reason,
    });

    const stats = await CheckinQueries.getStats(req.params.id);
    res.json({ checkin: record, stats });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/tournaments/:id/checkin/:registrationId/mat-call
 * Mark competitor as called to mat (prevents undo).
 */
async function matCall(req, res, next) {
  try {
    const record = await CheckinQueries.markMatCalled(
      req.params.id,
      req.params.registrationId,
      req.user.id
    );

    if (!record) {
      return res.status(404).json({ error: 'Competitor is not checked in' });
    }

    // Fire division-ready email for this competitor (fire-and-forget)
    try {
      const { rows: regRows } = await pool.query(
        `SELECT COALESCE(u.email, cp.guardian_email) AS email,
                cp.first_name,
                t.name AS tournament_name,
                re.assigned_division
         FROM registrations r
         LEFT JOIN competitor_profiles cp ON cp.id = r.profile_id
         LEFT JOIN users u ON u.id = r.user_id
         LEFT JOIN tournament_events te ON te.tournament_id = r.tournament_id
         LEFT JOIN registration_events re ON re.registration_id = r.id
         JOIN tournaments t ON t.id = r.tournament_id
         WHERE r.id = $1 LIMIT 1`,
        [req.params.registrationId]
      );
      if (regRows[0]?.email) {
        sendDivisionReadyEmail({
          competitorEmail: regRows[0].email,
          competitorName: regRows[0].first_name,
          tournament: { name: regRows[0].tournament_name },
          divisionName: regRows[0].assigned_division || 'your division',
          matName: req.body?.matName || null,
        }).catch(e => console.warn('[email] divisionReady failed:', e.message));
      }
    } catch (e) { console.warn('[email] matCall lookup failed:', e.message); }

    res.json({ checkin: record });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/tournaments/:id/checkin/:registrationId
 * Undo a check-in. Blocked if competitor has been called to mat.
 */
async function undoCheckin(req, res, next) {
  try {
    const result = await CheckinQueries.remove(
      req.params.id,
      req.params.registrationId
    );

    if (!result.deleted) {
      if (result.reason === 'not_found') {
        return res.status(404).json({ error: 'Competitor is not checked in' });
      }
      if (result.reason === 'mat_called') {
        return res.status(409).json({
          error: 'Cannot undo check-in — competitor has been called to the mat.',
          code: 'MAT_CALLED',
        });
      }
    }

    const stats = await CheckinQueries.getStats(req.params.id);
    res.json({ message: 'Check-in undone', stats });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tournaments/:id/checkin/stats
 */
async function stats(req, res, next) {
  try {
    const data = await CheckinQueries.getStats(req.params.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tournaments/:id/checkin/absent-withdrawn
 * Returns all competitors marked absent or withdrawn — used by bracket generation.
 */
async function absentAndWithdrawn(req, res, next) {
  try {
    const data = await CheckinQueries.getAbsentAndWithdrawn(req.params.id);
    res.json({ competitors: data });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, checkin, markAbsent, markWithdrawn, matCall, undoCheckin, stats, absentAndWithdrawn };
