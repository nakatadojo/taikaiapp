/**
 * server/services/divisionAutoAssign.js
 *
 * Server-side division auto-assignment service.
 * Reads all competitors and event templates for a tournament,
 * assigns each competitor to the appropriate division, and saves to DB.
 * Directors load fresh division state on demand — no WS broadcast needed.
 */

const pool = require('../db/pool');
const DirectorCompetitorQueries = require('../db/queries/directorCompetitors');
const DivisionQueries = require('../db/queries/divisions');
const { assignDivision } = require('./divisionAssignment');

/**
 * Run auto-assign for a tournament.
 * Loads all competitors and event templates, assigns competitors to divisions,
 * saves to DB, and broadcasts via WebSocket.
 *
 * @param {string} tournamentId
 * @returns {Promise<Object>} updatedDivisions
 */
async function runAutoAssign(tournamentId) {
  const t = await pool.query('SELECT date, weight_unit FROM tournaments WHERE id = $1', [tournamentId]);
  if (!t.rows[0]) throw new Error('Tournament not found');
  const tournamentDate = t.rows[0].date;
  const tournamentWeightUnit = t.rows[0].weight_unit || 'kg';

  // Load ALL competitors — approved and unapproved both appear in divisions.
  // Approval status controls bracket inclusion, not division visibility.
  const allCompetitors = await DirectorCompetitorQueries.getAll(tournamentId);
  const competitors = allCompetitors;
  const eventsResult = await pool.query(
    `SELECT id, name, event_type, criteria_templates FROM tournament_events WHERE tournament_id = $1`,
    [tournamentId]
  );
  const events = eventsResult.rows;

  // Load current divisions state
  const currentDivisions = await DivisionQueries.get(tournamentId);
  const updatedDivisions = { ...currentDivisions };

  for (const event of events) {
    const templates = event.criteria_templates;
    if (!templates || !Array.isArray(templates) || templates.length === 0) continue;

    // Build division groups for this event
    const divisionGroups = {}; // divisionName -> array of competitors
    const unassignedGroup = []; // competitors registered but not matching any template

    for (const competitor of competitors) {
      // Check if competitor is registered for this event.
      // Supports two formats:
      //   1. UUID string — legacy / registration-form competitors
      //   2. Object with `discipline` — Smoothcomp-imported competitors
      const compEvents = competitor.events || [];
      const eventTypeNorm = event.event_type.toLowerCase().replace(/-/g, '');

      function matchesEvent(e) {
        if (!e) return false;
        if (typeof e === 'string') return String(e) === String(event.id);
        const disc = (e.discipline || '').toLowerCase().replace(/\s+/g, '');
        if (disc === eventTypeNorm) return true;
        if (disc === 'kobudo' && eventTypeNorm === 'weapons') return true;
        if (disc === 'teamkata' && eventTypeNorm === 'teamkata') return true;
        return false;
      }

      if (!compEvents.some(matchesEvent)) continue;

      // For object-format events, use the experience from the specific event entry
      const matchedEvent = compEvents.find(e => typeof e === 'object' && matchesEvent(e));

      const profile = {
        date_of_birth: competitor.dateOfBirth || competitor.date_of_birth || competitor.dob,
        gender: competitor.gender,
        belt_rank: competitor.rank || competitor.belt_rank,
        weight: competitor.weight,
        // Prefer per-event experience (object format) over top-level field
        experience_level: (matchedEvent && matchedEvent.experience)
          || competitor.experience
          || competitor.experience_level,
      };

      const record = {
        id: competitor.id,
        firstName: competitor.firstName,
        lastName: competitor.lastName,
        rank: competitor.rank,
        weight: competitor.weight,
        gender: competitor.gender,
        dateOfBirth: competitor.dateOfBirth || competitor.date_of_birth || competitor.dob || null,
        club: competitor.club || competitor.academy_name || null,
        experience: competitor.experience || competitor.experience_level || null,
        approved: competitor.approved !== false, // true for approved/null, false for explicitly unapproved
      };

      const divisionName = assignDivision(profile, templates, tournamentDate, tournamentWeightUnit);
      if (divisionName) {
        if (!divisionGroups[divisionName]) divisionGroups[divisionName] = [];
        divisionGroups[divisionName].push(record);
      } else {
        unassignedGroup.push(record);
      }
    }

    // Build generated divisions in the format the client expects
    const generated = {};
    // Unassigned bucket always stored first (client pins it to top)
    if (unassignedGroup.length > 0) {
      generated['__unassigned__'] = {
        name: '__unassigned__',
        competitors: unassignedGroup,
        createdAt: new Date().toISOString(),
      };
    }
    for (const [name, comps] of Object.entries(divisionGroups)) {
      generated[name] = {
        name,
        competitors: comps,
        createdAt: new Date().toISOString(),
      };
    }

    // Re-apply manual overrides (director moves/removes) on top of fresh assignments.
    // override can be a string (legacy) or { target, note } object.
    const prevManual = (currentDivisions[String(event.id)] || {}).manual || {};
    for (const [compId, override] of Object.entries(prevManual)) {
      const targetDiv = typeof override === 'string' ? override : override?.target;
      let movedComp = null;
      for (const divKey of Object.keys(generated)) {
        const divData = generated[divKey];
        const comps = Array.isArray(divData) ? divData : (divData?.competitors || []);
        const idx = comps.findIndex(c => String(c.id) === String(compId));
        if (idx !== -1) {
          movedComp = comps.splice(idx, 1)[0];
          if (comps.length === 0 && divKey !== '__unassigned__') delete generated[divKey];
          break;
        }
      }
      if (!targetDiv || !movedComp || targetDiv === '__removed__') continue;
      if (!generated[targetDiv]) {
        generated[targetDiv] = { name: targetDiv, competitors: [], createdAt: new Date().toISOString() };
      }
      const targetComps = Array.isArray(generated[targetDiv]) ? generated[targetDiv] : (generated[targetDiv].competitors);
      targetComps.push(movedComp);
    }

    updatedDivisions[String(event.id)] = {
      ...currentDivisions[String(event.id)],
      templates,
      generated,
      ...(Object.keys(prevManual).length > 0 ? { manual: prevManual } : {}),
      updatedAt: new Date().toISOString(),
    };
  }

  // Save to DB — directors load fresh state on demand, no WS broadcast
  await DivisionQueries.upsert(tournamentId, updatedDivisions);

  return updatedDivisions;
}

module.exports = { runAutoAssign };
