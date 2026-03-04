const registrationQueries = require('../db/queries/registrations');
const guardianQueries = require('../db/queries/guardians');
const membershipRequestQueries = require('../db/queries/membershipRequests');
const userQueries = require('../db/queries/users');
const { sendGuardianConfirmationEmail } = require('../config/email');

/**
 * POST /api/registrations/competitor
 * Public competitor registration — stores in PostgreSQL.
 */
async function registerCompetitor(req, res, next) {
  try {
    const {
      firstName, lastName, dateOfBirth, weight, rank, experience,
      gender, club, email, phone, photo, clubLogo,
      tournamentId, events, pricing, paymentStatus,
    } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'First name, last name, and email are required' });
    }

    const { academyId, guardianEmail } = req.body;

    const registration = await registrationQueries.createCompetitorRegistration({
      tournamentId,
      userId: req.user?.id || null,
      registeredBy: req.user?.id || null,
      academyId: academyId || null,
      firstName, lastName, dateOfBirth, weight, rank, experience,
      gender, club, email, phone, photo, clubLogo,
      events, pricing,
      paymentStatus: paymentStatus || 'unpaid',
      source: 'public',
    });

    let registrationStatus = 'active';
    let guardianMessage = null;

    // Minor protection — check if competitor is under 18
    if (dateOfBirth) {
      const age = calculateAgeForRegistration(dateOfBirth);
      if (age < 18) {
        if (req.user && req.user.roles && req.user.roles.includes('coach')) {
          // Coach registering — auto-link as guardian
          if (req.user.id && registration.user_id) {
            await guardianQueries.linkGuardian(registration.user_id, req.user.id, 'coach');
          }
          guardianMessage = 'Coach linked as guardian for minor';
        } else if (guardianEmail) {
          // Public registration with guardian email — send confirmation, set pending
          const userId = registration.user_id || req.user?.id;
          if (userId) {
            const minorName = `${firstName} ${lastName}`;
            const confirmation = await guardianQueries.createConfirmation(
              userId, guardianEmail, 'parent'
            );
            await sendGuardianConfirmationEmail(guardianEmail, confirmation.token, minorName, 'parent');
            await registrationQueries.updateStatus(registration.id, 'pending_guardian');
            registrationStatus = 'pending_guardian';
            guardianMessage = 'Guardian confirmation email sent. Registration pending until confirmed.';
          }
        } else if (!req.user) {
          // No guardian info and not logged in — still allow but note it
          guardianMessage = 'Competitor is under 18. Guardian confirmation may be required.';
        }
      }
    }

    // If academy selected, create membership request
    if (academyId && req.user?.id) {
      try {
        await membershipRequestQueries.createRequest(academyId, req.user.id);
      } catch (err) {
        // Ignore errors (e.g., already requested)
      }
    }

    const response = {
      message: guardianMessage || 'Registration submitted successfully',
      registration: {
        id: registration.id,
        tournamentId: registration.tournament_id,
        totalDue: registration.total_due,
        paymentStatus: registration.payment_status,
        status: registrationStatus,
      },
    };

    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/registrations/instructor
 * Public instructor registration.
 */
async function registerInstructor(req, res, next) {
  try {
    const { firstName, lastName, rank, club, email, phone, tournamentId } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First name and last name are required' });
    }

    const registration = await registrationQueries.createInstructorRegistration({
      tournamentId,
      firstName, lastName, rank, club, email, phone,
      userId: req.user?.id || null,
      source: 'public',
    });

    res.status(201).json({
      message: 'Instructor registration submitted successfully',
      registration: { id: registration.id },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/registrations/club
 * Public club registration.
 */
async function registerClub(req, res, next) {
  try {
    const { name, country, city, email, tournamentId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Club name is required' });
    }

    const registration = await registrationQueries.createClubRegistration({
      tournamentId, name, country, city, email,
      source: 'public',
    });

    res.status(201).json({
      message: 'Club registration submitted successfully',
      registration: { id: registration.id },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/registrations?tournamentId=X
 * Admin sync endpoint — returns all registrations formatted for localStorage merge.
 */
async function getRegistrations(req, res, next) {
  try {
    const { tournamentId } = req.query;

    let registrations;
    if (tournamentId) {
      registrations = await registrationQueries.getRegistrationsForTournament(tournamentId);
    } else {
      registrations = await registrationQueries.getAllRegistrations();
    }

    // Format registrations into competitor objects compatible with admin localStorage
    const competitors = registrations.map(r => {
      const notes = typeof r.notes === 'string' ? JSON.parse(r.notes) : (r.notes || {});

      // Skip non-competitor registrations (instructor, club)
      if (notes.type === 'instructor' || notes.type === 'club') {
        return {
          id: r.id,
          type: notes.type,
          ...notes,
          tournamentId: r.tournament_id,
          paymentStatus: r.payment_status,
          totalDue: parseFloat(r.total_due) || 0,
          amountPaid: parseFloat(r.amount_paid) || 0,
          registrationDate: r.created_at,
          source: notes.source || 'api',
          serverRegistrationId: r.id,
        };
      }

      // Competitor format matching admin localStorage schema
      const events = Array.isArray(r.events) ? r.events : [];
      const eventIds = events
        .sort((a, b) => a.selectionOrder - b.selectionOrder)
        .map(e => e.eventId);

      return {
        id: r.id,
        firstName: notes.firstName,
        lastName: notes.lastName,
        dateOfBirth: notes.dateOfBirth,
        weight: notes.weight,
        rank: notes.rank,
        experience: notes.experience,
        gender: notes.gender,
        club: notes.club,
        email: notes.email,
        phone: notes.phone,
        photo: notes.photo,
        clubLogo: notes.clubLogo,
        tournamentId: r.tournament_id,
        events: eventIds,
        primaryEventId: eventIds[0] || null,
        pricing: {
          breakdown: events.map(e => ({
            eventId: e.eventId,
            type: e.isPrimary ? 'primary' : 'addon',
            price: parseFloat(e.price) || 0,
          })),
          total: parseFloat(r.total_due) || 0,
        },
        paymentStatus: r.payment_status,
        totalDue: parseFloat(r.total_due) || 0,
        amountPaid: parseFloat(r.amount_paid) || 0,
        registrationDate: r.created_at,
        source: notes.source || 'api',
        serverRegistrationId: r.id,
      };
    });

    res.json({ registrations: competitors });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/registrations/:id/activate
 * Force-activate a pending registration (coach/admin override for expired guardian links).
 */
async function activateRegistration(req, res, next) {
  try {
    const { id } = req.params;

    const registration = await registrationQueries.findById(id);
    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    const updated = await registrationQueries.updateStatus(id, 'active');
    res.json({
      message: 'Registration activated',
      registration: {
        id: updated.id,
        status: updated.status,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Calculate age from date of birth (simple helper for registration flow).
 */
function calculateAgeForRegistration(dob) {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

module.exports = {
  registerCompetitor,
  registerInstructor,
  registerClub,
  getRegistrations,
  activateRegistration,
};
