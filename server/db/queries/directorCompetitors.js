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
       tdc.created_at
     FROM tournament_director_competitors tdc
     WHERE tdc.tournament_id = $1

     UNION ALL

     SELECT
       COALESCE(cp.id, r.id)              AS id,
       FALSE                              AS is_test,
       'registration'                     AS source,
       cp.first_name                      AS "firstName",
       cp.last_name                       AS "lastName",
       cp.date_of_birth::text             AS dob,
       cp.gender                          AS gender,
       cp.belt_rank                       AS rank,
       cp.experience_level                AS experience,
       cp.weight::text                    AS weight,
       cp.academy_name                    AS club,
       r.email                            AS email,
       NULL::text                         AS phone,
       NULL::jsonb                        AS raw_data,
       r.id                               AS registration_id,
       r.payment_status                   AS payment_status,
       r.amount_paid                      AS amount_paid,
       r.created_at
     FROM registrations r
     LEFT JOIN competitor_profiles cp ON cp.id = r.profile_id
     WHERE r.tournament_id = $1
       AND r.status != 'cancelled'

     ORDER BY created_at ASC`,
    [tournamentId]
  );

  return rows.map(r => ({
    id:              r.id,
    is_test:         r.is_test,
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
    // Preserve any extra fields stored in raw_data (director-added only)
    ...(r.raw_data && typeof r.raw_data === 'object' ? r.raw_data : {}),
  }));
}

async function create(tournamentId, competitorData, isTest = false) {
  const { id: _drop, ...dataWithoutId } = competitorData;
  const { rows } = await pool.query(
    `INSERT INTO tournament_director_competitors (tournament_id, data, is_test)
     VALUES ($1, $2::jsonb, $3)
     RETURNING id, data, is_test, created_at, updated_at`,
    [tournamentId, JSON.stringify(dataWithoutId), isTest]
  );
  const r = rows[0];
  return { id: r.id, is_test: r.is_test, source: 'director', ...r.data };
}

async function update(id, tournamentId, competitorData) {
  const { id: _drop, ...dataWithoutId } = competitorData;
  const { rows } = await pool.query(
    `UPDATE tournament_director_competitors
     SET data = $3::jsonb, updated_at = NOW()
     WHERE id = $1 AND tournament_id = $2
     RETURNING id, data, is_test`,
    [id, tournamentId, JSON.stringify(dataWithoutId)]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return { id: r.id, is_test: r.is_test, source: 'director', ...r.data };
}

async function remove(id, tournamentId) {
  const { rows } = await pool.query(
    `DELETE FROM tournament_director_competitors
     WHERE id = $1 AND tournament_id = $2
     RETURNING id`,
    [id, tournamentId]
  );
  return rows[0] || null;
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

module.exports = { getAll, create, update, remove, clearTestData, bulkCreate };
