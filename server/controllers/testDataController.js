const DirectorCompetitorQueries = require('../db/queries/directorCompetitors');
const { getIO } = require('../websocket');
const tournamentQueries = require('../db/queries/tournaments');
const { runAutoAssign } = require('../services/divisionAutoAssign');
const pool = require('../db/pool');

const DOJOS = [
    'Dragon Dojo', 'Rising Sun Karate', 'Eagle Dojo', 'Tiger Elite',
    'Phoenix Warriors', 'Samurai School', 'Black Belt Academy', 'Spirit Karate',
];

const MALE_NAMES = ['Aiden','Akira','Alejandro','Arjun','Benjamin','Carlos','Daniel','Davi','Elijah','Ethan','Gabriel','Haruto','Hiroshi','Hugo','Ibrahim','Jack','James','Jayden','Jin','Kai','Kaito','Kenji','Leo','Liam','Logan','Lucas','Malik','Mohammed','Nathan','Noah','Oliver','Omar','Owen','Rafael','Ryan','Samuel','Sebastian'];
const FEMALE_NAMES = ['Aisha','Amira','Ana','Chloe','Emma','Fatima','Gabriela','Hannah','Isabel','Isabella','Jade','Jasmine','Layla','Leila','Lily','Luna','Maya','Mia','Mila','Nadia','Olivia','Sakura','Sofia','Sophia','Valentina','Yuki','Zara','Aoi','Hana','Mei'];
const LAST_NAMES = ['Anderson','Brown','Davis','Garcia','Johnson','Jones','Martinez','Miller','Moore','Rodriguez','Tanaka','Suzuki','Watanabe','Yamamoto','Nakamura','Kobayashi','Sato','Ito','Kato','Yoshida','Smith','Wilson','Taylor','Thomas','White','Harris','Martin','Thompson','Clark','Lewis','Kim','Lee','Park','Silva','Santos','Oliveira','Costa','Pereira'];

const RANKS = ['White','Yellow','Orange','Green','Blue','Purple','Brown','1st Dan','2nd Dan'];

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function generateTestData(req, res, next) {
  try {
    const tournamentId = req.params.id;
    const owned = await tournamentQueries.isOwnedBy(tournamentId, req.user.id);
    if (!owned) return res.status(403).json({ error: 'You do not own this tournament' });

    // Client can specify which events to populate and how many competitors
    const requestedEventIds = Array.isArray(req.body?.eventIds) ? req.body.eventIds.map(String) : null;
    const requestedCount = parseInt(req.body?.count) || null;

    const t = await pool.query('SELECT date FROM tournaments WHERE id = $1', [tournamentId]);
    const tournamentDate = t.rows[0]?.date ? new Date(t.rows[0].date) : new Date();

    const eventsResult = await pool.query(
      `SELECT id, event_type, criteria_templates FROM tournament_events WHERE tournament_id = $1`,
      [tournamentId]
    );
    const allEvents = eventsResult.rows;

    if (allEvents.length === 0) {
      return res.status(400).json({ error: 'No events found for this tournament.' });
    }

    // Use only the events the client requested, falling back to all events
    const targetEvents = requestedEventIds && requestedEventIds.length > 0
      ? allEvents.filter(e => requestedEventIds.includes(String(e.id)))
      : allEvents;

    if (targetEvents.length === 0) {
      return res.status(400).json({ error: 'None of the selected events were found.' });
    }

    // Pick 3-4 random dojos
    const shuffled = [...DOJOS].sort(() => Math.random() - 0.5);
    const selectedDojos = shuffled.slice(0, randomInt(3, 4));

    // Use the requested count, clamped to 5-50, defaulting to 20-30
    const count = requestedCount ? Math.min(50, Math.max(5, requestedCount)) : randomInt(20, 30);
    const created = [];

    for (let i = 0; i < count; i++) {
      const gender = Math.random() > 0.45 ? 'male' : 'female';
      const names = gender === 'male' ? MALE_NAMES : FEMALE_NAMES;
      const age = randomInt(8, 45);
      const dob = new Date(tournamentDate);
      dob.setFullYear(dob.getFullYear() - age);
      dob.setMonth(randomInt(0, 11));
      dob.setDate(randomInt(1, 28));

      // Rank biased by age
      let rankPool;
      if (age < 12) rankPool = ['White', 'Yellow', 'Orange'];
      else if (age < 18) rankPool = ['Yellow', 'Orange', 'Green', 'Blue', 'Purple'];
      else rankPool = RANKS;

      const rank = randomItem(rankPool);
      const weight = randomInt(Math.round(25 + age * 1.2), Math.round(40 + age * 1.8));
      const experience = Math.min(age - 5, randomInt(0, 15));

      // Distribute competitors evenly across target events using round-robin,
      // with a small random shuffle to avoid perfectly predictable patterns
      const eventIndex = i % targetEvents.length;
      const assignedEventId = String(targetEvents[eventIndex].id);

      const competitor = {
        firstName: randomItem(names),
        lastName: randomItem(LAST_NAMES),
        dateOfBirth: dob.toISOString().split('T')[0],
        gender,
        rank,
        weight,
        experience,
        club: randomItem(selectedDojos),
        events: [assignedEventId],
        registrationDate: new Date().toISOString(),
        tournamentId,
        paymentStatus: 'waived',
      };

      const c = await DirectorCompetitorQueries.create(tournamentId, competitor, true /* is_test */);
      // Auto-approve test competitors immediately — no credits needed
      const approved = await DirectorCompetitorQueries.approve(c.id, tournamentId);
      const withApproval = { ...c, approved: true };
      created.push(withApproval);
    }

    // Run auto-assign once for all created competitors
    runAutoAssign(tournamentId).catch(e => console.warn('[test-data] auto-assign failed:', e.message));

    res.json({ competitors: created, count: created.length, message: `Generated ${created.length} test competitors` });
  } catch (err) { next(err); }
}

async function clearTestData(req, res, next) {
  try {
    const tournamentId = req.params.id;
    const owned = await tournamentQueries.isOwnedBy(tournamentId, req.user.id);
    if (!owned) return res.status(403).json({ error: 'You do not own this tournament' });

    const count = await DirectorCompetitorQueries.clearTestData(tournamentId);

    // Broadcast a bulk-delete event so all devices refresh
    try {
      getIO().to(`tournament:${tournamentId}:competitors`).emit('competitors:test-cleared', { tournamentId });
    } catch (e) { /* ws not initialized */ }

    res.json({ deleted: count, message: `Cleared ${count} test competitor(s)` });
  } catch (err) { next(err); }
}

module.exports = { generateTestData, clearTestData };
