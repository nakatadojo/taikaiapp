const pool = require('../pool');

// ── Slug Helpers ────────────────────────────────────────────────────────────

/**
 * Generate a URL-safe slug from a string.
 */
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

/**
 * Generate a unique slug, appending -2, -3, etc. if needed.
 */
async function generateUniqueSlug(name, excludeId = null) {
  let base = generateSlug(name);
  if (!base) base = 'tournament';
  let slug = base;
  let counter = 1;

  while (true) {
    const params = excludeId ? [slug, excludeId] : [slug];
    const where = excludeId
      ? 'WHERE slug = $1 AND id != $2'
      : 'WHERE slug = $1';
    const result = await pool.query(
      `SELECT id FROM tournaments ${where}`,
      params
    );
    if (result.rows.length === 0) return slug;
    counter++;
    slug = `${base}-${counter}`;
  }
}

// ── Tournaments ──────────────────────────────────────────────────────────────

/**
 * Get all tournaments (public — for legacy compatibility).
 */
async function getAll() {
  const result = await pool.query(
    `SELECT * FROM tournaments ORDER BY date DESC NULLS LAST, created_at DESC`
  );
  return result.rows;
}

/**
 * Get published tournaments for public directory.
 * Includes registered competitor count.
 */
async function getDirectory({ search, sort, includePast } = {}) {
  let where = 'WHERE t.published = true';
  const params = [];
  let idx = 1;

  if (!includePast) {
    where += ` AND (t.date >= CURRENT_DATE OR t.date IS NULL)`;
  }

  if (search) {
    where += ` AND (t.name ILIKE $${idx} OR t.city ILIKE $${idx} OR t.location ILIKE $${idx})`;
    params.push(`%${search}%`);
    idx++;
  }

  let orderBy = 'ORDER BY t.date ASC NULLS LAST, t.created_at DESC';
  if (sort === 'name') {
    orderBy = 'ORDER BY t.name ASC';
  } else if (sort === 'date-desc') {
    orderBy = 'ORDER BY t.date DESC NULLS LAST';
  }

  const result = await pool.query(
    `SELECT t.*,
            u.first_name AS director_first_name,
            u.last_name AS director_last_name,
            COALESCE(reg.competitor_count, 0)::int AS competitor_count
     FROM tournaments t
     LEFT JOIN users u ON u.id = t.created_by
     LEFT JOIN (
       SELECT tournament_id, COUNT(DISTINCT profile_id) AS competitor_count
       FROM registrations
       WHERE status != 'cancelled'
       GROUP BY tournament_id
     ) reg ON reg.tournament_id = t.id
     ${where}
     ${orderBy}`,
    params
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
 * Find tournament by slug (with events + director info, for public page).
 */
async function findBySlug(slug) {
  const tResult = await pool.query(
    `SELECT t.*,
            u.first_name AS director_first_name,
            u.last_name AS director_last_name,
            u.organization_name AS director_organization
     FROM tournaments t
     LEFT JOIN users u ON u.id = t.created_by
     WHERE t.slug = $1`,
    [slug]
  );
  const tournament = tResult.rows[0];
  if (!tournament) return null;

  const eResult = await pool.query(
    'SELECT * FROM tournament_events WHERE tournament_id = $1 ORDER BY name ASC',
    [tournament.id]
  );
  tournament.events = eResult.rows;

  // Get competitor count
  const regResult = await pool.query(
    `SELECT COUNT(DISTINCT profile_id)::int AS competitor_count
     FROM registrations WHERE tournament_id = $1 AND status != 'cancelled'`,
    [tournament.id]
  );
  tournament.competitor_count = regResult.rows[0]?.competitor_count || 0;

  return tournament;
}

/**
 * Get all tournaments owned by a specific user (Event Director dashboard).
 */
async function getByDirector(userId) {
  const result = await pool.query(
    `SELECT t.*,
            COALESCE(reg.competitor_count, 0)::int AS competitor_count
     FROM tournaments t
     LEFT JOIN (
       SELECT tournament_id, COUNT(DISTINCT profile_id) AS competitor_count
       FROM registrations
       WHERE status != 'cancelled'
       GROUP BY tournament_id
     ) reg ON reg.tournament_id = t.id
     WHERE t.created_by = $1
     ORDER BY t.date DESC NULLS LAST, t.created_at DESC`,
    [userId]
  );
  return result.rows;
}

/**
 * Create a tournament with slug auto-generation.
 */
async function create({
  name, date, location, registrationOpen, baseEventPrice, addonEventPrice, createdBy,
  slug, description, city, state, venueName, venueAddress,
  published, organizationName, contactEmail, registrationDeadline, coverImageUrl,
  sanctioningBody, collectTshirtSizes, timezone,
}) {
  const finalSlug = slug || await generateUniqueSlug(name);

  const result = await pool.query(
    `INSERT INTO tournaments
      (name, date, location, registration_open, base_event_price, addon_event_price, created_by,
       slug, description, city, state, venue_name, venue_address,
       published, organization_name, contact_email, registration_deadline, cover_image_url,
       sanctioning_body, collect_tshirt_sizes, timezone)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
     RETURNING *`,
    [
      name,
      date || null,
      location || null,
      registrationOpen || false,
      baseEventPrice || 75,
      addonEventPrice || 25,
      createdBy || null,
      finalSlug,
      description || null,
      city || null,
      state || null,
      venueName || null,
      venueAddress || null,
      published || false,
      organizationName || null,
      contactEmail || null,
      registrationDeadline || null,
      coverImageUrl || null,
      sanctioningBody || null,
      collectTshirtSizes || false,
      timezone || 'America/New_York',
    ]
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
    'slug', 'description', 'city', 'state', 'venue_name', 'venue_address',
    'published', 'organization_name', 'contact_email', 'registration_deadline',
    'cover_image_url', 'sanctioning_body', 'collect_tshirt_sizes',
    'registration_settings', 'timezone', 'currency', 'weight_unit',
    'public_site_config',
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

/**
 * Check tournament ownership (for multi-tenancy).
 */
async function isOwnedBy(tournamentId, userId) {
  const result = await pool.query(
    'SELECT id FROM tournaments WHERE id = $1 AND created_by = $2',
    [tournamentId, userId]
  );
  return result.rows.length > 0;
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
  isDefault, teamSize, description, prerequisiteEventId,
  isEventType,
}) {
  const result = await pool.query(
    `INSERT INTO tournament_events
      (tournament_id, name, event_type, division, gender,
       age_min, age_max, rank_min, rank_max,
       price_override, addon_price_override, max_competitors,
       is_default, team_size, description, prerequisite_event_id,
       is_event_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     RETURNING *`,
    [
      tournamentId, name, eventType || null, division || null, gender || null,
      ageMin || null, ageMax || null, rankMin || null, rankMax || null,
      priceOverride || null, addonPriceOverride || null, maxCompetitors || null,
      isDefault || false, teamSize || null, description || null,
      prerequisiteEventId || null,
      isEventType || false,
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
    'is_default', 'team_size', 'description', 'prerequisite_event_id',
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
 * Delete a tournament and all associated data (cascading).
 */
async function deleteTournament(tournamentId) {
  const result = await pool.query(
    'DELETE FROM tournaments WHERE id = $1 RETURNING id',
    [tournamentId]
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
 */
async function syncEvents(tournamentId, events) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT id FROM tournament_events WHERE tournament_id = $1',
      [tournamentId]
    );
    const existingIds = new Set(existing.rows.map(r => r.id));
    const incomingIds = new Set();
    const results = [];

    for (const evt of events) {
      const criteriaJson = evt.criteriaTemplates ? JSON.stringify(evt.criteriaTemplates) : null;
      const isEventType = evt.isEventType || false;
      const matchDuration = evt.matchDurationSeconds || null;
      const teamSize = evt.teamSize != null ? parseInt(evt.teamSize, 10) : null;
      const isDefault = evt.isDefault || false;
      const description = evt.description || null;

      if (evt.id && existingIds.has(evt.id)) {
        incomingIds.add(evt.id);
        const updated = await client.query(
          `UPDATE tournament_events SET
            name = $1, event_type = $2, division = $3, gender = $4,
            age_min = $5, age_max = $6, rank_min = $7, rank_max = $8,
            price_override = $9, addon_price_override = $10, max_competitors = $11,
            criteria_templates = $12, is_event_type = $13, match_duration_seconds = $14,
            team_size = $15, is_default = $16, description = $17,
            updated_at = NOW()
           WHERE id = $18 AND tournament_id = $19
           RETURNING *`,
          [
            evt.name, evt.eventType || null, evt.division || null, evt.gender || null,
            evt.ageMin || null, evt.ageMax || null, evt.rankMin || null, evt.rankMax || null,
            evt.priceOverride || null, evt.addonPriceOverride || null, evt.maxCompetitors || null,
            criteriaJson, isEventType, matchDuration,
            teamSize, isDefault, description,
            evt.id, tournamentId,
          ]
        );
        if (updated.rows[0]) results.push(updated.rows[0]);
      } else {
        const inserted = await client.query(
          `INSERT INTO tournament_events
            (tournament_id, name, event_type, division, gender,
             age_min, age_max, rank_min, rank_max,
             price_override, addon_price_override, max_competitors,
             criteria_templates, is_event_type, match_duration_seconds,
             team_size, is_default, description)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
           RETURNING *`,
          [
            tournamentId, evt.name, evt.eventType || null, evt.division || null, evt.gender || null,
            evt.ageMin || null, evt.ageMax || null, evt.rankMin || null, evt.rankMax || null,
            evt.priceOverride || null, evt.addonPriceOverride || null, evt.maxCompetitors || null,
            criteriaJson, isEventType, matchDuration,
            teamSize, isDefault, description,
          ]
        );
        if (inserted.rows[0]) results.push(inserted.rows[0]);
      }
    }

    for (const existingId of existingIds) {
      if (!incomingIds.has(existingId)) {
        await client.query('DELETE FROM tournament_events WHERE id = $1', [existingId]);
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
 */
async function getEligibleEvents(tournamentId, profile) {
  const events = await getEventsForTournament(tournamentId);
  const tournament = await findById(tournamentId);

  if (!tournament || events.length === 0) return { events: [], tournament };

  // Guard: DATE columns now return "YYYY-MM-DD" strings — parse at noon to avoid timezone shift
  const safeParse = (d) => !d ? new Date() : new Date(typeof d === 'string' && d.length === 10 ? d + 'T12:00:00' : d);
  const tournamentDate = safeParse(tournament.date);
  const dob = safeParse(profile.date_of_birth);
  let age = tournamentDate.getFullYear() - dob.getFullYear();
  const monthDiff = tournamentDate.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && tournamentDate.getDate() < dob.getDate())) {
    age--;
  }

  const rankOrder = [
    'white', 'yellow', 'orange', 'green', 'blue', 'purple', 'brown',
    'black', '1st dan', '2nd dan', '3rd dan', '4th dan', '5th dan',
    '6th dan', '7th dan', '8th dan', '9th dan', '10th dan',
  ];
  const profileRankIndex = profile.belt_rank
    ? rankOrder.indexOf(profile.belt_rank.toLowerCase())
    : -1;

  // Check if this tournament uses event-type mode (new criteria-based system)
  const hasEventTypes = events.some(e => e.is_event_type === true);

  const eligible = hasEventTypes
    ? events.filter(e => e.is_event_type === true)
    : events.filter(event => {
        if (event.age_min !== null && age < event.age_min) return false;
        if (event.age_max !== null && age > event.age_max) return false;
        if (event.gender && event.gender !== 'mixed' && event.gender !== profile.gender) return false;
        if (event.rank_min || event.rank_max) {
          if (profileRankIndex === -1) return false;
          const minIndex = event.rank_min ? rankOrder.indexOf(event.rank_min.toLowerCase()) : 0;
          const maxIndex = event.rank_max ? rankOrder.indexOf(event.rank_max.toLowerCase()) : rankOrder.length - 1;
          if (profileRankIndex < minIndex || profileRankIndex > maxIndex) return false;
        }
        return true;
      });

  const _p = (v, fb) => (v != null && v !== '') ? parseFloat(v) : fb;
  const basePrice = _p(tournament.base_event_price, 75);
  const addonPrice = _p(tournament.addon_event_price, 25);

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

/**
 * Clone a tournament with its events, pricing periods, and staff role definitions.
 * Does NOT copy registrations, results, brackets, check-in data, or tournament_members.
 */
async function cloneTournament(tournamentId, createdBy) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch the source tournament
    const srcResult = await client.query(
      'SELECT * FROM tournaments WHERE id = $1',
      [tournamentId]
    );
    const src = srcResult.rows[0];
    if (!src) {
      throw new Error('Tournament not found');
    }

    // 2. Generate a unique slug for the clone
    const cloneName = `${src.name} (Copy)`;
    const baseSlug = generateSlug(src.slug + '-copy-' + Date.now());
    let cloneSlug = baseSlug;
    let counter = 1;
    while (true) {
      const existing = await client.query(
        'SELECT id FROM tournaments WHERE slug = $1',
        [cloneSlug]
      );
      if (existing.rows.length === 0) break;
      counter++;
      cloneSlug = `${baseSlug}-${counter}`;
    }

    // 3. Insert the cloned tournament
    const cloneResult = await client.query(
      `INSERT INTO tournaments
        (name, date, location, registration_open, base_event_price, addon_event_price,
         created_by, slug, description, city, state, venue_name, venue_address,
         published, organization_name, contact_email, registration_deadline, cover_image_url,
         sanctioning_body, collect_tshirt_sizes, registration_settings)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
               $14, $15, $16, $17, $18, $19, $20, $21)
       RETURNING *`,
      [
        cloneName,
        src.date,
        src.location,
        false, // registration closed on clone
        src.base_event_price,
        src.addon_event_price,
        createdBy,
        cloneSlug,
        src.description,
        src.city,
        src.state,
        src.venue_name,
        src.venue_address,
        false, // always unpublished
        src.organization_name,
        src.contact_email,
        src.registration_deadline,
        src.cover_image_url,
        src.sanctioning_body,
        src.collect_tshirt_sizes,
        src.registration_settings,
      ]
    );
    const cloned = cloneResult.rows[0];

    // 4. Clone tournament events
    const eventsResult = await client.query(
      'SELECT * FROM tournament_events WHERE tournament_id = $1',
      [tournamentId]
    );
    for (const evt of eventsResult.rows) {
      await client.query(
        `INSERT INTO tournament_events
          (tournament_id, name, event_type, division, gender,
           age_min, age_max, rank_min, rank_max,
           price_override, addon_price_override, max_competitors,
           criteria_templates, is_event_type, match_duration_seconds)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          cloned.id, evt.name, evt.event_type, evt.division, evt.gender,
          evt.age_min, evt.age_max, evt.rank_min, evt.rank_max,
          evt.price_override, evt.addon_price_override, evt.max_competitors,
          evt.criteria_templates, evt.is_event_type, evt.match_duration_seconds,
        ]
      );
    }

    // 5. Clone pricing periods
    const pricingResult = await client.query(
      'SELECT * FROM pricing_periods WHERE tournament_id = $1 ORDER BY display_order',
      [tournamentId]
    );
    for (const pp of pricingResult.rows) {
      await client.query(
        `INSERT INTO pricing_periods
          (tournament_id, name, start_date, end_date, base_event_price, addon_event_price, display_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [cloned.id, pp.name, pp.start_date, pp.end_date, pp.base_event_price, pp.addon_event_price, pp.display_order]
      );
    }

    // 6. Clone staff role definitions
    const rolesResult = await client.query(
      'SELECT * FROM staff_role_definitions WHERE tournament_id = $1',
      [tournamentId]
    );
    for (const role of rolesResult.rows) {
      await client.query(
        `INSERT INTO staff_role_definitions (tournament_id, role_name, permissions)
         VALUES ($1, $2, $3)`,
        [cloned.id, role.role_name, role.permissions]
      );
    }

    await client.query('COMMIT');
    return cloned;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Director Competitors / Clubs (JSONB) ─────────────────────────────────────

/**
 * Get the director_competitors JSONB array for a tournament.
 */
async function getDirectorCompetitors(tournamentId) {
  const { rows } = await pool.query(
    'SELECT director_competitors FROM tournaments WHERE id = $1',
    [tournamentId]
  );
  return rows[0]?.director_competitors || [];
}

/**
 * Replace the director_competitors JSONB array for a tournament.
 */
async function syncDirectorCompetitors(tournamentId, competitors) {
  await pool.query(
    'UPDATE tournaments SET director_competitors = $1::jsonb WHERE id = $2',
    [JSON.stringify(competitors || []), tournamentId]
  );
}

/**
 * Get the director_clubs JSONB array for a tournament.
 */
async function getDirectorClubs(tournamentId) {
  const { rows } = await pool.query(
    'SELECT director_clubs FROM tournaments WHERE id = $1',
    [tournamentId]
  );
  return rows[0]?.director_clubs || [];
}

/**
 * Replace the director_clubs JSONB array for a tournament.
 */
async function syncDirectorClubs(tournamentId, clubs) {
  await pool.query(
    'UPDATE tournaments SET director_clubs = $1::jsonb WHERE id = $2',
    [JSON.stringify(clubs || []), tournamentId]
  );
}

// ── Director Officials / Staff / Instructors (JSONB) ─────────────────────────

async function getDirectorOfficials(tournamentId) {
  const { rows } = await pool.query(
    'SELECT director_officials FROM tournaments WHERE id = $1',
    [tournamentId]
  );
  return rows[0]?.director_officials || [];
}

async function syncDirectorOfficials(tournamentId, officials) {
  await pool.query(
    'UPDATE tournaments SET director_officials = $1::jsonb WHERE id = $2',
    [JSON.stringify(officials || []), tournamentId]
  );
}

async function getDirectorStaff(tournamentId) {
  const { rows } = await pool.query(
    'SELECT director_staff FROM tournaments WHERE id = $1',
    [tournamentId]
  );
  return rows[0]?.director_staff || [];
}

async function syncDirectorStaff(tournamentId, staff) {
  await pool.query(
    'UPDATE tournaments SET director_staff = $1::jsonb WHERE id = $2',
    [JSON.stringify(staff || []), tournamentId]
  );
}

async function getDirectorInstructors(tournamentId) {
  const { rows } = await pool.query(
    'SELECT director_instructors FROM tournaments WHERE id = $1',
    [tournamentId]
  );
  return rows[0]?.director_instructors || [];
}

async function syncDirectorInstructors(tournamentId, instructors) {
  await pool.query(
    'UPDATE tournaments SET director_instructors = $1::jsonb WHERE id = $2',
    [JSON.stringify(instructors || []), tournamentId]
  );
}

module.exports = {
  generateSlug,
  generateUniqueSlug,
  getAll,
  getDirectory,
  findById,
  findByIdWithEvents,
  findBySlug,
  getByDirector,
  create,
  update,
  isOwnedBy,
  getEventsForTournament,
  createEvent,
  updateEvent,
  deleteTournament,
  deleteEvent,
  syncEvents,
  getEligibleEvents,
  getEventRegistrationCount,
  cloneTournament,
  getDirectorCompetitors,
  syncDirectorCompetitors,
  getDirectorClubs,
  syncDirectorClubs,
  getDirectorOfficials,
  syncDirectorOfficials,
  getDirectorStaff,
  syncDirectorStaff,
  getDirectorInstructors,
  syncDirectorInstructors,
};
