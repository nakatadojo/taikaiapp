const JudgeAnalyticsQueries = require('../db/queries/judgeAnalytics');
const tournamentQueries = require('../db/queries/tournaments');

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

// ── Controllers ─────────────────────────────────────────────────────────────

/**
 * POST /api/tournaments/:id/judge-votes/sync
 * Bulk-sync vote records from the client.
 * Expects body: { votes: [ { matchId, divisionName, judgeName, judgeIndex, vote,
 *   majorityVote, votedWithMajority, voteDurationSeconds, competitorDojo } ] }
 */
async function syncVotes(req, res, next) {
  try {
    const tournament = await verifyOwnership(req, res);
    if (!tournament) return;

    const { votes } = req.body;
    if (!Array.isArray(votes) || votes.length === 0) {
      return res.status(400).json({ error: 'votes array is required and must not be empty' });
    }

    // Validate each vote has required fields
    for (let i = 0; i < votes.length; i++) {
      const v = votes[i];
      if (!v.matchId || !v.vote) {
        return res.status(400).json({ error: `Vote at index ${i} missing required fields (matchId, vote)` });
      }
    }

    const inserted = await JudgeAnalyticsQueries.bulkInsert(tournament.id, votes);
    res.status(201).json({ inserted: inserted.length });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tournaments/:id/judge-analytics
 * Returns aggregated per-judge stats for a tournament.
 */
async function getTournamentStats(req, res, next) {
  try {
    const tournament = await verifyOwnership(req, res);
    if (!tournament) return;

    const stats = await JudgeAnalyticsQueries.getJudgeStats(tournament.id);

    // Also get summary totals
    const totalVotes = stats.reduce((sum, s) => sum + s.total_votes, 0);
    const totalWithMajority = stats.reduce((sum, s) => sum + s.votes_with_majority, 0);
    const overallConsistency = totalVotes > 0
      ? Math.round((totalWithMajority / totalVotes) * 1000) / 10
      : 0;

    // Count unique matches
    const allVotes = await JudgeAnalyticsQueries.getByTournament(tournament.id);
    const uniqueMatches = new Set(allVotes.map(v => v.match_id)).size;

    res.json({
      summary: {
        totalMatches: uniqueMatches,
        totalVotes,
        overallConsistency,
      },
      judges: stats,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/judge-analytics
 * Cross-tournament aggregate stats. Requires super_admin role.
 */
async function getAdminAggregateStats(req, res, next) {
  try {
    const stats = await JudgeAnalyticsQueries.getAggregateStats();

    const totalVotes = stats.reduce((sum, s) => sum + s.total_votes, 0);
    const totalWithMajority = stats.reduce((sum, s) => sum + s.votes_with_majority, 0);
    const overallConsistency = totalVotes > 0
      ? Math.round((totalWithMajority / totalVotes) * 1000) / 10
      : 0;

    res.json({
      summary: {
        totalJudges: stats.length,
        totalVotes,
        overallConsistency,
      },
      judges: stats,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  syncVotes,
  getTournamentStats,
  getAdminAggregateStats,
};
