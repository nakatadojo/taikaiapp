/**
 * server/services/divisionAutoAssign.js
 *
 * Server-side division auto-assignment service.
 * Reads all competitors and event templates for a tournament,
 * assigns each competitor to the appropriate division, and saves to DB.
 * Also broadcasts the result via WebSocket.
 */

const pool = require('../db/pool');
const DirectorCompetitorQueries = require('../db/queries/directorCompetitors');
const DivisionQueries = require('../db/queries/divisions');
const { assignDivision } = require('./divisionAssignment');
const { broadcastDivisionUpdate } = require('../websocket');

/**
 * Run auto-assign for a tournament.
 * Loads all competitors and event templates, assigns competitors to divisions,
 * saves to DB, and broadcasts via WebSocket.
 *
 * @param {string} tournamentId
 * @returns {Promise<Object>} updatedDivisions
 */
async function runAutoAssign(tournamentId) {
  const t = await pool.query('SELECT date FROM tournaments WHERE id = $1', [tournamentId]);
  if (!t.rows[0]) throw new Error('Tournament not found');
  const tournamentDate = t.rows[0].date;

  // Load all competitors and all event templates.
  // Only approved competitors flow into divisions — unapproved ones are
  // registered but not yet competing. Stripe registrations are always approved.
  const allCompetitors = await DirectorCompetitorQueries.getAll(tournamentId);
  const competitors = allCompetitors.filter(c => c.approved !== false);
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

    for (const competitor of competitors) {
      const profile = {
        date_of_birth: competitor.dateOfBirth || competitor.date_of_birth || competitor.dob,
        gender: competitor.gender,
        belt_rank: competitor.rank || competitor.belt_rank,
        weight: competitor.weight,
        experience_level: competitor.experience || competitor.experience_level,
      };

      // Check if competitor is registered for this event
      const compEvents = competitor.events || [];
      const isRegisteredForEvent = compEvents.some(eid => String(eid) === String(event.id));
      if (!isRegisteredForEvent) continue;

      const divisionName = assignDivision(profile, templates, tournamentDate);
      if (divisionName) {
        if (!divisionGroups[divisionName]) divisionGroups[divisionName] = [];
        divisionGroups[divisionName].push({
          id: competitor.id,
          firstName: competitor.firstName,
          lastName: competitor.lastName,
          rank: competitor.rank,
          weight: competitor.weight,
          gender: competitor.gender,
          dateOfBirth: competitor.dateOfBirth || competitor.date_of_birth || competitor.dob || null,
          club: competitor.club || competitor.academy_name || null,
          experience: competitor.experience || competitor.experience_level || null,
        });
      }
    }

    // Build generated divisions in the format the client expects
    const generated = {};
    for (const [name, comps] of Object.entries(divisionGroups)) {
      generated[name] = {
        name,
        competitors: comps,
        createdAt: new Date().toISOString(),
      };
    }

    updatedDivisions[String(event.id)] = {
      ...currentDivisions[String(event.id)],
      templates,
      generated,
      updatedAt: new Date().toISOString(),
    };
  }

  // Save to DB
  await DivisionQueries.upsert(tournamentId, updatedDivisions);

  // Broadcast to all connected devices (fire and forget)
  try {
    broadcastDivisionUpdate(tournamentId, updatedDivisions);
  } catch (e) {
    console.warn('[ws] broadcastDivisionUpdate failed:', e.message);
  }

  return updatedDivisions;
}

module.exports = { runAutoAssign };
