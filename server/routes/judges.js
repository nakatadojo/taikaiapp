const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requireTournamentOwner } = require('../middleware/tournament');
const judgeController = require('../controllers/judgeController');

// ── Director routes (owner only) ──────────────────────────────────────────────

// GET  /:id/judge-assignments          — all assignments for a tournament
router.get('/:id/judge-assignments', requireAuth, judgeController.getAssignments);

// POST /:id/judge-assignments          — create a new assignment
router.post('/:id/judge-assignments', requireAuth, requireTournamentOwner, judgeController.createAssignment);

// PUT  /:id/judge-assignments/:assignmentId — update an assignment
router.put('/:id/judge-assignments/:assignmentId', requireAuth, requireTournamentOwner, judgeController.updateAssignment);

// DELETE /:id/judge-assignments/:assignmentId — remove an assignment
router.delete('/:id/judge-assignments/:assignmentId', requireAuth, requireTournamentOwner, judgeController.deleteAssignment);

// ── Panel status (scoreboard operator / director) ─────────────────────────────

// GET /:id/mats/:matId/panel-status    — who is currently seated on this mat
router.get('/:id/mats/:matId/panel-status', requireAuth, judgeController.getPanelStatus);

// ── Judge device routes (any authenticated user) ──────────────────────────────

// GET  /:id/my-assignments             — judge sees their own assignments for this tournament
router.get('/:id/my-assignments', requireAuth, judgeController.getMyAssignments);

// POST /:id/judge-assignments/:assignmentId/sit   — judge sits down
router.post('/:id/judge-assignments/:assignmentId/sit', requireAuth, judgeController.sitDown);

// POST /:id/judge-assignments/:assignmentId/stand — judge stands up (relieved)
router.post('/:id/judge-assignments/:assignmentId/stand', requireAuth, judgeController.standUp);

module.exports = router;
