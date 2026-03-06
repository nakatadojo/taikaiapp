const crypto = require('crypto');
const waiverQueries = require('../db/queries/waivers');
const profileQueries = require('../db/queries/profiles');
const pool = require('../db/pool');
const { sendWaiverRequestEmail, sendWaiverSignedEmail, APP_URL } = require('../email');

const DEFAULT_WAIVER_TEXT = `I, the undersigned parent/guardian, acknowledge that my child will be participating in a martial arts tournament. I understand that martial arts activities carry inherent risks of injury, including but not limited to bruises, sprains, fractures, and other physical harm.

I agree to hold harmless the tournament organizers, coaches, officials, venue operators, and all associated parties from any liability arising from my child's participation in the tournament.

I confirm that my child is in good physical health and able to participate in martial arts competition. I understand that it is my responsibility to ensure my child has appropriate medical clearance and insurance coverage.

By signing this waiver, I give my consent for my child to participate in the tournament and acknowledge that I have read, understood, and agree to these terms.`;

/**
 * GET /api/waivers/:token (PUBLIC)
 * Get waiver details for the signing page.
 */
async function getWaiverByToken(req, res, next) {
  try {
    const { token } = req.params;
    const waiver = await waiverQueries.findByToken(token);

    if (!waiver) {
      return res.status(404).json({ error: 'Waiver not found or invalid link' });
    }

    res.json({
      waiver: {
        id: waiver.id,
        competitorName: waiver.competitor_name,
        parentEmail: waiver.parent_email,
        tournamentName: waiver.tournament_name,
        tournamentDate: waiver.tournament_date,
        tournamentLocation: waiver.tournament_location,
        waiverText: waiver.waiver_text || DEFAULT_WAIVER_TEXT,
        status: waiver.status,
        signedAt: waiver.signed_at,
        parentName: waiver.parent_name,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/waivers/:token/sign (PUBLIC)
 * Sign a waiver.
 */
async function signWaiver(req, res, next) {
  try {
    const { token } = req.params;
    const { parentName, agree } = req.body;

    if (!parentName || !parentName.trim()) {
      return res.status(400).json({ error: 'Your full name is required' });
    }
    if (agree !== true && agree !== 'true') {
      return res.status(400).json({ error: 'You must agree to the waiver terms' });
    }

    const signedIp = req.ip || req.connection?.remoteAddress || null;
    const waiver = await waiverQueries.sign(token, parentName.trim(), signedIp);

    if (!waiver) {
      // Could be already signed or invalid token
      const existing = await waiverQueries.findByToken(token);
      if (existing && existing.status === 'signed') {
        return res.status(400).json({ error: 'This waiver has already been signed' });
      }
      return res.status(404).json({ error: 'Waiver not found or invalid link' });
    }

    // Send notification email to coach (non-blocking)
    try {
      if (waiver.created_by) {
        const coachResult = await pool.query('SELECT email, first_name, last_name FROM users WHERE id = $1', [waiver.created_by]);
        const coach = coachResult.rows[0];
        if (coach) {
          const tournamentResult = await pool.query('SELECT name FROM tournaments WHERE id = $1', [waiver.tournament_id]);
          const tournamentName = tournamentResult.rows[0]?.name || 'Tournament';
          await sendWaiverSignedEmail(coach.email, {
            competitorName: waiver.competitor_name,
            parentName: parentName.trim(),
            tournamentName,
          });
        }
      }
    } catch (emailErr) {
      console.warn('Failed to send waiver signed notification:', emailErr.message);
    }

    res.json({
      message: 'Waiver signed successfully',
      waiver: {
        id: waiver.id,
        status: waiver.status,
        signedAt: waiver.signed_at,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/waivers/registration/:registrationId (AUTH)
 * Get waivers for a specific registration.
 */
async function getWaiversForRegistration(req, res, next) {
  try {
    const { registrationId } = req.params;

    // Verify the registration belongs to the user or user is the registered_by coach
    const regResult = await pool.query(
      'SELECT user_id, registered_by FROM registrations WHERE id = $1',
      [registrationId]
    );
    if (!regResult.rows[0]) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    const reg = regResult.rows[0];
    if (reg.user_id !== req.user.id && reg.registered_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const waivers = await waiverQueries.getByRegistration(registrationId);
    res.json({ waivers });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/waivers/coach/all (AUTH)
 * Get all waivers created by the logged-in coach.
 */
async function getCoachWaivers(req, res, next) {
  try {
    const { tournamentId } = req.query;
    let waivers;

    if (tournamentId) {
      waivers = await waiverQueries.getByTournamentAndCoach(tournamentId, req.user.id);
    } else {
      waivers = await waiverQueries.getByCoach(req.user.id);
    }

    res.json({ waivers });
  } catch (err) {
    next(err);
  }
}

/**
 * Internal helper: Create waivers for all registrations after coach checkout.
 * Called from registrationController after successful payment.
 *
 * @param {string[]} registrationIds - Array of registration UUIDs
 * @param {string} coachUserId - The coach's user ID
 * @param {string} tournamentId - The tournament ID
 */
async function createWaiversForRegistration(registrationIds, coachUserId, tournamentId) {
  // Get coach name for email
  const coachResult = await pool.query(
    'SELECT first_name, last_name FROM users WHERE id = $1',
    [coachUserId]
  );
  const coach = coachResult.rows[0];
  const coachName = coach ? `${coach.first_name} ${coach.last_name}`.trim() : 'Coach';

  // Get tournament info for email
  const tournamentResult = await pool.query(
    'SELECT name, date FROM tournaments WHERE id = $1',
    [tournamentId]
  );
  const tournament = tournamentResult.rows[0];

  for (const registrationId of registrationIds) {
    try {
      // Get the registration to find the profile
      const regResult = await pool.query(
        'SELECT profile_id FROM registrations WHERE id = $1',
        [registrationId]
      );
      const reg = regResult.rows[0];
      if (!reg || !reg.profile_id) continue;

      // Get the profile to find guardian_email
      const profile = await profileQueries.findById(reg.profile_id);
      if (!profile || !profile.guardian_email) continue;

      const competitorName = `${profile.first_name} ${profile.last_name}`.trim();
      const token = crypto.randomBytes(32).toString('hex');

      // Create waiver record
      await waiverQueries.create({
        registrationId,
        tournamentId,
        profileId: profile.id,
        competitorName,
        parentEmail: profile.guardian_email,
        token,
        createdBy: coachUserId,
        waiverText: DEFAULT_WAIVER_TEXT,
      });

      // Send waiver request email to parent (non-blocking per waiver)
      try {
        const waiverUrl = `${APP_URL()}/waiver.html?token=${token}`;
        await sendWaiverRequestEmail(profile.guardian_email, {
          competitorName,
          tournamentName: tournament?.name || 'Tournament',
          tournamentDate: tournament?.date,
          coachName,
          token,
        });
      } catch (emailErr) {
        console.warn(`Failed to send waiver email to ${profile.guardian_email}:`, emailErr.message);
      }
    } catch (err) {
      console.warn(`Failed to create waiver for registration ${registrationId}:`, err.message);
    }
  }
}

module.exports = {
  getWaiverByToken,
  signWaiver,
  getWaiversForRegistration,
  getCoachWaivers,
  createWaiversForRegistration,
};
