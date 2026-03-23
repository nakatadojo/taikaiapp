/**
 * Auto-Division Assignment Service
 *
 * Given a competitor profile and an event's criteria_templates, determines
 * which division the competitor belongs to.
 *
 * Division names mirror the client-side buildDivisions() logic — labels from
 * each criteria range are concatenated with spaces (e.g., "Kids Male Beginner").
 */

// Must match RANK_ORDER in client/app.js exactly (kyu/dan format).
// Criteria templates stored by the wizard use kyu values like '10th kyu', '1st dan'.
const RANK_ORDER = [
  '10th kyu', '9th kyu', '8th kyu', '7th kyu', '6th kyu', '5th kyu',
  '4th kyu', '3rd kyu', '2nd kyu', '1st kyu',
  '1st dan', '2nd dan', '3rd dan', '4th dan', '5th dan',
  '6th dan', '7th dan', '8th dan', '9th dan', '10th dan',
];

const BELT_ORDER = ['white', 'yellow', 'orange', 'green', 'blue', 'purple', 'brown', 'red', 'black'];

/**
 * Normalize a rank/belt string to canonical kyu/dan format.
 * Handles:
 *   - Belt colors from the registration form ("Blue", "Blue Belt") → '6th kyu'
 *   - Dan values from the form ("1st Dan", "2nd Dan") → '1st dan', '2nd dan'
 *   - Already-normalized kyu values ('10th kyu') → pass-through
 */
function normalizeRank(r) {
  const s = (r || '').toLowerCase().replace(/ belt$/i, '').trim();
  const colorToKyu = {
    'white':  '10th kyu',
    'yellow': '9th kyu',
    'orange': '8th kyu',
    'green':  '7th kyu',
    'blue':   '6th kyu',
    'purple': '5th kyu',
    'brown':  '3rd kyu',
    'black':  '1st dan',
  };
  return colorToKyu[s] || s;
}

/**
 * Calculate competitor age on tournament date.
 */
function calculateAge(dateOfBirth, tournamentDate) {
  const dob = new Date(dateOfBirth);
  const td = tournamentDate ? new Date(tournamentDate) : new Date();

  let age = td.getFullYear() - dob.getFullYear();
  const monthDiff = td.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && td.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

/**
 * Match a competitor against a single criteria range.
 * Returns the matching range label, or null if no match.
 */
function matchCriteria(competitor, criteria) {
  // Normalise legacy format: { type:"gender", options:["Male","Female"] }
  // → { type:"gender", ranges:[{ value:"Male", label:"Male" },...] }
  // Old division builder versions saved gender as `options` (string array) instead of `ranges`.
  const ranges = criteria.ranges ||
    (Array.isArray(criteria.options) ? criteria.options.map(o => ({ value: o, label: o })) : []);

  for (const range of ranges) {
    switch (criteria.type) {
      case 'age':
        if (competitor.age >= range.min && competitor.age <= range.max) {
          return range.label;
        }
        break;

      case 'gender':
        if ((competitor.gender || '').toLowerCase() === (range.value || '').toLowerCase()) {
          return range.label;
        }
        break;

      case 'weight': {
        let weight = competitor.weight || 0;
        // Convert competitor weight to the unit used by this criteria's ranges.
        // competitor.weight is stored in tournamentWeightUnit; criteria.weightUnit
        // is the unit the tree ranges were authored in.
        const fromUnit = competitor.tournamentWeightUnit || 'kg';
        // Old templates (saved before weightUnit support) have no weightUnit and
        // implicitly use kg — so default to 'kg', not fromUnit.
        const toUnit   = criteria.weightUnit || 'kg';
        if (fromUnit !== toUnit && weight) {
          weight = fromUnit === 'kg'
            ? weight * 2.20462   // kg → lbs
            : weight * 0.453592; // lbs → kg
        }
        if (weight >= range.min && weight <= range.max) {
          return range.label;
        }
        break;
      }

      case 'rank': {
        // Normalize both the competitor rank and the criteria bounds to kyu/dan format
        // so belt-color profiles ("Blue") match kyu-based templates ("10th kyu"–"1st kyu").
        const compRankNorm = normalizeRank(competitor.belt_rank);
        const compRankIdx = RANK_ORDER.indexOf(compRankNorm);

        if (range.rankMin !== undefined && range.rankMax !== undefined) {
          const minIdx = RANK_ORDER.indexOf(normalizeRank(range.rankMin));
          const maxIdx = RANK_ORDER.indexOf(normalizeRank(range.rankMax));
          if (compRankIdx !== -1 && minIdx !== -1 && maxIdx !== -1 &&
              compRankIdx >= minIdx && compRankIdx <= maxIdx) {
            return range.label;
          }
        } else if (range.value) {
          if (compRankNorm === normalizeRank(range.value)) {
            return range.label;
          }
        }
        break;
      }

      case 'belt': {
        const normBelt = r => (r || '').toLowerCase().replace(/ belt$/i, '').trim();
        const compBeltIdx = BELT_ORDER.indexOf(normBelt(competitor.belt_rank));
        if (compBeltIdx === -1) break;
        const minIdx = BELT_ORDER.indexOf(normBelt(range.beltMin || ''));
        const maxIdx = BELT_ORDER.indexOf(normBelt(range.beltMax || ''));
        if (minIdx !== -1 && maxIdx !== -1 && compBeltIdx >= minIdx && compBeltIdx <= maxIdx) {
          return range.label;
        }
        break;
      }

      case 'experience': {
        if (!competitor.experience_level) break;
        const compExp = String(competitor.experience_level).toLowerCase();
        // Label-based match (director configured "Beginner", "Novice", etc.)
        if (range.label && compExp === range.label.toLowerCase()) {
          return range.label;
        }
        // Numeric fallback (legacy: experience stored as years)
        const expNum = parseFloat(competitor.experience_level);
        if (!isNaN(expNum) && range.min != null && range.max != null &&
            expNum >= range.min && expNum <= range.max) {
          return range.label;
        }
        break;
      }
    }
  }
  return null;
}

/**
 * Determine the division name for a competitor given event criteria templates.
 *
 * @param {Object} profile — competitor_profiles row (has age, gender, belt_rank, weight, experience_level)
 * @param {Array} templates — criteria_templates from tournament_events
 * @param {Date|string} tournamentDate — tournament date for age calculation
 * @returns {string|null} — Division name (e.g., "Kids Male Beginner") or null if no match
 */
function assignDivision(profile, templates, tournamentDate, tournamentWeightUnit = 'kg') {
  if (!templates || !Array.isArray(templates) || templates.length === 0) {
    return null;
  }

  // Calculate age
  const age = profile.date_of_birth
    ? calculateAge(profile.date_of_birth, tournamentDate)
    : (profile.age || 0);

  const competitor = {
    age,
    gender: profile.gender,
    belt_rank: profile.belt_rank,
    weight: profile.weight ? parseFloat(profile.weight) : 0,
    experience_level: profile.experience_level,
    tournamentWeightUnit,
  };

  // Try each template (AAU has multiple templates for different age tiers)
  for (const template of templates) {
    if (!template.criteria || !Array.isArray(template.criteria)) continue;

    const labels = [];
    let allMatched = true;

    for (const criteria of template.criteria) {
      const label = matchCriteria(competitor, criteria);
      if (label) {
        labels.push(label);
      } else {
        allMatched = false;
        break;
      }
    }

    if (allMatched && labels.length > 0) {
      return template.name;
    }
  }

  return null;
}

module.exports = { assignDivision, calculateAge };
