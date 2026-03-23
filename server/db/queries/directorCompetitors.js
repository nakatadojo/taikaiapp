const pool = require('../pool');

async function getAll(tournamentId) {
  // Unified query: director-added competitors UNION Stripe/public registrations.
  // Both sources are normalised into the same shape so the client sees one list.
  //
  // KEY FACTS about the registrations table:
  //   r.status        = lifecycle state: 'active' | 'cancelled' | 'pending_guardian'
  //   r.payment_status = payment state:  'paid' | 'unpaid' | 'pay_later' | 'pending'
  //
  // Stripe webhook always creates registrations with status='active', payment_status='paid'.
  // Pay-later registrations get status='active', payment_status='pay_later'.
  // The filter must use status != 'cancelled', NOT status IN ('paid',...).
  const { rows } = await pool.query(
    `SELECT
       tdc.id                              AS id,
       tdc.is_test                         AS is_test,
       tdc.approved                        AS approved,
       tdc.bracket_placed                  AS bracket_placed,
       'director'                          AS source,
       (tdc.data->>'firstName')            AS "firstName",
       (tdc.data->>'lastName')             AS "lastName",
       (tdc.data->>'dob')                  AS dob,
       (tdc.data->>'gender')               AS gender,
       (tdc.data->>'rank')                 AS rank,
       (tdc.data->>'experience')           AS experience,
       (tdc.data->>'weight')               AS weight,
       (tdc.data->>'club')                 AS club,
       (tdc.data->>'email')                AS email,
       (tdc.data->>'phone')                AS phone,
       tdc.data                            AS raw_data,
       NULL::uuid                          AS registration_id,
       'director'                          AS payment_status,
       NULL::numeric                       AS amount_paid,
       tdc.created_at,
       NULL::text[]                        AS event_ids
     FROM tournament_director_competitors tdc
     WHERE tdc.tournament_id = $1

     UNION ALL

     SELECT
       COALESCE(cp.id, r.id)              AS id,
       FALSE                              AS is_test,
       TRUE                               AS approved,
       FALSE                              AS bracket_placed,
       'registration'                     AS source,
       cp.first_name                      AS "firstName",
       cp.last_name                       AS "lastName",
       cp.date_of_birth::text             AS dob,
       cp.gender                          AS gender,
       cp.belt_rank                       AS rank,
       cp.experience_level                AS experience,
       cp.weight::text                    AS weight,
       cp.academy_name                    AS club,
       COALESCE(u.email, cp.guardian_email) AS email,
       NULL::text                         AS phone,
       NULL::jsonb                        AS raw_data,
       r.id                               AS registration_id,
       r.payment_status                   AS payment_status,
       r.amount_paid                      AS amount_paid,
       r.created_at,
       array_agg(re.event_id::text) FILTER (WHERE re.event_id IS NOT NULL) AS event_ids
     FROM registrations r
     LEFT JOIN competitor_profiles cp ON cp.id = r.profile_id
     LEFT JOIN users u ON u.id = r.user_id
     LEFT JOIN registration_events re ON re.registration_id = r.id
     WHERE r.tournament_id = $1
       AND r.status != 'cancelled'
     GROUP BY r.id, cp.id, u.email

     ORDER BY created_at ASC`,
    [tournamentId]
  );

  return rows.map(r => ({
    id:              r.id,
    is_test:         r.is_test,
    approved:        r.approved,
    bracket_placed:  r.bracket_placed,
    source:          r.source,
    registration_id: r.registration_id || null,
    // camelCase so loadDashboard's paymentStatus check works
    paymentStatus:   r.payment_status  || null,
    payment_status:  r.payment_status  || null,
    amountPaid:      r.amount_paid     ? parseFloat(r.amount_paid) : 0,
    firstName:       r.firstName || '',
    lastName:        r.lastName  || '',
    dob:             r.dob       || null,
    gender:          r.gender    || null,
    rank:            r.rank      || null,
    experience:      r.experience|| null,
    weight:          r.weight    || null,
    club:            r.club      || null,
    email:           r.email     || null,
    phone:           r.phone     || null,
    // Registration-sourced competitors: event IDs from registration_events table.
    // Director-added competitors: events array comes from raw_data spread below.
    ...(Array.isArray(r.event_ids) && r.event_ids.length > 0 ? { events: r.event_ids } : {}),
    // Preserve any extra fields stored in raw_data (director-added only).
    // approved/bracket_placed are real columns so they survive the spread safely.
    ...(r.raw_data && typeof r.raw_data === 'object' ? r.raw_data : {}),
  }));
}

