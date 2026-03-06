const profileQueries = require('../db/queries/profiles');
const pool = require('../db/pool');

/**
 * GET /api/profiles
 * Get all profiles for the logged-in user.
 */
async function getProfiles(req, res, next) {
  try {
    const profiles = await profileQueries.getProfilesForUser(req.user.id);
    res.json({ profiles });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/profiles
 * Create a competitor profile.
 */
async function createProfile(req, res, next) {
  try {
    const {
      firstName, lastName, dateOfBirth, gender,
      beltRank, experienceLevel, weight, academyName, isSelf,
      guardianEmail,
    } = req.body;

    // If creating self-profile, check if one already exists
    if (isSelf) {
      const existing = await profileQueries.hasSelfProfile(req.user.id);
      if (existing) {
        return res.status(409).json({ error: 'You already have a self-profile' });
      }
    }

    // Auto-link academy if name matches
    let academyId = null;
    if (academyName) {
      const academyResult = await pool.query(
        'SELECT id FROM academies WHERE LOWER(name) = LOWER($1)',
        [academyName]
      );
      if (academyResult.rows[0]) {
        academyId = academyResult.rows[0].id;
      }
    }

    const profile = await profileQueries.create({
      userId: req.user.id,
      firstName,
      lastName,
      dateOfBirth,
      gender,
      beltRank,
      experienceLevel,
      weight,
      academyName,
      academyId,
      isSelf: isSelf || false,
      guardianEmail,
    });

    res.status(201).json({ profile });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/profiles/:id
 * Update a competitor profile (must own it).
 */
async function updateProfile(req, res, next) {
  try {
    const profileId = req.params.id;

    // Verify ownership
    const existing = await profileQueries.findById(profileId);
    if (!existing) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    if (existing.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own profiles' });
    }

    const {
      firstName, lastName, dateOfBirth, gender,
      beltRank, experienceLevel, weight, academyName,
    } = req.body;

    // Build update object with snake_case keys
    const updates = {};
    if (firstName !== undefined) updates.first_name = firstName;
    if (lastName !== undefined) updates.last_name = lastName;
    if (dateOfBirth !== undefined) updates.date_of_birth = dateOfBirth;
    if (gender !== undefined) updates.gender = gender;
    if (beltRank !== undefined) updates.belt_rank = beltRank;
    if (experienceLevel !== undefined) updates.experience_level = experienceLevel;
    if (weight !== undefined) updates.weight = weight;
    if (academyName !== undefined) {
      updates.academy_name = academyName;
      // Auto-link academy if name matches
      if (academyName) {
        const academyResult = await pool.query(
          'SELECT id FROM academies WHERE LOWER(name) = LOWER($1)',
          [academyName]
        );
        updates.academy_id = academyResult.rows[0]?.id || null;
      } else {
        updates.academy_id = null;
      }
    }

    const profile = await profileQueries.update(profileId, updates);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/profiles/:id
 * Delete a competitor profile (must own it, no active registrations).
 */
async function deleteProfile(req, res, next) {
  try {
    const profileId = req.params.id;

    // Verify ownership
    const existing = await profileQueries.findById(profileId);
    if (!existing) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    if (existing.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own profiles' });
    }
    if (existing.is_self) {
      return res.status(400).json({ error: 'Cannot delete your self-profile' });
    }

    const result = await profileQueries.remove(profileId);
    if (result?.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ message: 'Profile deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
};
