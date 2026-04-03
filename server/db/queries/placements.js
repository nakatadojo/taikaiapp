const pool = require('../pool');

const PlacementQueries = {
  // ── Point Rules ─────────────────────────────────────────────────────────────

  /** Fetch all point rules for a tournament, ordered by placement. */
  async getRules(tournamentId) {
    const { rows } = await pool.query(
      `SELECT * FROM tournament_point_rules
       WHERE tournament_id = $1
       ORDER BY placement ASC`,
      [tournamentId]
    );
    return rows;
  },

  /**
   * Replace all point rules for a tournament in one shot.
   * rules: [{ placement, points, medal? }]
   */
  async setRules(tournamentId, rules) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'DELETE FROM tournament_point_rules WHERE tournament_id = $1',
        [tournamentId]
      );
      const saved = [];
      for (const r of rules) {
        const { rows } = await client.query(
          `INSERT INTO tournament_point_rules (tournament_id, placement, points, medal)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [tournamentId, r.placement, r.points || 0, r.medal || null]
        );
        saved.push(rows[0]);
      }
      await client.query('COMMIT');
      return saved;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // ── Placements ──────────────────────────────────────────────────────────────

  /**
   * Replace all placement rows for a specific result_id.
   * Called each time a division is published or re-synced while published.
   *
   * resultsData: array of { rank, name, club, ... } from published_results.results_data
   * rules:       array of { placement, points, medal } for this tournament
   */
  async syncForResult(tournamentId, resultId, eventName, divisionName, resultsData, rules) {
    // Build a lookup map placement → { points, medal }
    const ruleMap = {};
    for (const r of rules) {
      ruleMap[r.placement] = { points: r.points, medal: r.medal };
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Remove stale rows for this result
      await client.query(
        'DELETE FROM competitor_placements WHERE result_id = $1',
        [resultId]
      );

      const saved = [];
      for (const entry of (resultsData || [])) {
        const rank = parseInt(entry.rank, 10);
        if (!rank || !entry.name) continue;

        const rule = ruleMap[rank] || { points: 0, medal: null };

        const { rows } = await client.query(
          `INSERT INTO competitor_placements
             (tournament_id, result_id, competitor_name, club_name,
              event_name, division_name, placement, points_awarded, medal)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [
            tournamentId,
            resultId,
            entry.name,
            entry.club || null,
            eventName,
            divisionName,
            rank,
            rule.points,
            rule.medal || null,
          ]
        );
        saved.push(rows[0]);
      }

      await client.query('COMMIT');
      return saved;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Remove all placement rows for a result (called on unpublish).
   */
  async removeForResult(resultId) {
    await pool.query(
      'DELETE FROM competitor_placements WHERE result_id = $1',
      [resultId]
    );
  },

  // ── Leaderboard ─────────────────────────────────────────────────────────────

  /**
   * Aggregate leaderboard for a tournament.
   * Returns rows sorted by total points desc, then gold desc, silver desc, bronze desc.
   *
   * Row shape:
   *   { competitor_name, club_name, total_points, gold, silver, bronze,
   *     division_count, divisions: [{event_name, division_name, placement, points_awarded, medal}] }
   */
  async getLeaderboard(tournamentId) {
    const { rows } = await pool.query(
      `SELECT
         competitor_name,
         club_name,
         SUM(points_awarded)                                         AS total_points,
         COUNT(*) FILTER (WHERE medal = 'gold')::int                 AS gold,
         COUNT(*) FILTER (WHERE medal = 'silver')::int               AS silver,
         COUNT(*) FILTER (WHERE medal = 'bronze')::int               AS bronze,
         COUNT(*)::int                                               AS division_count,
         JSON_AGG(
           JSON_BUILD_OBJECT(
             'eventName',    event_name,
             'divisionName', division_name,
             'placement',    placement,
             'points',       points_awarded,
             'medal',        medal
           ) ORDER BY event_name, division_name
         )                                                            AS divisions
       FROM competitor_placements
       WHERE tournament_id = $1
       GROUP BY competitor_name, club_name
       ORDER BY
         total_points DESC,
         gold DESC,
         silver DESC,
         bronze DESC,
         competitor_name ASC`,
      [tournamentId]
    );
    return rows;
  },

  /**
   * Medal tally grouped by club/academy — totals only.
   */
  async getClubTally(tournamentId) {
    const { rows } = await pool.query(
      `SELECT
         COALESCE(club_name, 'Independent')                          AS club_name,
         SUM(points_awarded)                                         AS total_points,
         COUNT(*) FILTER (WHERE medal = 'gold')::int                 AS gold,
         COUNT(*) FILTER (WHERE medal = 'silver')::int               AS silver,
         COUNT(*) FILTER (WHERE medal = 'bronze')::int               AS bronze,
         COUNT(*)::int                                               AS total_placements
       FROM competitor_placements
       WHERE tournament_id = $1
       GROUP BY COALESCE(club_name, 'Independent')
       ORDER BY
         gold DESC,
         silver DESC,
         bronze DESC,
         total_points DESC,
         club_name ASC`,
      [tournamentId]
    );
    return rows;
  },
};

module.exports = PlacementQueries;
