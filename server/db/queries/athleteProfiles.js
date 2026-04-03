const pool = require('../pool');

/**
 * Athlete Profile Queries
 *
 * Provides CRUD + history for cross-tournament athlete identity.
 */
const AthleteProfileQueries = {
  /**
   * Find profile by user_id.
   */
  async findByUserId(userId) {
    const { rows } = await pool.query(
      'SELECT * FROM athlete_profiles WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    return rows[0] || null;
  },

  /**
   * Find profile by id.
   */
  async findById(profileId) {
    const { rows } = await pool.query(
      'SELECT * FROM athlete_profiles WHERE id = $1 LIMIT 1',
      [profileId]
    );
    return rows[0] || null;
  },

  /**
   * Find profile by email (used when user_id is unavailable).
   */
  async findByEmail(email) {
    const { rows } = await pool.query(
      'SELECT * FROM athlete_profiles WHERE email = $1 LIMIT 1',
      [email]
    );
    return rows[0] || null;
  },

  /**
   * Create a new athlete profile.
   */
  async create({ userId, firstName, lastName, dateOfBirth, gender, weight,
                 beltRank, experienceLevel, academyName, email, phone,
                 photoUrl, nationality }) {
    const { rows } = await pool.query(
      `INSERT INTO athlete_profiles
        (user_id, first_name, last_name, date_of_birth, gender, weight,
         belt_rank, experience_level, academy_name, email, phone, photo_url, nationality)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        userId || null,
        firstName, lastName,
        dateOfBirth || null,
        gender || null,
        weight || null,
        beltRank || null,
        experienceLevel || null,
        academyName || null,
        email || null,
        phone || null,
        photoUrl || null,
        nationality || null,
      ]
    );
    return rows[0];
  },

  /**
   * Find existing profile or create one.
   * Matches by user_id first, then by email.
   */
  async findOrCreate({ userId, firstName, lastName, dateOfBirth, gender, weight,
                       beltRank, experienceLevel, academyName, email, phone,
                       photoUrl, nationality }) {
    // 1. Try by userId
    if (userId) {
      const existing = await AthleteProfileQueries.findByUserId(userId);
      if (existing) return existing;
    }

    // 2. Try by email
    if (email) {
      const byEmail = await AthleteProfileQueries.findByEmail(email);
      if (byEmail) {
        // If we now have a userId that isn't linked yet, link it
        if (userId && !byEmail.user_id) {
          const { rows } = await pool.query(
            'UPDATE athlete_profiles SET user_id=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
            [userId, byEmail.id]
          );
          return rows[0];
        }
        return byEmail;
      }
    }

    // 3. Create new
    return AthleteProfileQueries.create({
      userId, firstName, lastName, dateOfBirth, gender, weight,
      beltRank, experienceLevel, academyName, email, phone, photoUrl, nationality,
    });
  },

  /**
   * Update an athlete profile.
   */
  async update(profileId, updates) {
    const fields = [];
    const values = [];
    let idx = 1;

    const allowed = [
      'first_name', 'last_name', 'date_of_birth', 'gender', 'weight',
      'belt_rank', 'experience_level', 'academy_name', 'email', 'phone',
      'photo_url', 'nationality',
    ];

    // Accept camelCase keys and convert to snake_case
    const camelToSnake = (s) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());

    for (const [key, val] of Object.entries(updates)) {
      const col = camelToSnake(key);
      if (allowed.includes(col)) {
        fields.push(`${col} = $${idx++}`);
        values.push(val);
      }
    }

    if (fields.length === 0) return AthleteProfileQueries.findById(profileId);

    fields.push(`updated_at = NOW()`);
    values.push(profileId);

    const { rows } = await pool.query(
      `UPDATE athlete_profiles SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return rows[0] || null;
  },

  /**
   * Link an athlete profile to a registration.
   */
  async linkToRegistration(registrationId, profileId) {
    const { rows } = await pool.query(
      `UPDATE registrations SET athlete_profile_id = $1 WHERE id = $2 RETURNING id`,
      [profileId, registrationId]
    );
    return rows[0] || null;
  },

  /**
   * Get tournament history for an athlete profile.
   * Returns all tournaments + placement/results for this athlete.
   */
  async getRegistrationHistory(profileId) {
    const { rows } = await pool.query(
      `SELECT
         r.id AS registration_id,
         r.tournament_id,
         r.notes->>'firstName' AS first_name,
         r.notes->>'lastName'  AS last_name,
         r.payment_status,
         r.created_at AS registered_at,
         t.name AS tournament_name,
         t.date AS tournament_date,
         t.location AS tournament_location,
         COALESCE(
           json_agg(
             json_build_object(
               'result_id',     pl.result_id,
               'event_name',    pl.event_name,
               'division_name', pl.division_name,
               'placement',     pl.placement,
               'points',        pl.points,
               'medal',         pl.medal
             )
           ) FILTER (WHERE pl.id IS NOT NULL),
           '[]'::json
         ) AS placements
       FROM registrations r
       JOIN tournaments t ON r.tournament_id = t.id
       LEFT JOIN competitor_placements pl ON pl.registration_id = r.id
       WHERE r.athlete_profile_id = $1
       GROUP BY r.id, r.tournament_id, r.notes, r.payment_status, r.created_at,
                t.name, t.date, t.location
       ORDER BY r.created_at DESC`,
      [profileId]
    );
    return rows;
  },
};

module.exports = AthleteProfileQueries;
