const pool = require('../db/pool');
const { normalizeRank } = require('../services/divisionAssignment');

const RANK_ORDER = [
  '10th kyu','9th kyu','8th kyu','7th kyu','6th kyu','5th kyu',
  '4th kyu','3rd kyu','2nd kyu','1st kyu',
  '1st dan','2nd dan','3rd dan','4th dan','5th dan',
  '6th dan','7th dan','8th dan','9th dan','10th dan',
];

/**
 * GET /api/tournaments/:id/registration-fields
 *
 * Returns which optional fields to show on the registration form and what
 * options to populate them with, derived from the tournament's event criteria.
 *
 * Response shape:
 * {
 *   showExperienceLevel: boolean,
 *   experienceLevelOptions: string[],
 *   showBeltRank: boolean,
 *   beltRankOptions: string[],
 *   showWeight: boolean,
 *   weightUnit: 'kg'
 * }
 */
async function getRegistrationFields(req, res, next) {
  try {
    const { id } = req.params;

    // 1. Read tournament to get require_weight_at_registration
    const tournamentResult = await pool.query(
      'SELECT require_weight_at_registration, weight_unit FROM tournaments WHERE id = $1',
      [id]
    );

    if (tournamentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const tournament = tournamentResult.rows[0];

    // 2. Read all event criteria_templates for this tournament
    const eventsResult = await pool.query(
      `SELECT criteria_templates
         FROM tournament_events
        WHERE tournament_id = $1
          AND criteria_templates IS NOT NULL`,
      [id]
    );

    // 3. Scan criteria to find what's used
    let showExperienceLevel = false;
    let showBeltRank = false;
    let showGender = false;
    let showWeightFromCriteria = false;
    const experienceLevelOptions = [];
    const beltRankOptions = [];

    const seenExperience = new Set();
    const seenRank = new Set();

    for (const row of eventsResult.rows) {
      const templates = row.criteria_templates;
      if (!Array.isArray(templates)) continue;

      for (const template of templates) {
        if (!template || typeof template !== 'object') continue;
        // Each template has a nested `criteria` array; fall back to treating
        // the item itself as a flat criterion for legacy/flat formats.
        const criteriaList = Array.isArray(template.criteria)
          ? template.criteria
          : [template];

        for (const criteria of criteriaList) {
          if (!criteria || typeof criteria !== 'object') continue;
          const type = criteria.type;

          if (type === 'experience') {
            showExperienceLevel = true;
            const options = _extractOptions(criteria);
            for (const opt of options) {
              if (!seenExperience.has(opt)) {
                seenExperience.add(opt);
                experienceLevelOptions.push(opt);
              }
            }
          } else if (type === 'rank') {
            showBeltRank = true;
            const options = _extractOptions(criteria);
            for (const opt of options) {
              if (!seenRank.has(opt)) {
                seenRank.add(opt);
                beltRankOptions.push(opt);
              }
            }
          } else if (type === 'gender') {
            showGender = true;
          } else if (type === 'weight') {
            showWeightFromCriteria = true;
          }
        }
      }
    }

    // Sort belt options from weakest to strongest using normalizeRank
    beltRankOptions.sort((a, b) => {
      const ai = RANK_ORDER.indexOf(normalizeRank(a));
      const bi = RANK_ORDER.indexOf(normalizeRank(b));
      const as = ai === -1 ? 999 : ai;
      const bs = bi === -1 ? 999 : bi;
      return as - bs;
    });

    return res.json({
      showExperienceLevel,
      experienceLevelOptions,
      showBeltRank,
      beltRankOptions,
      showGender,
      showWeight: showWeightFromCriteria || !!tournament.require_weight_at_registration,
      weightUnit: tournament.weight_unit || 'kg',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Extract display option strings from a criteria object.
 * Handles both new format ({ ranges: [{value, label, min, max}] })
 * and legacy format ({ options: ['string', ...] }).
 */
function _extractOptions(criteria) {
  const result = [];

  if (Array.isArray(criteria.ranges)) {
    for (const range of criteria.ranges) {
      if (!range || typeof range !== 'object') continue;
      // Prefer value, fall back to label
      const opt = range.value != null ? String(range.value) : (range.label != null ? String(range.label) : null);
      if (opt) result.push(opt);
    }
  } else if (Array.isArray(criteria.options)) {
    // Legacy format: plain string array
    for (const opt of criteria.options) {
      if (opt != null) result.push(String(opt));
    }
  }

  return result;
}

module.exports = { getRegistrationFields };
