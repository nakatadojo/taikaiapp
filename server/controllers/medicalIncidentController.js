const pool = require('../db/pool');
const MedicalIncidentQueries = require('../db/queries/medicalIncidents');
const tournamentQueries = require('../db/queries/tournaments');

const { csvEscape, buildCSV } = require('../utils/csv');

// ── Ownership Check ─────────────────────────────────────────────────────────

async function verifyOwnership(req, res) {
  const tournamentId = req.params.id;
  const tournament = await tournamentQueries.findById(tournamentId);
  if (!tournament) {
    res.status(404).json({ error: 'Tournament not found' });
    return null;
  }
  if (tournament.created_by !== req.user.id) {
    res.status(403).json({ error: 'Not authorized' });
    return null;
  }
  return tournament;
}

// ── Staff or Director Check ─────────────────────────────────────────────────

/**
 * Check if the user is the tournament creator OR an approved staff/judge member.
 * Returns the tournament row or null (with response already sent).
 */
async function verifyStaffOrDirector(req, res) {
  const tournamentId = req.params.id;
  const tournament = await tournamentQueries.findById(tournamentId);
  if (!tournament) {
    res.status(404).json({ error: 'Tournament not found' });
    return null;
  }

  // Tournament creator is always allowed
  if (tournament.created_by === req.user.id) {
    return tournament;
  }

  // Check if user is an approved tournament member (staff or judge)
  const { rows: [member] } = await pool.query(
    `SELECT id FROM tournament_members
     WHERE tournament_id = $1 AND user_id = $2 AND status = 'approved'`,
    [tournamentId, req.user.id]
  );

  if (!member) {
    res.status(403).json({ error: 'Not authorized for this tournament' });
    return null;
  }

  return tournament;
}

// ── Controllers ─────────────────────────────────────────────────────────────

/**
 * POST /api/tournaments/:id/medical-incidents
 * Log a new medical incident. Requires auth + tournament owner or approved staff.
 */
async function logIncident(req, res, next) {
  try {
    const tournament = await verifyStaffOrDirector(req, res);
    if (!tournament) return;

    const {
      competitorProfileId,
      competitorName,
      matNumber,
      description,
      officialPresent,
      ableToContinue,
      medicalStaffCalled,
    } = req.body;

    if (!competitorName || !competitorName.trim()) {
      return res.status(400).json({ error: 'Competitor name is required' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const incident = await MedicalIncidentQueries.create({
      tournamentId: tournament.id,
      competitorProfileId: competitorProfileId || null,
      competitorName: competitorName.trim(),
      matNumber: matNumber || null,
      description: description.trim(),
      officialPresent: officialPresent || null,
      ableToContinue: ableToContinue || false,
      medicalStaffCalled: medicalStaffCalled || false,
      loggedBy: req.user.id,
    });

    res.status(201).json({ incident });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tournaments/:id/medical-incidents
 * List all incidents for a tournament. Requires auth + tournament owner (ownership).
 */
async function getIncidents(req, res, next) {
  try {
    const tournament = await verifyOwnership(req, res);
    if (!tournament) return;

    const incidents = await MedicalIncidentQueries.getByTournament(tournament.id);
    res.json({ incidents });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tournaments/:id/medical-incidents/export.csv
 * Export all incidents as CSV. Requires auth + tournament owner (ownership).
 */
async function exportIncidents(req, res, next) {
  try {
    const tournament = await verifyOwnership(req, res);
    if (!tournament) return;

    const incidents = await MedicalIncidentQueries.exportForTournament(tournament.id);

    const headers = [
      'Date/Time', 'Competitor', 'Dojo', 'Belt', 'Mat',
      'Description', 'Official Present', 'Able to Continue',
      'Medical Staff Called', 'Logged By',
    ];

    const rows = incidents.map(i => {
      const timestamp = i.created_at
        ? new Date(i.created_at).toLocaleString('en-US')
        : '';
      const loggedBy = [i.logged_by_first_name, i.logged_by_last_name]
        .filter(Boolean).join(' ') || '';

      return [
        timestamp,
        i.competitor_name || '',
        i.academy_name || '',
        i.belt_rank || '',
        i.mat_number || '',
        i.description || '',
        i.official_present || '',
        i.able_to_continue ? 'Yes' : 'No',
        i.medical_staff_called ? 'Yes' : 'No',
        loggedBy,
      ];
    });

    const csv = buildCSV(headers, rows);
    const filename = `medical-incidents-${tournament.id}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  logIncident,
  getIncidents,
  exportIncidents,
};
