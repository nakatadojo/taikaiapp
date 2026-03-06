/**
 * Auto-Division Assignment Service
 *
 * Given a competitor profile and an event's criteria_templates, determines
 * which division the competitor belongs to.
 *
 * Division names mirror the client-side buildDivisions() logic — labels from
 * each criteria range are concatenated with spaces (e.g., "Kids Male Beginner").
 */

const RANK_ORDER = [
  'white', 'yellow', 'orange', 'green', 'blue', 'purple', 'brown',
  'black', '1st dan', '2nd dan', '3rd dan', '4th dan', '5th dan',
  '6th dan', '7th dan', '8th dan', '9th dan', '10th dan',
];

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
  for (const range of criteria.ranges) {
    switch (criteria.type) {
      case 'age':
        if (competitor.age >= range.min && competitor.age <= range.max) {
          return range.label;
        }
        break;

      case 'gender':
        if (competitor.gender === range.value) {
          return range.label;
        }
        break;

      case 'weight': {
        const weight = competitor.weight || 0;
        if (weight >= range.min && weight <= range.max) {
          return range.label;
        }
        break;
      }

      case 'rank': {
        const compRankIdx = competitor.belt_rank
          ? RANK_ORDER.indexOf(competitor.belt_rank.toLowerCase())
          : -1;

        if (range.rankMin !== undefined && range.rankMax !== undefined) {
          const minIdx = RANK_ORDER.indexOf(range.rankMin.toLowerCase());
          const maxIdx = RANK_ORDER.indexOf(range.rankMax.toLowerCase());
          if (compRankIdx >= minIdx && compRankIdx <= maxIdx) {
            return range.label;
          }
        } else if (range.value) {
          if (competitor.belt_rank === range.value) {
            return range.label;
          }
        }
        break;
      }

      case 'experience': {
        const compExp = (competitor.experience_level || '').toLowerCase();
        const rangeValue = (range.value || '').toLowerCase();
        if (compExp === rangeValue) {
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
function assignDivision(profile, templates, tournamentDate) {
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
      return labels.join(' ');
    }
  }

  return null;
}

module.exports = { assignDivision, calculateAge };