async function create(tournamentId, competitorData, isTest = false) {
  const { id: _drop, ...dataWithoutId } = competitorData;
  const { rows } = await pool.query(
    `INSERT INTO tournament_director_competitors (tournament_id, data, is_test)
     VALUES ($1, $2::jsonb, $3)
     RETURNING id, data, is_test, approved, bracket_placed, created_at, updated_at`,
    [tournamentId, JSON.stringify(dataWithoutId), isTest]
  );
  const r = rows[0];
  return { id: r.id, is_test: r.is_test, approved: r.approved, bracket_placed: r.bracket_placed, source: 'director', ...r.data };
}

/**
 * Update a director-added competitor's data.
 * Blocked for test competitors — they are immutable once created.
 */
async function update(id, tournamentId, competitorData) {
  // Guard: test competitors cannot be edited (checked at controller layer too,
  // but enforced here for defence-in-depth).
  const check = await pool.query(
    'SELECT is_test FROM tournament_director_competitors WHERE id = $1 AND tournament_id = $2',
    [id, tournamentId]
  );
  if (check.rows[0]?.is_test) return { error: 'TEST_COMPETITOR' };

  const { id: _drop, ...dataWithoutId } = competitorData;
  const { rows } = await pool.query(
    `UPDATE tournament_director_competitors
     SET data = $3::jsonb, updated_at = NOW()
     WHERE id = $1 AND tournament_id = $2
     RETURNING id, data, is_test, approved, bracket_placed`,
    [id, tournamentId, JSON.stringify(dataWithoutId)]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return { id: r.id, is_test: r.is_test, approved: r.approved, bracket_placed: r.bracket_placed, source: 'director', ...r.data };
}

async function remove(id, tournamentId) {
  const { rows } = await pool.query(
    `DELETE FROM tournament_director_competitors
     WHERE id = $1 AND tournament_id = $2
     RETURNING id, is_test, approved`,
    [id, tournamentId]
  );
  return rows[0] || null;
}

/**
 * Approve a competitor. Returns the updated row including is_test and approved.
 */
async function approve(id, tournamentId) {
  const { rows } = await pool.query(
    `UPDATE tournament_director_competitors
     SET approved = true, updated_at = NOW()
     WHERE id = $1 AND tournament_id = $2
     RETURNING id, is_test, approved, bracket_placed`,
    [id, tournamentId]
  );
  return rows[0] || null;
}

/**
 * Unapprove a competitor.
 * For real (non-test) competitors this is only allowed when bracket_placed = false.
 * Returns the updated row, or null if the competitor was not found.
 * Returns { error: 'BRACKET_LOCKED' } if the real competitor is bracket-placed.
 */
async function unapprove(id, tournamentId) {
  // Fetch current state first
  const { rows: current } = await pool.query(
    'SELECT is_test, bracket_placed FROM tournament_director_competitors WHERE id = $1 AND tournament_id = $2',
    [id, tournamentId]
  );
  if (!current[0]) return null;
  if (!current[0].is_test && current[0].bracket_placed) {
    return { error: 'BRACKET_LOCKED' };
  }

  const { rows } = await pool.query(
    `UPDATE tournament_director_competitors
     SET approved = false, updated_at = NOW()
     WHERE id = $1 AND tournament_id = $2
     RETURNING id, is_test, approved, bracket_placed`,
    [id, tournamentId]
  );
  return rows[0] || null;
}

/**
 * Mark a set of competitors as bracket_placed = true.
 * Only applies to real (non-test) director competitors — test competitors
 * have no credit cost so the lock doesn't apply to them.
 * Safe to call with any list of IDs; non-matching IDs are silently ignored.
 */
async function setBracketPlaced(competitorIds, tournamentId) {
  if (!competitorIds || competitorIds.length === 0) return;
  await pool.query(
    `UPDATE tournament_director_competitors
     SET bracket_placed = true, updated_at = NOW()
     WHERE tournament_id = $1
       AND is_test = false
       AND id = ANY($2::uuid[])`,
    [tournamentId, competitorIds]
  );
}

async function clearBracketPlaced(competitorIds, tournamentId) {
  if (!competitorIds || competitorIds.length === 0) return;
  await pool.query(
    `UPDATE tournament_director_competitors
     SET bracket_placed = false, updated_at = NOW()
     WHERE tournament_id = $1
       AND id = ANY($2::uuid[])`,
    [tournamentId, competitorIds]
  );
}

async function clearTestData(tournamentId) {
  const { rows } = await pool.query(
    `DELETE FROM tournament_director_competitors
     WHERE tournament_id = $1 AND is_test = TRUE
     RETURNING id`,
    [tournamentId]
  );
  return rows.length;
}

async function bulkCreate(tournamentId, competitors, isTest = false) {
  if (!competitors || competitors.length === 0) return [];
  const results = [];
  for (const comp of competitors) {
    const created = await create(tournamentId, comp, isTest);
    results.push(created);
  }
  return results;
}

module.exports = { getAll, create, update, remove, approve, unapprove, setBracketPlaced, clearBracketPlaced, clearTestData, bulkCreate };
