const guardianQueries = require('../db/queries/guardians');
const userQueries = require('../db/queries/users');
const { sendGuardianConfirmationEmail, sendGuardianConfirmedEmail } = require('../config/email');

/**
 * GET /api/guardians/confirm?token=X
 * Confirms guardianship via token. If user is logged in and email matches, auto-confirms.
 * Otherwise, returns info so frontend can prompt login/signup.
 */
async function confirmGuardianship(req, res, next) {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ error: 'Confirmation token is required' });
    }

    // Find the pending confirmation
    const confirmation = await guardianQueries.findConfirmationByToken(token);
    if (!confirmation) {
      return res.status(400).json({ error: 'Invalid or expired confirmation token' });
    }

    // If user is logged in and email matches, auto-confirm
    if (req.user) {
      const user = await userQueries.findByEmail(confirmation.guardian_email);
      if (user && user.id === req.user.id) {
        const result = await guardianQueries.confirmGuardian(token, req.user.id);
        if (result) {
          // Try to notify the coach (find the academy head coach)
          return res.json({
            message: 'Guardianship confirmed successfully',
            confirmed: true,
            minor: {
              firstName: confirmation.minor_first_name,
              lastName: confirmation.minor_last_name,
            },
          });
        }
      }
      // User is logged in but email doesn't match
      return res.status(403).json({
        error: 'Your account email does not match the guardian email on this confirmation',
        guardianEmail: confirmation.guardian_email,
      });
    }

    // User not logged in — return confirmation details so frontend can prompt login/signup
    res.json({
      confirmed: false,
      needsAuth: true,
      guardianEmail: confirmation.guardian_email,
      minor: {
        firstName: confirmation.minor_first_name,
        lastName: confirmation.minor_last_name,
      },
      relationship: confirmation.relationship,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/guardians/confirm
 * Explicit confirmation after user logs in (called from frontend after auth).
 */
async function confirmGuardianshipPost(req, res, next) {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Confirmation token is required' });
    }

    const confirmation = await guardianQueries.findConfirmationByToken(token);
    if (!confirmation) {
      return res.status(400).json({ error: 'Invalid or expired confirmation token' });
    }

    // Verify the logged-in user's email matches
    const user = await userQueries.findById(req.user.id);
    if (user.email.toLowerCase() !== confirmation.guardian_email.toLowerCase()) {
      return res.status(403).json({
        error: 'Your account email does not match the guardian email on this confirmation',
      });
    }

    const result = await guardianQueries.confirmGuardian(token, req.user.id);
    if (!result) {
      return res.status(400).json({ error: 'Confirmation failed' });
    }

    res.json({
      message: 'Guardianship confirmed successfully',
      confirmed: true,
      minor: {
        firstName: confirmation.minor_first_name,
        lastName: confirmation.minor_last_name,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/guardians/minors
 * Returns all minors linked to the logged-in user as guardian.
 */
async function getMyMinors(req, res, next) {
  try {
    const minors = await guardianQueries.getMinorsForGuardian(req.user.id);

    res.json({
      minors: minors.map(m => ({
        id: m.minor_user_id,
        email: m.email,
        firstName: m.first_name,
        lastName: m.last_name,
        phone: m.phone,
        dateOfBirth: m.date_of_birth,
        relationship: m.relationship,
      })),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/guardians/add-parent
 * Coach adds a parent/legal_guardian email for a minor. Sends confirmation email.
 */
async function addParentGuardian(req, res, next) {
  try {
    const { minorUserId, guardianEmail, relationship } = req.body;

    if (!minorUserId || !guardianEmail) {
      return res.status(400).json({ error: 'Minor user ID and guardian email are required' });
    }

    const validRelationships = ['parent', 'legal_guardian'];
    const rel = validRelationships.includes(relationship) ? relationship : 'parent';

    // Verify minor exists
    const minor = await userQueries.findById(minorUserId);
    if (!minor) {
      return res.status(404).json({ error: 'Minor user not found' });
    }

    // Create confirmation and send email
    const confirmation = await guardianQueries.createConfirmation(
      minorUserId,
      guardianEmail,
      rel
    );

    const minorName = `${minor.first_name} ${minor.last_name}`;
    await sendGuardianConfirmationEmail(guardianEmail, confirmation.token, minorName, rel);

    res.status(201).json({
      message: `Guardian confirmation email sent to ${guardianEmail}`,
      confirmation: {
        id: confirmation.id,
        guardianEmail: confirmation.guardian_email,
        relationship: rel,
        expiresAt: confirmation.expires_at,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  confirmGuardianship,
  confirmGuardianshipPost,
  getMyMinors,
  addParentGuardian,
};
