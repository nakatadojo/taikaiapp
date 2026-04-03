const AthleteProfileQueries = require('../db/queries/athleteProfiles');

/**
 * GET /api/athletes/me
 * Returns the logged-in user's athlete profile (or 404 if none).
 */
async function getMyProfile(req, res, next) {
  try {
    const profile = await AthleteProfileQueries.findByUserId(req.user.id);
    if (!profile) {
      return res.status(404).json({ error: 'No athlete profile found. Register for a tournament to create one.' });
    }
    res.json({ profile });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/athletes/me
 * Create or update the logged-in user's athlete profile.
 */
async function updateMyProfile(req, res, next) {
  try {
    const userId = req.user.id;
    const {
      firstName, lastName, dateOfBirth, gender, weight,
      beltRank, experienceLevel, academyName, email, phone,
      photoUrl, nationality,
    } = req.body;

    // Check for existing profile
    let profile = await AthleteProfileQueries.findByUserId(userId);

    if (profile) {
      profile = await AthleteProfileQueries.update(profile.id, req.body);
    } else {
      profile = await AthleteProfileQueries.create({
        userId,
        firstName: firstName || req.user.first_name || '',
        lastName: lastName || req.user.last_name || '',
        dateOfBirth, gender, weight, beltRank, experienceLevel,
        academyName, email: email || req.user.email, phone, photoUrl, nationality,
      });
    }

    res.json({ profile });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/athletes/me/history
 * Returns the tournament history for the logged-in user's athlete profile.
 */
async function getProfileHistory(req, res, next) {
  try {
    const profile = await AthleteProfileQueries.findByUserId(req.user.id);
    if (!profile) {
      return res.json({ history: [] });
    }
    const history = await AthleteProfileQueries.getRegistrationHistory(profile.id);
    res.json({ profile_id: profile.id, history });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/athletes/:profileId
 * Public profile view — returns non-sensitive fields.
 */
async function getPublicProfile(req, res, next) {
  try {
    const profile = await AthleteProfileQueries.findById(req.params.profileId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Return only public-safe fields
    const publicProfile = {
      id:               profile.id,
      first_name:       profile.first_name,
      last_name:        profile.last_name,
      gender:           profile.gender,
      belt_rank:        profile.belt_rank,
      experience_level: profile.experience_level,
      academy_name:     profile.academy_name,
      nationality:      profile.nationality,
      photo_url:        profile.photo_url,
    };

    // Get history but strip private data
    const history = await AthleteProfileQueries.getRegistrationHistory(profile.id);
    const publicHistory = history.map(h => ({
      tournament_name:     h.tournament_name,
      tournament_date:     h.tournament_date,
      tournament_location: h.tournament_location,
      placements:          h.placements,
    }));

    res.json({ profile: publicProfile, history: publicHistory });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMyProfile,
  updateMyProfile,
  getProfileHistory,
  getPublicProfile,
};
