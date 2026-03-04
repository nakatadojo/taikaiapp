const pool = require('../pool');

/**
 * Create a competitor registration with events.
 */
async function createCompetitorRegistration({
  tournamentId, userId, registeredBy, academyId,
  firstName, lastName, dateOfBirth, weight, rank, experience,
  gender, club, email, phone, photo, clubLogo,
  events, pricing, paymentStatus, source,
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert registration
    const regResult = await client.query(
      `INSERT INTO registrations
        (tournament_id, user_id, registered_by, academy_id, payment_status, amount_paid, total_due, notes)
       VALUES ($1, $2, $3, $4, $5, 0, $6, $7)
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
 * Create an instructor registration.
 */
async function createInstructorRegistration({
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
        type: 'instructor', firstName, lastName, rank, club, email, phone, source,
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
     LEFT JOIN registration_events re ON re.registration_id = r.id
     WHERE r.tournament_id = $1
     GROUP BY r.id
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
     LEFT JOIN registration_events re ON re.registration_id = r.id
     GROUP BY r.id
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
  createInstructorRegistration,
  createClubRegistration,
  getRegistrationsForTournament,
  getAllRegistrations,
  updateStatus,
  getRegistrationsForAcademy,
  findById,
};
