const academyQueries = require('../db/queries/academies');
const userQueries = require('../db/queries/users');
const roleQueries = require('../db/queries/roles');
const registrationQueries = require('../db/queries/registrations');
const guardianQueries = require('../db/queries/guardians');
const membershipRequestQueries = require('../db/queries/membershipRequests');
const { uploadFile } = require('../config/storage');
const {
  sendAccountSetupEmail,
  sendAssistantCoachInviteEmail,
  sendGuardianConfirmationEmail,
} = require('../config/email');

/**
 * POST /api/academies
 * Create a new academy. Requires 'coach' role.
 */
async function createAcademy(req, res, next) {
  try {
    const { name, address, city, state, website } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Academy name is required' });
    }

    // Check if coach already has an academy
    const existing = await academyQueries.findByCoach(req.user.id);
    if (existing) {
      return res.status(409).json({ error: 'You already have an academy. A coach can only manage one academy.' });
    }

    // Create academy with current user as head coach
    const academy = await academyQueries.create({
      name,
      headCoachId: req.user.id,
      address,
      city,
      state,
      website,
    });

    // Add coach as a member with head_coach role
    await academyQueries.addMember(academy.id, req.user.id, 'head_coach', req.user.id);

    res.status(201).json({ academy });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/academies/my
 * Get current user's academy (where they are head coach).
 */
async function getMyAcademy(req, res, next) {
  try {
    const academy = await academyQueries.findByCoach(req.user.id);
    if (!academy) {
      return res.status(404).json({ error: 'No academy found. Create one first.' });
    }

    const members = await academyQueries.getMembers(academy.id);

    res.json({
      academy,
      members: members.map(m => ({
        id: m.user_id,
        email: m.email,
        firstName: m.first_name,
        lastName: m.last_name,
        phone: m.phone,
        profilePhotoUrl: m.profile_photo_url,
        role: m.role,
      })),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/academies/:id
 * Update academy details. Requires head_coach.
 */
async function updateAcademy(req, res, next) {
  try {
    const { id } = req.params;
    const academy = await academyQueries.findById(id);

    if (!academy) {
      return res.status(404).json({ error: 'Academy not found' });
    }

    if (academy.head_coach_id !== req.user.id && !req.user.roles.includes('admin')) {
      return res.status(403).json({ error: 'Only the head coach can update the academy' });
    }

    const { name, address, city, state, website } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (address !== undefined) updates.address = address;
    if (city !== undefined) updates.city = city;
    if (state !== undefined) updates.state = state;
    if (website !== undefined) updates.website = website;

    const updated = await academyQueries.update(id, updates);
    res.json({ academy: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/academies/:id/members
 * Get all members of an academy.
 */
async function getMembers(req, res, next) {
  try {
    const { id } = req.params;
    const academy = await academyQueries.findById(id);

    if (!academy) {
      return res.status(404).json({ error: 'Academy not found' });
    }

    const members = await academyQueries.getMembers(id);

    res.json({
      members: members.map(m => ({
        id: m.user_id,
        email: m.email,
        firstName: m.first_name,
        lastName: m.last_name,
        phone: m.phone,
        profilePhotoUrl: m.profile_photo_url,
        role: m.role,
      })),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/academies/:id/members
 * Add a member to an academy. Requires head_coach.
 */
async function addMember(req, res, next) {
  try {
    const { id } = req.params;
    const { userId, email, role } = req.body;

    const academy = await academyQueries.findById(id);
    if (!academy) {
      return res.status(404).json({ error: 'Academy not found' });
    }

    if (academy.head_coach_id !== req.user.id && !req.user.roles.includes('admin')) {
      return res.status(403).json({ error: 'Only the head coach can add members' });
    }

    // Find user by ID or email
    let targetUser;
    if (userId) {
      targetUser = await userQueries.findById(userId);
    } else if (email) {
      targetUser = await userQueries.findByEmail(email);
    }

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found. They must have an account first.' });
    }

    const validRoles = ['head_coach', 'assistant_coach', 'competitor'];
    const memberRole = validRoles.includes(role) ? role : 'competitor';

    const member = await academyQueries.addMember(id, targetUser.id, memberRole, req.user.id);

    res.status(201).json({
      message: `${targetUser.first_name || targetUser.email} added as ${memberRole}`,
      member: {
        id: targetUser.id,
        email: targetUser.email,
        firstName: targetUser.first_name,
        lastName: targetUser.last_name,
        role: memberRole,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/academies/:id/members/:userId
 * Remove a member from an academy. Requires head_coach.
 */
async function removeMember(req, res, next) {
  try {
    const { id, userId } = req.params;
    const academy = await academyQueries.findById(id);

    if (!academy) {
      return res.status(404).json({ error: 'Academy not found' });
    }

    if (academy.head_coach_id !== req.user.id && !req.user.roles.includes('admin')) {
      return res.status(403).json({ error: 'Only the head coach can remove members' });
    }

    // Prevent removing head coach
    if (userId === academy.head_coach_id) {
      return res.status(400).json({ error: 'Cannot remove the head coach from the academy' });
    }

    await academyQueries.removeMember(id, userId);
    res.json({ message: 'Member removed' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/academies/:id/logo
 * Upload academy logo. Resizes to max 400x400 WebP.
 */
async function uploadLogo(req, res, next) {
  try {
    const { id } = req.params;
    const academy = await academyQueries.findById(id);

    if (!academy) {
      return res.status(404).json({ error: 'Academy not found' });
    }

    if (academy.head_coach_id !== req.user.id && !req.user.roles.includes('admin')) {
      return res.status(403).json({ error: 'Only the head coach can update the logo' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Resize with sharp
    let sharp;
    try {
      sharp = require('sharp');
    } catch (e) {
      // sharp not available — upload original
      const logoUrl = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
      const updated = await academyQueries.updateLogo(id, logoUrl);
      return res.json({ academy: updated });
    }

    const resizedBuffer = await sharp(req.file.buffer)
      .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const logoUrl = await uploadFile(resizedBuffer, 'logo.webp', 'image/webp');
    const updated = await academyQueries.updateLogo(id, logoUrl);

    res.json({ academy: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/academies/:id/register-competitor
 * Coach registers a competitor/student. Creates user account (passwordless), adds to academy.
 * Auto-links coach as guardian if competitor is under 18.
 */
async function registerCompetitorMember(req, res, next) {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, dateOfBirth, phone } = req.body;

    const academy = await academyQueries.findById(id);
    if (!academy) {
      return res.status(404).json({ error: 'Academy not found' });
    }

    if (academy.head_coach_id !== req.user.id && !req.user.roles.includes('admin')) {
      return res.status(403).json({ error: 'Only the head coach can register members' });
    }

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'First name, last name, and email are required' });
    }

    // Check if user already exists
    let targetUser = await userQueries.findByEmail(email);
    let isNewUser = false;

    if (targetUser) {
      // User exists — just add to academy
      await academyQueries.addMember(id, targetUser.id, 'competitor', req.user.id);
    } else {
      // Create passwordless account
      targetUser = await userQueries.createWithoutPassword({
        email,
        firstName,
        lastName,
        dateOfBirth,
        phone,
      });
      isNewUser = true;

      // Assign competitor role
      await roleQueries.addRole(targetUser.id, 'competitor');

      // Add to academy
      await academyQueries.addMember(id, targetUser.id, 'competitor', req.user.id);

      // Send account setup email
      const coach = await userQueries.findById(req.user.id);
      const coachName = `${coach.first_name} ${coach.last_name}`;
      await sendAccountSetupEmail(email, targetUser.verification_token, coachName, academy.name);
    }

    // Minor check — auto-link coach as guardian if under 18
    if (dateOfBirth) {
      const age = calculateAgeFromDOB(dateOfBirth);
      if (age < 18) {
        await guardianQueries.linkGuardian(targetUser.id, req.user.id, 'coach');
      }
    }

    res.status(201).json({
      message: `${firstName} ${lastName} added to ${academy.name}`,
      member: {
        id: targetUser.id,
        email: targetUser.email || email,
        firstName: targetUser.first_name || firstName,
        lastName: targetUser.last_name || lastName,
        dateOfBirth,
        role: 'competitor',
        isNewUser,
        isMinor: dateOfBirth ? calculateAgeFromDOB(dateOfBirth) < 18 : false,
      },
    });
  } catch (err) {
    // Handle duplicate email gracefully
    if (err.code === '23505' && err.constraint && err.constraint.includes('email')) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }
    next(err);
  }
}

/**
 * POST /api/academies/:id/register-assistant
 * Coach registers an assistant coach. Creates user account (passwordless), adds to academy.
 */
async function registerAssistantCoach(req, res, next) {
  try {
    const { id } = req.params;
    const { firstName, lastName, email } = req.body;

    const academy = await academyQueries.findById(id);
    if (!academy) {
      return res.status(404).json({ error: 'Academy not found' });
    }

    if (academy.head_coach_id !== req.user.id && !req.user.roles.includes('admin')) {
      return res.status(403).json({ error: 'Only the head coach can register assistant coaches' });
    }

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'First name, last name, and email are required' });
    }

    // Check if user already exists
    let targetUser = await userQueries.findByEmail(email);
    let isNewUser = false;

    if (targetUser) {
      // User exists — just add to academy as assistant
      await academyQueries.addMember(id, targetUser.id, 'assistant_coach', req.user.id);
      // Add assistant_coach role if they don't have it
      await roleQueries.addRole(targetUser.id, 'assistant_coach');
    } else {
      // Create passwordless account
      targetUser = await userQueries.createWithoutPassword({
        email,
        firstName,
        lastName,
      });
      isNewUser = true;

      // Assign assistant_coach role
      await roleQueries.addRole(targetUser.id, 'assistant_coach');

      // Add to academy
      await academyQueries.addMember(id, targetUser.id, 'assistant_coach', req.user.id);

      // Send invite email
      await sendAssistantCoachInviteEmail(email, targetUser.verification_token, academy.name);
    }

    res.status(201).json({
      message: `${firstName} ${lastName} added as assistant coach`,
      member: {
        id: targetUser.id,
        email: targetUser.email || email,
        firstName: targetUser.first_name || firstName,
        lastName: targetUser.last_name || lastName,
        role: 'assistant_coach',
        isNewUser,
      },
    });
  } catch (err) {
    if (err.code === '23505' && err.constraint && err.constraint.includes('email')) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }
    next(err);
  }
}

/**
 * GET /api/academies/:id/registrations
 * Get all tournament registrations for academy members.
 */
async function getAcademyRegistrations(req, res, next) {
  try {
    const { id } = req.params;
    const academy = await academyQueries.findById(id);

    if (!academy) {
      return res.status(404).json({ error: 'Academy not found' });
    }

    const registrations = await registrationQueries.getRegistrationsForAcademy(id);

    res.json({
      registrations: registrations.map(r => {
        const notes = typeof r.notes === 'string' ? JSON.parse(r.notes) : (r.notes || {});
        return {
          id: r.id,
          firstName: r.first_name || notes.firstName,
          lastName: r.last_name || notes.lastName,
          email: r.user_email || notes.email,
          tournamentId: r.tournament_id,
          status: r.status || 'active',
          paymentStatus: r.payment_status,
          totalDue: parseFloat(r.total_due) || 0,
          amountPaid: parseFloat(r.amount_paid) || 0,
          events: r.events,
          createdAt: r.created_at,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/academies/:id/membership-requests
 * Get pending membership requests for the academy.
 */
async function getMembershipRequests(req, res, next) {
  try {
    const { id } = req.params;
    const academy = await academyQueries.findById(id);

    if (!academy) {
      return res.status(404).json({ error: 'Academy not found' });
    }

    if (academy.head_coach_id !== req.user.id && !req.user.roles.includes('admin')) {
      return res.status(403).json({ error: 'Only the head coach can view membership requests' });
    }

    const requests = await membershipRequestQueries.getPendingForAcademy(id);

    res.json({
      requests: requests.map(r => ({
        id: r.id,
        userId: r.user_id,
        email: r.email,
        firstName: r.first_name,
        lastName: r.last_name,
        phone: r.phone,
        dateOfBirth: r.date_of_birth,
        profilePhotoUrl: r.profile_photo_url,
        requestedAt: r.requested_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/academies/:id/membership-requests/:requestId
 * Approve or deny a membership request.
 */
async function reviewMembershipRequest(req, res, next) {
  try {
    const { id, requestId } = req.params;
    const { action } = req.body;

    const academy = await academyQueries.findById(id);
    if (!academy) {
      return res.status(404).json({ error: 'Academy not found' });
    }

    if (academy.head_coach_id !== req.user.id && !req.user.roles.includes('admin')) {
      return res.status(403).json({ error: 'Only the head coach can review requests' });
    }

    if (action === 'approve') {
      const result = await membershipRequestQueries.approveRequest(requestId, req.user.id);
      if (!result) {
        return res.status(404).json({ error: 'Request not found or already reviewed' });
      }
      res.json({ message: 'Membership request approved' });
    } else if (action === 'deny') {
      const result = await membershipRequestQueries.denyRequest(requestId, req.user.id);
      if (!result) {
        return res.status(404).json({ error: 'Request not found or already reviewed' });
      }
      res.json({ message: 'Membership request denied' });
    } else {
      return res.status(400).json({ error: 'Action must be "approve" or "deny"' });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/academies/:id/bulk-register
 * Bulk register academy members for tournament events.
 * Supports dryRun=true for pricing preview without creating registrations.
 */
async function bulkRegisterForEvents(req, res, next) {
  try {
    const { id } = req.params;
    const { tournamentId, registrations, dryRun } = req.body;

    const academy = await academyQueries.findById(id);
    if (!academy) {
      return res.status(404).json({ error: 'Academy not found' });
    }

    if (academy.head_coach_id !== req.user.id && !req.user.roles.includes('admin')) {
      return res.status(403).json({ error: 'Only the head coach can register members for events' });
    }

    if (!tournamentId || !registrations || !Array.isArray(registrations) || registrations.length === 0) {
      return res.status(400).json({ error: 'Tournament ID and registrations array are required' });
    }

    // Get tournament events for pricing
    const pool = require('../db/pool');
    const tournamentResult = await pool.query(
      'SELECT * FROM tournaments WHERE id = $1',
      [tournamentId]
    );
    if (tournamentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    const tournament = tournamentResult.rows[0];

    const eventsResult = await pool.query(
      'SELECT * FROM tournament_events WHERE tournament_id = $1',
      [tournamentId]
    );
    const tournamentEvents = eventsResult.rows;

    // Calculate pricing for each competitor
    const pricingBreakdown = [];
    let grandTotal = 0;

    for (const reg of registrations) {
      const { userId, eventIds } = reg;
      if (!userId || !eventIds || !Array.isArray(eventIds) || eventIds.length === 0) continue;

      const user = await userQueries.findById(userId);
      if (!user) continue;

      const competitorBreakdown = {
        userId,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        events: [],
        total: 0,
      };

      for (let i = 0; i < eventIds.length; i++) {
        const eventId = eventIds[i];
        const event = tournamentEvents.find(e => e.id === eventId);
        if (!event) continue;

        const isPrimary = i === 0;
        let price;
        if (isPrimary) {
          price = parseFloat(event.price_override || tournament.base_event_price || 75);
        } else {
          price = parseFloat(event.addon_price_override || tournament.addon_event_price || 25);
        }

        competitorBreakdown.events.push({
          eventId,
          eventName: event.name,
          isPrimary,
          price,
        });
        competitorBreakdown.total += price;
      }

      grandTotal += competitorBreakdown.total;
      pricingBreakdown.push(competitorBreakdown);
    }

    // If dry run, return pricing without creating registrations
    if (dryRun) {
      return res.json({
        dryRun: true,
        pricing: pricingBreakdown,
        grandTotal,
      });
    }

    // Create actual registrations
    const createdRegistrations = [];
    for (const breakdown of pricingBreakdown) {
      try {
        const registration = await registrationQueries.createCompetitorRegistration({
          tournamentId,
          userId: breakdown.userId,
          registeredBy: req.user.id,
          academyId: id,
          firstName: breakdown.firstName,
          lastName: breakdown.lastName,
          email: breakdown.email,
          events: breakdown.events.map(e => e.eventId),
          pricing: {
            breakdown: breakdown.events.map(e => ({
              eventId: e.eventId,
              type: e.isPrimary ? 'primary' : 'addon',
              price: e.price,
            })),
            total: breakdown.total,
          },
          paymentStatus: 'unpaid',
          source: 'academy',
        });

        createdRegistrations.push({
          registrationId: registration.id,
          userId: breakdown.userId,
          name: `${breakdown.firstName} ${breakdown.lastName}`,
          total: breakdown.total,
        });
      } catch (err) {
        // Skip duplicates (already registered)
        if (err.code === '23505') {
          createdRegistrations.push({
            userId: breakdown.userId,
            name: `${breakdown.firstName} ${breakdown.lastName}`,
            error: 'Already registered for this tournament',
          });
        } else {
          throw err;
        }
      }
    }

    res.status(201).json({
      message: `${createdRegistrations.length} registration(s) created`,
      registrations: createdRegistrations,
      grandTotal,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/academies/search?q=...
 * Public academy name search for autocomplete.
 */
async function searchAcademies(req, res, next) {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json({ academies: [] });
    }

    const academies = await academyQueries.searchByName(q, 10);
    res.json({ academies });
  } catch (err) {
    next(err);
  }
}

/**
 * Calculate age from date of birth (simple helper).
 */
function calculateAgeFromDOB(dob) {
  const birthDate = new Date(typeof dob === 'string' && dob.length === 10 ? dob + 'T12:00:00' : dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

module.exports = {
  createAcademy,
  getMyAcademy,
  updateAcademy,
  getMembers,
  addMember,
  removeMember,
  uploadLogo,
  registerCompetitorMember,
  registerAssistantCoach,
  getAcademyRegistrations,
  getMembershipRequests,
  reviewMembershipRequest,
  bulkRegisterForEvents,
  searchAcademies,
};
