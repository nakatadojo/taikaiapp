const pool = require('../pool');

// ── Tournaments ──────────────────────────────────────────────────────────────

/**
 * Get all tournaments (public).
 */
async function getAll() {
  const result = await pool.query(
    `SELECT * FROM tournaments ORDER BY date DESC NULLS LAST, created_at DESC`
  );
  return result.rows;
}

/**
 * Get a single tournament by ID with its events.
 */
async function findByIdWithEvents(tournamentId) {
  const tResult = await pool.query(
    'SELECT * FROM tournaments WHERE id = $1',
    [tournamentId]
  );
  const tournament = tResult.rows[0];
  if (!tournament) return null;

  const eResult = await pool.query(
    'SELECT * FROM tournament_events WHERE tournament_id = $1 ORDER BY name ASC',
    [tournamentId]
  );
  tournament.events = eResult.rows;
  return tournament;
}

/**
 * Find tournament by ID (no events).
 */
async function findById(tournamentId) {
  const result = await pool.query(
    'SELECT * FROM tournaments WHERE id = $1',
    [tournamentId]
  );
  return result.rows[0] || null;
}

/**
 * Create a tournament.
 */
async function create({ name, date, location, registrationOpen, baseEventPrice, addonEventPrice, createdBy }) {
  const result = await pool.query(
    `INSERT INTO tournaments (name, date, location, registration_open, base_event_price, addon_event_price, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [name, date || null, location || null, registrationOpen || false,
     baseEventPrice || 75, addonEventPrice || 25, createdBy || null]
  );
  return result.rows[0];
}

/**
 * Update a tournament.
 */
async function update(tournamentId, updates) {
  const allowedFields = [
    'name', 'date', 'location', 'registration_open',
    'base_event_price', 'addon_event_price',
  ];
  const fields = [];
  const values = [];
  let idx = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      fields.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }
  }

  if (fields.length === 0) return findById(tournamentId);

  fields.push('updated_at = NOW()');
  values.push(tournamentId);

  const result = await pool.query(
    `UPDATE tournaments SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

// ── Tournament Events ────────────────────────────────────────────────────────

/**
 * Get all events for a tournament.
 */
async function getEventsForTournament(tournamentId) {
  const result = await pool.query(
    'SELECT * FROM tournament_events WHERE tournament_id = $1 ORDER BY name ASC',
    [tournamentId]
  );
  return result.rows;
}

/**
 * Create an event for a tournament.
 */
async function createEvent({
  tournamentId, name, eventType, division, gender,
  ageMin, ageMax, rankMin, rankMax,
  priceOverride, addonPriceOverride, maxCompetitors,
}) {
  const result = await pool.query(
    `INSERT INTO tournament_events
      (tournament_id, name, event_type, division, gender,
       age_min, age_max, rank_min, rank_max,
       price_override, addon_price_override, max_competitors)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      tournamentId, name, eventType || null, division || null, gender || null,
      ageMin || null, ageMax || null, rankMin || null, rankMax || null,
      priceOverride || null, addonPriceOverride || null, maxCompetitors || null,
    ]
  );
  return result.rows[0];
}

/**
 * Update an event.
 */
async function updateEvent(eventId, updates) {
  const allowedFields = [
    'name', 'event_type', 'division', 'gender',
    'age_min', 'age_max', 'rank_min', 'rank_max',
    'price_override', 'addon_price_override', 'max_competitors',
  ];
  const fields = [];
  const values = [];
  let idx = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      fields.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }
  }

  if (fields.length === 0) return null;

  fields.push('updated_at = NOW()');
  values.push(eventId);

  const result = await pool.query(
    `UPDATE tournament_events SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

/**
 * Delete an event.
 */
async function deleteEvent(eventId) {
  const result = await pool.query(
    'DELETE FROM tournament_events WHERE id = $1 RETURNING id',
    [eventId]
  );
  return result.rows[0] || null;
}

/**
 * Bulk sync events for a tournament (upsert).
 * Accepts array of events with optional `id` field.
 * Events with matching id are updated, new ones are inserted.
 */
async function syncEvents(tournamentId, events) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get existing event IDs for this tournament
    const existing = await client.query(
      'SELECT id FROM tournament_events WHERE tournament_id = $1',
      [tournamentId]
    );
    const existingIds = new Set(existing.rows.map(r => r.id));
    const incomingIds = new Set();

    const results = [];

    for (const evt of events) {
      if (evt.id && existingIds.has(evt.id)) {
        // Update existing
        incomingIds.add(evt.id);
        const updated = await client.query(
          `UPDATE tournament_events SET
            name = $1, event_type = $2, division = $3, gender = $4,
            age_min = $5, age_max = $6, rank_min = $7, rank_max = $8,
            price_override = $9, addon_price_override = $10, max_competitors = $11,
            updated_at = NOW()
           WHERE id = $12 AND tournament_id = $13
           RETURNING *`,
          [
            evt.name, evt.eventType || null, evt.division || null, evt.gender || null,
            evt.ageMin || null, evt.ageMax || null, evt.rankMin || null, evt.rankMax || null,
            evt.priceOverride || null, evt.addonPriceOverride || null, evt.maxCompetitors || null,
            evt.id, tournamentId,
          ]
        );
        if (updated.rows[0]) results.push(updated.rows[0]);
      } else {
        // Insert new
        const inserted = await client.query(
          `INSERT INTO tournament_events
            (tournament_id, name, event_type, division, gender,
             age_min, age_max, rank_min, rank_max,
             price_override, addon_price_override, max_competitors)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING *`,
          [
            tournamentId, evt.name, evt.eventType || null, evt.division || null, evt.gender || null,
            evt.ageMin || null, evt.ageMax || null, evt.rankMin || null, evt.rankMax || null,
            evt.priceOverride || null, evt.addonPriceOverride || null, evt.maxCompetitors || null,
          ]
        );
        if (inserted.rows[0]) results.push(inserted.rows[0]);
      }
    }

    // Delete events that exist in DB but weren't in the incoming set
    for (const existingId of existingIds) {
      if (!incomingIds.has(existingId)) {
        await client.query(
          'DELETE FROM tournament_events WHERE id = $1',
          [existingId]
        );
      }
    }

    await client.query('COMMIT');
    return results;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get eligible events for a profile, filtered by age/gender/rank/experience.
 * Returns events with pricing info.
 */
async function getEligibleEvents(tournamentId, profile) {
  // Get all events for the tournament
  const events = await getEventsForTournament(tournamentId);
  const tournament = await findById(tournamentId);

  if (!tournament || events.length === 0) return { events: [], tournament };

  // Calculate age at tournament date
  const tournamentDate = tournament.date ? new Date(tournament.date) : new Date();
  const dob = new Date(profile.date_of_birth);
  let age = tournamentDate.getFullYear() - dob.getFullYear();
  const monthDiff = tournamentDate.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && tournamentDate.getDate() < dob.getDate())) {
    age--;
  }

  // Belt rank ordering for filtering
  const rankOrder = [
    'white', 'yellow', 'orange', 'green', 'blue', 'purple', 'brown',
    'black', '1st dan', '2nd dan', '3rd dan', '4th dan', '5th dan',
    '6th dan', '7th dan', '8th dan', '9th dan', '10th dan',
  ];
  const profileRankIndex = profile.belt_rank
    ? rankOrder.indexOf(profile.belt_rank.toLowerCase())
    : -1;

  // Filter events
  const eligible = events.filter(event => {
    // Age filter
    if (event.age_min !== null && age < event.age_min) return false;
    if (event.age_max !== null && age > event.age_max) return false;

    // Gender filter
    if (event.gender && event.gender !== 'mixed' && event.gender !== profile.gender) return false;

    // Rank filter (if event has rank constraints and profile has a rank)
    if (event.rank_min || event.rank_max) {
      if (profileRankIndex === -1) return false; // No rank set, skip rank-filtered events
      const minIndex = event.rank_min ? rankOrder.indexOf(event.rank_min.toLowerCase()) : 0;
      const maxIndex = event.rank_max ? rankOrder.indexOf(event.rank_max.toLowerCase()) : rankOrder.length - 1;
      if (profileRankIndex < minIndex || profileRankIndex > maxIndex) return false;
    }

    // Experience level filter — only if event specifies it via division or similar
    // For now, experience level filtering is handled client-side based on event naming conventions

    return true;
  });

  // Add pricing info
  const basePrice = parseFloat(tournament.base_event_price) || 75;
  const addonPrice = parseFloat(tournament.addon_event_price) || 25;

  const enriched = eligible.map(event => ({
    ...event,
    basePrice: event.price_override !== null ? parseFloat(event.price_override) : basePrice,
    addonPrice: event.addon_price_override !== null ? parseFloat(event.addon_price_override) : addonPrice,
  }));

  return { events: enriched, tournament, age };
}

/**
 * Check how many competitors are registered for an event.
 */
async function getEventRegistrationCount(eventId) {
  const result = await pool.query(
    `SELECT COUNT(*) AS count FROM registration_events re
     JOIN registrations r ON r.id = re.registration_id
     WHERE re.event_id = $1 AND r.status != 'cancelled'`,
    [eventId]
  );
  return parseInt(result.rows[0].count);
}

module.exports = {
  getAll,
  findById,
  findByIdWithEvents,
  create,
  update,
  getEventsForTournament,
  createEvent,
  updateEvent,
  deleteEvent,
  syncEvents,
  getEligibleEvents,
  getEventRegistrationCount,
};
