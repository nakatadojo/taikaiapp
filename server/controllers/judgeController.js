const JudgeAssignmentQueries = require('../db/queries/judgeAssignments');
const { broadcastJudgeEvent } = require('../websocket');

// ── Helpers ───────────────────────────────────────────────────────────────────

function _requireOwner(req, res) {
  if (req.user?.id !== req.tournament?.created_by) {
    res.status(403).json({ error: 'Not authorized' });
    return false;
  }
  return true;
}

// ── Director: CRUD assignments ────────────────────────────────────────────────

async function getAssignments(req, res, next) {
  try {
    const assignments = await JudgeAssignmentQueries.getByTournament(req.params.id);
    res.json({ assignments });
  } catch (err) { next(err); }
}

async function createAssignment(req, res, next) {
  try {
    const tournamentId = req.params.id;
    const { officialName, userId, matId, chair, scheduledFrom, scheduledUntil } = req.body;

    if (!officialName || !matId || !chair) {
      return res.status(400).json({ error: 'officialName, matId, and chair are required' });
    }

    const assignment = await JudgeAssignmentQueries.create({
      tournamentId, userId, officialName,
      matId: parseInt(matId, 10), chair,
      scheduledFrom: scheduledFrom || null,
      scheduledUntil: scheduledUntil || null,
    });

    broadcastJudgeEvent(tournamentId, assignment.mat_id, 'judge:assignment_created', assignment);
    res.status(201).json({ assignment });
  } catch (err) { next(err); }
}

async function updateAssignment(req, res, next) {
  try {
    const { assignmentId } = req.params;
    const { officialName, userId, matId, chair, scheduledFrom, scheduledUntil } = req.body;

    const updated = await JudgeAssignmentQueries.update(assignmentId, {
      officialName, userId,
      matId: matId ? parseInt(matId, 10) : undefined,
      chair, scheduledFrom, scheduledUntil,
    });

    if (!updated) return res.status(404).json({ error: 'Assignment not found' });

    broadcastJudgeEvent(req.params.id, updated.mat_id, 'judge:assignment_updated', updated);
    res.json({ assignment: updated });
  } catch (err) { next(err); }
}

async function deleteAssignment(req, res, next) {
  try {
    const { assignmentId } = req.params;
    const existing = await JudgeAssignmentQueries.getById(assignmentId);
    if (!existing) return res.status(404).json({ error: 'Assignment not found' });

    await JudgeAssignmentQueries.delete(assignmentId);
    broadcastJudgeEvent(req.params.id, existing.mat_id, 'judge:assignment_deleted', { id: assignmentId });
    res.json({ message: 'Assignment deleted', id: assignmentId });
  } catch (err) { next(err); }
}

// ── Judge device: Sit / Stand ─────────────────────────────────────────────────

async function sitDown(req, res, next) {
  try {
    const { assignmentId } = req.params;
    const assignment = await JudgeAssignmentQueries.getById(assignmentId);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

    // Only the assigned judge (or a director) can sit
    if (assignment.user_id && assignment.user_id !== req.user.id) {
      return res.status(403).json({ error: 'This assignment belongs to a different judge' });
    }

    const updated = await JudgeAssignmentQueries.sit(assignmentId);

    // Broadcast sit event to the mat room
    broadcastJudgeEvent(req.params.id, updated.mat_id, 'judge:seated', {
      assignmentId: updated.id,
      chair: updated.chair,
      officialName: updated.official_name,
      matId: updated.mat_id,
      seatedAt: updated.seated_at,
    });

    // Check if panel is now complete and broadcast mat:panel_ready
    const seated = await JudgeAssignmentQueries.getSeatedForMat(req.params.id, updated.mat_id);
    broadcastJudgeEvent(req.params.id, updated.mat_id, 'mat:panel_status', {
      matId: updated.mat_id,
      seatedCount: seated.length,
      seated: seated.map(s => ({ chair: s.chair, officialName: s.official_name })),
    });

    res.json({ assignment: updated });
  } catch (err) { next(err); }
}

async function standUp(req, res, next) {
  try {
    const { assignmentId } = req.params;
    const assignment = await JudgeAssignmentQueries.getById(assignmentId);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

    if (assignment.user_id && assignment.user_id !== req.user.id) {
      return res.status(403).json({ error: 'This assignment belongs to a different judge' });
    }

    const updated = await JudgeAssignmentQueries.stand(assignmentId);

    broadcastJudgeEvent(req.params.id, updated.mat_id, 'judge:stood', {
      assignmentId: updated.id,
      chair: updated.chair,
      officialName: updated.official_name,
      matId: updated.mat_id,
      stoodAt: updated.stood_at,
    });

    // Broadcast updated panel status
    const seated = await JudgeAssignmentQueries.getSeatedForMat(req.params.id, updated.mat_id);
    broadcastJudgeEvent(req.params.id, updated.mat_id, 'mat:panel_status', {
      matId: updated.mat_id,
      seatedCount: seated.length,
      seated: seated.map(s => ({ chair: s.chair, officialName: s.official_name })),
    });

    res.json({ assignment: updated });
  } catch (err) { next(err); }
}

// ── Panel status ──────────────────────────────────────────────────────────────

async function getPanelStatus(req, res, next) {
  try {
    const { id: tournamentId, matId } = req.params;
    const panel = await JudgeAssignmentQueries.getPanelStatus(tournamentId, parseInt(matId, 10));
    res.json({ matId: parseInt(matId, 10), panel });
  } catch (err) { next(err); }
}

// ── Judge's own assignments ───────────────────────────────────────────────────

async function getMyAssignments(req, res, next) {
  try {
    const assignments = await JudgeAssignmentQueries.getByUser(req.user.id, req.params.id);
    res.json({ assignments });
  } catch (err) { next(err); }
}

module.exports = {
  getAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  sitDown,
  standUp,
  getPanelStatus,
  getMyAssignments,
};
