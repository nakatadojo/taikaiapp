const CheckinQueries = require('../db/queries/checkins');

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
 * Check in a competitor.
 * Body: { registrationId, notes?, actualWeight?, weightVerified?, aauVerified? }
 */
async function checkin(req, res, next) {
  try {
    const { registrationId, notes, actualWeight, weightVerified, aauVerified } = req.body;
    if (!registrationId) {
      return res.status(400).json({ error: 'registrationId is required' });
    }

    // Verify the registration belongs to this tournament before creating a checkin record
    const pool = require('../db/pool');
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
    // Unique constraint violation — already checked in
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Competitor is already checked in' });
    }
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
          error: 'Cannot undo check-in — competitor has been called to the mat. Undoing would cause bracket confusion.',
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
 * Quick check-in statistics.
 */
async function stats(req, res, next) {
  try {
    const data = await CheckinQueries.getStats(req.params.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, checkin, matCall, undoCheckin, stats };
