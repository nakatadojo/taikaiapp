const pool = require('../pool');

/**
 * Create a competitor registration with events.
 */
async function createCompetitorRegistration({
  tournamentId, userId, registeredBy, academyId,
  firstName, lastName, dateOfBirth, weight, rank, experience,
  gender, club, email, phone, photo, clubLogo,
  events, pricing, paymentStatus, source, tshirtSize,
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert registration
    const regResult = await client.query(
      `INSERT INTO registrations
        (tournament_id, user_id, registered_by, academy_id, payment_status, amount_paid, total_due, notes, tshirt_size)
       VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8)
       RETURNING *`,
      [
        tournamentId || null,
        userId || null,
        registeredBy || null,
        academyId || null,
        paymentStatus || 'unpaid',
        pricing?.total || 0,
        JSON.stringify({
          firstName, lastName, dateOfBirth, weight, rank, experience,
          gender, club, email, phone, photo, clubLogo, source,
        }),
        tshirtSize || null,
      ]
    );
    const registration = regResult.rows[0];

    // Insert registration events
    if (events && events.length > 0 && pricing?.breakdown) {
      for (let i = 0; i < events.length; i++) {
        const eventId = events[i];
        const pricingItem = pricing.breakdown.find(b => String(b.eventId) === String(eventId));
        await client.query(
          `INSERT INTO registration_events
            (registration_id, event_id, is_primary, price, selection_order)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (registration_id, event_id) DO NOTHING`,
          [
            registration.id,
            eventId,
            i === 0,
            pricingItem?.price || 0,
            i,
          ]
        );
      }
    }

    await client.query('COMMIT');
    return registration;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Create a coach registration.
 */
async function createCoachRegistration({
  tournamentId, firstName, lastName, rank, club, email, phone, userId, source,
}) {
  const result = await pool.query(
    `INSERT INTO registrations
      (tournament_id, user_id, payment_status, amount_paid, total_due, notes)
     VALUES ($1, $2, 'waived', 0, 0, $3)
     RETURNING *`,
    [
      tournamentId || null,
      userId || null,
      JSON.stringify({
        type: 'coach', firstName, lastName, rank, club, email, phone, source,
      }),
    ]
  );
  return result.rows[0];
}

/**
 * Create a club registration.
 */
async function createClubRegistration({
  tournamentId, name, country, city, email, source,
}) {
  const result = await pool.query(
    `INSERT INTO registrations
      (tournament_id, payment_status, amount_paid, total_due, notes)
     VALUES ($1, 'waived', 0, 0, $2)
     RETURNING *`,
    [
      tournamentId || null,
      JSON.stringify({
        type: 'club', name, country, city, email, source,
      }),
    ]
  );
  return result.rows[0];
}

/**
 * Get all registrations for a tournament, formatted for admin sync.
 * Returns competitor objects compatible with the admin's localStorage schema.
 */
async function getRegistrationsForTournament(tournamentId) {
  const result = await pool.query(
    `SELECT r.*,
            cp.first_name  AS profile_first_name,
            cp.last_name   AS profile_last_name,
            cp.date_of_birth AS profile_dob,
            cp.gender      AS profile_gender,
            cp.belt_rank   AS profile_belt,
            cp.experience_level AS profile_experience,
            cp.weight      AS profile_weight,
            cp.academy_name AS profile_club,
            cp.guardian_email AS profile_guardian_email,
            COALESCE(
              json_agg(
                json_build_object(
                  'eventId', re.event_id,
                  'isPrimary', re.is_primary,
                  'price', re.price,
                  'selectionOrder', re.selection_order
                )
              ) FILTER (WHERE re.id IS NOT NULL),
              '[]'
            ) AS events
     FROM registrations r
     LEFT JOIN competitor_profiles cp ON cp.id = r.profile_id
     LEFT JOIN registration_events re ON re.registration_id = r.id
     WHERE r.tournament_id = $1
     GROUP BY r.id,
              cp.first_name, cp.last_name, cp.date_of_birth, cp.gender,
              cp.belt_rank, cp.experience_level, cp.weight, cp.academy_name, cp.guardian_email
     ORDER BY r.created_at ASC`,
    [tournamentId]
  );
  return result.rows;
}

/**
 * Get all registrations (no tournament filter).
 */
async function getAllRegistrations() {
  const result = await pool.query(
    `SELECT r.*,
            cp.first_name  AS profile_first_name,
            cp.last_name   AS profile_last_name,
            cp.date_of_birth AS profile_dob,
            cp.gender      AS profile_gender,
            cp.belt_rank   AS profile_belt,
            cp.experience_level AS profile_experience,
            cp.weight      AS profile_weight,
            cp.academy_name AS profile_club,
            cp.guardian_email AS profile_guardian_email,
            COALESCE(
              json_agg(
                json_build_object(
                  'eventId', re.event_id,
                  'isPrimary', re.is_primary,
                  'price', re.price,
                  'selectionOrder', re.selection_order
                )
              ) FILTER (WHERE re.id IS NOT NULL),
              '[]'
            ) AS events
     FROM registrations r
     LEFT JOIN competitor_profiles cp ON cp.id = r.profile_id
     LEFT JOIN registration_events re ON re.registration_id = r.id
     GROUP BY r.id,
              cp.first_name, cp.last_name, cp.date_of_birth, cp.gender,
              cp.belt_rank, cp.experience_level, cp.weight, cp.academy_name, cp.guardian_email
     ORDER BY r.created_at ASC`
  );
  return result.rows;
}

/**
 * Update registration status (active, pending_guardian, cancelled).
 */
async function updateStatus(registrationId, status) {
  const result = await pool.query(
    `UPDATE registrations SET status = $1, updated_at = NOW()
     WHERE id = $2 RETURNING *`,
    [status, registrationId]
  );
  return result.rows[0] || null;
}

/**
 * Get all registrations for an academy's members.
 */
async function getRegistrationsForAcademy(academyId) {
  const result = await pool.query(
    `SELECT r.*,
            u.first_name, u.last_name, u.email AS user_email,
            COALESCE(
              json_agg(
                json_build_object(
                  'eventId', re.event_id,
                  'isPrimary', re.is_primary,
                  'price', re.price,
                  'selectionOrder', re.selection_order
                )
              ) FILTER (WHERE re.id IS NOT NULL),
              '[]'
            ) AS events
     FROM registrations r
     JOIN users u ON u.id = r.user_id
     LEFT JOIN registration_events re ON re.registration_id = r.id
     WHERE r.academy_id = $1
     GROUP BY r.id, u.first_name, u.last_name, u.email
     ORDER BY r.created_at DESC`,
    [academyId]
  );
  return result.rows;
}

/**
 * Cursor-based paginated registrations for a tournament.
 *
 * Stable cursor = (created_at, id) — both are indexed; gives deterministic order
 * even if two rows share the same timestamp.
 *
 * Options:
 *   cursor  — opaque base64 string returned by this function as `nextCursor`
 *   limit   — page size, default 100, max 500
 *   search  — free-text search on competitor name / email / club
 *   status  — filter on r.status  (e.g. 'active', 'pending_guardian')
 *
 * Returns { rows, nextCursor } where nextCursor is null on the last page.
 */
async function getPaginatedRegistrationsForTournament(tournamentId, {
  cursor = null,
  limit  = 100,
  search = '',
  status = '',
} = {}) {
  const pageSize = Math.min(parseInt(limit, 10) || 100, 500);

  // Decode cursor
  let cursorTs = null;
  let cursorId = null;
  if (cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
      cursorTs = decoded.ts;
      cursorId = decoded.id;
    } catch (_) {
      // ignore bad cursor — start from beginning
    }
  }

  const params = [tournamentId];
  const conditions = ['r.tournament_id = $1'];

  if (status) {
    params.push(status);
    conditions.push(`r.status = $${params.length}`);
  }

  if (cursorTs && cursorId) {
    params.push(cursorTs, cursorId);
    conditions.push(
      `(r.created_at, r.id::text) > ($${params.length - 1}::timestamptz, $${params.length})`
    );
  }

  // Search across profile name, notes JSON name fields, and email
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    params.push(term);
    const p = params.length;
    // notes is stored as text; cast to jsonb for field extraction.
    // Use a safe cast that falls back to NULL rather than raising an error.
    conditions.push(`(
      cp.first_name ILIKE $${p}
      OR cp.last_name  ILIKE $${p}
      OR (CASE WHEN r.notes IS NOT NULL AND r.notes <> '' THEN (r.notes::jsonb)->>'firstName' ELSE NULL END) ILIKE $${p}
      OR (CASE WHEN r.notes IS NOT NULL AND r.notes <> '' THEN (r.notes::jsonb)->>'lastName'  ELSE NULL END) ILIKE $${p}
      OR (CASE WHEN r.notes IS NOT NULL AND r.notes <> '' THEN (r.notes::jsonb)->>'email'     ELSE NULL END) ILIKE $${p}
      OR (CASE WHEN r.notes IS NOT NULL AND r.notes <> '' THEN (r.notes::jsonb)->>'club'      ELSE NULL END) ILIKE $${p}
    )`);
  }

  const where = conditions.join(' AND ');

  // Fetch one extra row to determine whether there's a next page
  params.push(pageSize + 1);
  const result = await pool.query(
    `SELECT r.*,
            cp.first_name  AS profile_first_name,
            cp.last_name   AS profile_last_name,
            cp.date_of_birth AS profile_dob,
            cp.gender      AS profile_gender,
            cp.belt_rank   AS profile_belt,
            cp.experience_level AS profile_experience,
            cp.weight      AS profile_weight,
            cp.academy_name AS profile_club,
            cp.guardian_email AS profile_guardian_email,
            COALESCE(
              json_agg(
                json_build_object(
                  'eventId', re.event_id,
                  'isPrimary', re.is_primary,
                  'price', re.price,
                  'selectionOrder', re.selection_order
                )
              ) FILTER (WHERE re.id IS NOT NULL),
              '[]'
            ) AS events
     FROM registrations r
     LEFT JOIN competitor_profiles cp ON cp.id = r.profile_id
     LEFT JOIN registration_events re ON re.registration_id = r.id
     WHERE ${where}
     GROUP BY r.id,
              cp.first_name, cp.last_name, cp.date_of_birth, cp.gender,
              cp.belt_rank, cp.experience_level, cp.weight, cp.academy_name, cp.guardian_email
     ORDER BY r.created_at ASC, r.id ASC
     LIMIT $${params.length}`,
    params
  );

  const rows = result.rows;
  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;

  // Build next cursor from last row of this page
  let nextCursor = null;
  if (hasMore && page.length > 0) {
    const last = page[page.length - 1];
    nextCursor = Buffer.from(
      JSON.stringify({ ts: last.created_at, id: last.id })
    ).toString('base64');
  }

  return { rows: page, nextCursor, pageSize, hasMore };
}

/**
 * Find a registration by ID.
 */
async function findById(registrationId) {
  const result = await pool.query(
    'SELECT * FROM registrations WHERE id = $1',
    [registrationId]
  );
  return result.rows[0] || null;
}

module.exports = {
  createCompetitorRegistration,
  createCoachRegistration,
  createClubRegistration,
  getRegistrationsForTournament,
  getPaginatedRegistrationsForTournament,
  getAllRegistrations,
  updateStatus,
  getRegistrationsForAcademy,
  findById,
};
