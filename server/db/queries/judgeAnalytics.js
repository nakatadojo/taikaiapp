const pool = require('../pool');

const JudgeAnalyticsQueries = {
  /**
   * Insert a single vote record.
   */
  async recordVote(data) {
    const { rows } = await pool.query(
      `INSERT INTO judge_votes
        (tournament_id, match_id, division_name, judge_user_id, judge_name,
         vote, majority_vote, voted_with_majority, vote_duration_seconds, competitor_dojo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.tournamentId,
        data.matchId,
        data.divisionName || null,
        data.judgeUserId || null,
        data.judgeName,
        data.vote,
        data.majorityVote || null,
        data.votedWithMajority != null ? data.votedWithMajority : null,
        data.voteDurationSeconds != null ? data.voteDurationSeconds : null,
        data.competitorDojo || null,
      ]
    );
    return rows[0];
  },

  /**
   * Get all vote records for a tournament.
   */
  async getByTournament(tournamentId) {
    const { rows } = await pool.query(
      `SELECT * FROM judge_votes
       WHERE tournament_id = $1
       ORDER BY created_at DESC`,
      [tournamentId]
    );
    return rows;
  },

  /**
   * Aggregated per-judge stats for a single tournament.
   * Returns: judge_name, total_votes, votes_with_majority, consistency_rate,
   *          avg_vote_duration, and dojo bias flags.
   */
  async getJudgeStats(tournamentId) {
    // Per-judge aggregates
    const { rows: judgeRows } = await pool.query(
      `SELECT
         judge_name,
         COUNT(*)::int AS total_votes,
         COUNT(*) FILTER (WHERE voted_with_majority = true)::int AS votes_with_majority,
         CASE WHEN COUNT(*) > 0
           THEN ROUND(COUNT(*) FILTER (WHERE voted_with_majority = true)::numeric / COUNT(*)::numeric * 100, 1)
           ELSE 0
         END AS consistency_rate,
         ROUND(AVG(vote_duration_seconds)::numeric, 2) AS avg_vote_duration
       FROM judge_votes
       WHERE tournament_id = $1
       GROUP BY judge_name
       ORDER BY judge_name`,
      [tournamentId]
    );

    // Dojo bias detection per judge: votes for each dojo when that dojo appears
    const { rows: biasRows } = await pool.query(
      `SELECT
         judge_name,
         competitor_dojo,
         COUNT(*)::int AS votes_for_dojo,
         (SELECT COUNT(*)::int
          FROM judge_votes jv2
          WHERE jv2.tournament_id = $1
            AND jv2.judge_name = jv.judge_name
            AND jv2.match_id IN (
              SELECT match_id FROM judge_votes
              WHERE tournament_id = $1 AND competitor_dojo = jv.competitor_dojo
            )
         ) AS matches_with_dojo
       FROM judge_votes jv
       WHERE tournament_id = $1
         AND competitor_dojo IS NOT NULL
         AND competitor_dojo != ''
       GROUP BY judge_name, competitor_dojo
       HAVING COUNT(*) >= 3`,
      [tournamentId]
    );

    // Attach bias flags to each judge
    const biasMap = {};
    for (const row of biasRows) {
      // A judge is flagged if they voted for a dojo >60% of the time
      // AND they judged that dojo in 5+ matches
      if (row.matches_with_dojo >= 5 && row.votes_for_dojo / row.matches_with_dojo > 0.6) {
        if (!biasMap[row.judge_name]) biasMap[row.judge_name] = [];
        biasMap[row.judge_name].push({
          dojo: row.competitor_dojo,
          votesForDojo: row.votes_for_dojo,
          matchesWithDojo: row.matches_with_dojo,
          rate: Math.round((row.votes_for_dojo / row.matches_with_dojo) * 100),
        });
      }
    }

    return judgeRows.map(j => ({
      ...j,
      biasFlags: biasMap[j.judge_name] || [],
    }));
  },

  /**
   * Cross-tournament admin view: per-judge stats across all tournaments.
   */
  async getAggregateStats() {
    const { rows } = await pool.query(
      `SELECT
         judge_name,
         COUNT(DISTINCT tournament_id)::int AS tournaments_judged,
         COUNT(*)::int AS total_votes,
         COUNT(*) FILTER (WHERE voted_with_majority = true)::int AS votes_with_majority,
         CASE WHEN COUNT(*) > 0
           THEN ROUND(COUNT(*) FILTER (WHERE voted_with_majority = true)::numeric / COUNT(*)::numeric * 100, 1)
           ELSE 0
         END AS consistency_rate,
         ROUND(AVG(vote_duration_seconds)::numeric, 2) AS avg_vote_duration
       FROM judge_votes
       GROUP BY judge_name
       ORDER BY total_votes DESC`
    );

    // Dojo bias detection across all tournaments
    const { rows: biasRows } = await pool.query(
      `SELECT
         judge_name,
         competitor_dojo,
         COUNT(*)::int AS votes_for_dojo,
         (SELECT COUNT(*)::int
          FROM judge_votes jv2
          WHERE jv2.judge_name = jv.judge_name
            AND jv2.match_id IN (
              SELECT match_id FROM judge_votes
              WHERE competitor_dojo = jv.competitor_dojo
            )
         ) AS matches_with_dojo
       FROM judge_votes jv
       WHERE competitor_dojo IS NOT NULL
         AND competitor_dojo != ''
       GROUP BY judge_name, competitor_dojo
       HAVING COUNT(*) >= 3`
    );

    const biasMap = {};
    for (const row of biasRows) {
      if (row.matches_with_dojo >= 5 && row.votes_for_dojo / row.matches_with_dojo > 0.6) {
        if (!biasMap[row.judge_name]) biasMap[row.judge_name] = [];
        biasMap[row.judge_name].push({
          dojo: row.competitor_dojo,
          votesForDojo: row.votes_for_dojo,
          matchesWithDojo: row.matches_with_dojo,
          rate: Math.round((row.votes_for_dojo / row.matches_with_dojo) * 100),
        });
      }
    }

    return rows.map(j => ({
      ...j,
      biasFlags: biasMap[j.judge_name] || [],
    }));
  },

  /**
   * Bulk insert multiple vote records (for syncing from client).
   * Uses a single INSERT with unnest for performance.
   */
  async bulkInsert(tournamentId, votes) {
    if (!votes || votes.length === 0) return [];

    // Build values for multi-row INSERT
    const values = [];
    const placeholders = [];
    let idx = 1;

    for (const v of votes) {
      placeholders.push(
        `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`
      );
      values.push(
        tournamentId,
        v.matchId,
        v.divisionName || null,
        v.judgeUserId || null,
        v.judgeName || `Judge ${(v.judgeIndex || 0) + 1}`,
        v.vote,
        v.majorityVote || null,
        v.votedWithMajority != null ? v.votedWithMajority : null,
        v.voteDurationSeconds != null ? v.voteDurationSeconds : null,
        v.competitorDojo || null,
      );
    }

    const { rows } = await pool.query(
      `INSERT INTO judge_votes
        (tournament_id, match_id, division_name, judge_user_id, judge_name,
         vote, majority_vote, voted_with_majority, vote_duration_seconds, competitor_dojo)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT DO NOTHING
       RETURNING *`,
      values
    );

    return rows;
  },
};

module.exports = JudgeAnalyticsQueries;
