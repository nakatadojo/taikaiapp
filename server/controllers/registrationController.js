const registrationQueries = require('../db/queries/registrations');
const guardianQueries = require('../db/queries/guardians');
const membershipRequestQueries = require('../db/queries/membershipRequests');
const userQueries = require('../db/queries/users');
const tournamentQueries = require('../db/queries/tournaments');
const profileQueries = require('../db/queries/profiles');
const discountQueries = require('../db/queries/discounts');
const creditQueries = require('../db/queries/credits');
const notificationQueries = require('../db/queries/notifications');
const pool = require('../db/pool');
const { sendGuardianConfirmationEmail } = require('../config/email');
const { sendRegistrationConfirmationEmail } = require('../email');
const { assignDivision } = require('../services/divisionAssignment');

/**
 * POST /api/registrations/competitor
 * Public competitor registration — stores in PostgreSQL.
 */
async function registerCompetitor(req, res, next) {
  try {
    const {
      firstName, lastName, dateOfBirth, weight, rank, experience,
      gender, club, email, phone, photo, clubLogo,
      tournamentId, events, pricing,
    } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'First name, last name, and email are required' });
    }

    const { academyId, guardianEmail } = req.body;

    // paymentStatus is never accepted from the client — always unpaid on creation.
    // Directors mark registrations as paid via the activate endpoint or Stripe checkout.
    const registration = await registrationQueries.createCompetitorRegistration({
      tournamentId,
      userId: req.user?.id || null,
      registeredBy: req.user?.id || null,
      academyId: academyId || null,
      firstName, lastName, dateOfBirth, weight, rank, experience,
      gender, club, email, phone, photo, clubLogo,
      events, pricing,
      paymentStatus: 'unpaid',
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

    // Send confirmation email to the competitor (fire-and-forget — don't fail the response)
    if (email && registrationStatus !== 'pending_guardian') {
      try {
        const tournament = await tournamentQueries.findById(tournamentId);
        if (tournament) {
          const competitorEntry = [{ name: `${firstName} ${lastName}`, events: [], subtotal: 0 }];
          await sendRegistrationConfirmationEmail(email, tournament, competitorEntry, 0, 0, registration.id);
        }
      } catch (emailErr) {
        console.warn('Legacy registration: failed to send confirmation email:', emailErr.message);
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
 * Public dojo registration.
 */
async function registerClub(req, res, next) {
  try {
    const { name, country, city, email, tournamentId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Dojo name is required' });
    }

    const registration = await registrationQueries.createClubRegistration({
      tournamentId, name, country, city, email,
      source: 'public',
    });

    res.status(201).json({
      message: 'Dojo registration submitted successfully',
      registration: { id: registration.id },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/registrations?tournamentId=X
 * Admin sync endpoint — returns all registrations formatted for localStorage merge.
 *
 * Access rules:
 *   - With tournamentId: caller must own that tournament OR have admin/super_admin role.
 *   - Without tournamentId: caller must have admin/super_admin role.
 */
async function getRegistrations(req, res, next) {
  try {
    const { tournamentId } = req.query;
    const userRoles = req.user.roles || [];
    const isAdmin = userRoles.includes('admin') || userRoles.includes('super_admin');

    let registrations;
    if (tournamentId) {
      if (!isAdmin) {
        const tournament = await tournamentQueries.findById(tournamentId);
        if (!tournament) {
          return res.status(404).json({ error: 'Tournament not found' });
        }
        if (tournament.created_by !== req.user.id) {
          return res.status(403).json({ error: 'Not authorized to access this tournament\'s registrations' });
        }
      }
      registrations = await registrationQueries.getRegistrationsForTournament(tournamentId);
    } else {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
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
 * Force-activate a pending registration (tournament director or registration owner only).
 */
async function activateRegistration(req, res, next) {
  try {
    const { id } = req.params;

    const registration = await registrationQueries.findById(id);
    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    // Ownership check: must be the registration owner OR the tournament director OR an admin
    const isRegOwner = registration.registered_by === req.user.id || registration.user_id === req.user.id;
    const userRoles = req.user.roles || [];
    const isAdmin = userRoles.includes('admin') || userRoles.includes('super_admin');

    if (!isRegOwner && !isAdmin) {
      const tournament = await tournamentQueries.findById(registration.tournament_id);
      const isTournamentOwner = tournament && tournament.created_by === req.user.id;
      if (!isTournamentOwner) {
        return res.status(403).json({ error: 'Not authorized' });
      }
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
  const birthDate = new Date(typeof dob === 'string' && dob.length === 10 ? dob + 'T12:00:00' : dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * POST /api/registrations/checkout
 * Validate cart and create Stripe Checkout Session.
 */
async function checkout(req, res, next) {
  try {
    const { tournamentId, competitors, discountCode } = req.body;

    if (!tournamentId || !Array.isArray(competitors) || competitors.length === 0) {
      return res.status(400).json({ error: 'Tournament ID and at least one competitor are required' });
    }

    // Load tournament
    const tournament = await tournamentQueries.findByIdWithEvents(tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Registration deadline enforcement
    if (tournament.registration_deadline) {
      const rawDl = tournament.registration_deadline;
      const deadline = new Date(typeof rawDl === 'string' && rawDl.length === 10 ? rawDl + 'T23:59:59' : rawDl);
      if (new Date() > deadline) {
        return res.status(400).json({
          error: 'Registration for this tournament has closed.',
          code: 'REGISTRATION_CLOSED',
        });
      }
    }

    // Credit check: ensure Event Director has enough credits
    if (tournament.created_by) {
      const directorBalance = await creditQueries.getBalance(tournament.created_by);
      if (directorBalance < competitors.length) {
        return res.status(402).json({
          error: 'Registration is currently unavailable. Please contact the event organizer.',
          code: 'INSUFFICIENT_CREDITS',
        });
      }
    }

    // Check for active pricing period — overrides tournament-level defaults
    const PricingPeriodQueries = require('../db/queries/pricingPeriods');
    const activePeriod = await PricingPeriodQueries.getActivePeriod(tournamentId);

    const basePrice = activePeriod
      ? parseFloat(activePeriod.base_event_price)
      : (parseFloat(tournament.base_event_price) || 75);
    const addonPrice = activePeriod
      ? parseFloat(activePeriod.addon_event_price)
      : (parseFloat(tournament.addon_event_price) || 25);
    const eventMap = new Map(tournament.events.map(e => [e.id, e]));

    // Validate cart and calculate server-side pricing
    let cartTotal = 0;
    const validatedCompetitors = [];

    for (const comp of competitors) {
      // Verify profile ownership
      const profile = await profileQueries.findById(comp.profileId);
      if (!profile || profile.user_id !== req.user.id) {
        return res.status(400).json({ error: `Invalid profile: ${comp.profileId}` });
      }

      // Verify events exist and calculate pricing
      const validatedEvents = [];
      let competitorSubtotal = 0;

      for (let i = 0; i < comp.events.length; i++) {
        const eventId = comp.events[i].eventId;
        const event = eventMap.get(eventId);
        if (!event) {
          return res.status(400).json({ error: `Event not found: ${eventId}` });
        }

        // Check for duplicate registration in same tournament
        const existingReg = await pool.query(
          `SELECT re.id FROM registration_events re
           JOIN registrations r ON r.id = re.registration_id
           WHERE r.tournament_id = $1 AND r.profile_id = $2 AND re.event_id = $3
             AND r.status != 'cancelled'`,
          [tournamentId, comp.profileId, eventId]
        );
        if (existingReg.rows.length > 0) {
          return res.status(400).json({
            error: `${profile.first_name} ${profile.last_name} is already registered for ${event.name}`,
          });
        }

        // Event prerequisite check
        if (event.prerequisite_event_id) {
          const prereqSelected = comp.events.some(e => e.eventId === event.prerequisite_event_id);
          if (!prereqSelected) {
            const prereqReg = await pool.query(
              `SELECT re.id FROM registration_events re
               JOIN registrations r ON r.id = re.registration_id
               WHERE r.tournament_id = $1 AND r.profile_id = $2 AND re.event_id = $3
                 AND r.status != 'cancelled'`,
              [tournamentId, comp.profileId, event.prerequisite_event_id]
            );
            if (prereqReg.rows.length === 0) {
              const prereqEvent = eventMap.get(event.prerequisite_event_id);
              const prereqName = prereqEvent ? prereqEvent.name : 'the prerequisite event';
              return res.status(400).json({
                error: `${event.name} requires registration in ${prereqName} first.`,
                code: 'PREREQUISITE_MISSING',
              });
            }
          }
        }

        // Sold-out capacity check
        if (event.max_competitors) {
          const currentCount = await tournamentQueries.getEventRegistrationCount(eventId);
          if (currentCount >= event.max_competitors) {
            return res.status(400).json({
              error: `${event.name} is full (${event.max_competitors}/${event.max_competitors} spots taken).`,
              code: 'EVENT_FULL',
            });
          }
        }

        const isPrimary = i === 0;
        const eventBasePrice = event.price_override !== null ? parseFloat(event.price_override) : basePrice;
        const eventAddonPrice = event.addon_price_override !== null ? parseFloat(event.addon_price_override) : addonPrice;
        const price = isPrimary ? eventBasePrice : eventAddonPrice;

        validatedEvents.push({
          eventId,
          name: event.name,
          isPrimary,
          price,
        });
        competitorSubtotal += price;
      }

      validatedCompetitors.push({
        profileId: comp.profileId,
        name: `${profile.first_name} ${profile.last_name}`,
        events: validatedEvents,
        subtotal: competitorSubtotal,
      });
      cartTotal += competitorSubtotal;
    }

    // Validate discount code if provided
    let discountData = null;
    let discountAmount = 0;
    if (discountCode) {
      const discountResult = await discountQueries.validate(discountCode, tournamentId);
      if (!discountResult.valid) {
        return res.status(400).json({ error: discountResult.error });
      }
      discountData = discountResult.discount;
      if (discountData.type === 'percentage') {
        discountAmount = Math.round(cartTotal * (parseFloat(discountData.value) / 100) * 100) / 100;
      } else {
        discountAmount = Math.min(parseFloat(discountData.value), cartTotal);
      }
    }

    const finalTotal = Math.max(0, cartTotal - discountAmount);

    // Create Stripe Checkout Session
    let stripeSessionUrl = null;
    let stripeSessionId = null;

    if (finalTotal > 0 && process.env.STRIPE_SECRET_KEY) {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

      // Ensure user has a Stripe Customer ID for future payment method storage
      let stripeCustomerId = null;
      const userRow = await pool.query('SELECT stripe_customer_id, email, first_name, last_name FROM users WHERE id = $1', [req.user.id]);
      const userData = userRow.rows[0];
      if (userData) {
        stripeCustomerId = userData.stripe_customer_id;
        if (!stripeCustomerId) {
          try {
            const customer = await stripe.customers.create({
              email: userData.email,
              name: `${userData.first_name} ${userData.last_name}`,
              metadata: { userId: req.user.id },
            });
            stripeCustomerId = customer.id;
            await pool.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [stripeCustomerId, req.user.id]);
          } catch (e) {
            console.warn('Failed to create Stripe customer:', e.message);
          }
        }
      }

      // Use tournament currency (lowercase for Stripe), fallback to usd
      const stripeCurrency = (tournament.currency || 'usd').toLowerCase();

      const lineItems = validatedCompetitors.map(comp => ({
        price_data: {
          currency: stripeCurrency,
          product_data: {
            name: `${comp.name} — ${comp.events.map(e => e.name).join(', ')}`,
          },
          unit_amount: Math.round(comp.subtotal * 100), // cents (or smallest unit)
        },
        quantity: 1,
      }));

      // Add discount as negative line item if applicable
      if (discountAmount > 0) {
        lineItems.push({
          price_data: {
            currency: stripeCurrency,
            product_data: {
              name: `Discount (${discountCode.toUpperCase()})`,
            },
            unit_amount: Math.round(discountAmount * 100),
          },
          quantity: 1,
        });
      }

      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        ...(stripeCustomerId && { customer: stripeCustomerId }),
        line_items: discountAmount > 0
          ? [{
            price_data: {
              currency: stripeCurrency,
              product_data: {
                name: `${tournament.name} — Tournament Registration`,
                description: validatedCompetitors.map(c => `${c.name}: ${c.events.length} event(s)`).join('; '),
              },
              unit_amount: Math.round(finalTotal * 100),
            },
            quantity: 1,
          }]
          : lineItems,
        success_url: `${appUrl}/register.html?session_id={CHECKOUT_SESSION_ID}#success`,
        cancel_url: `${appUrl}/register.html#cart`,
        metadata: {
          userId: req.user.id,
          tournamentId,
          discountCode: discountCode || '',
          cartData: JSON.stringify({
            competitors: validatedCompetitors,
            discountAmount,
            total: finalTotal,
          }),
        },
      });

      stripeSessionUrl = session.url;
      stripeSessionId = session.id;
    } else if (finalTotal === 0) {
      // Free registration (100% discount) — auto-confirm
      stripeSessionId = `free_${Date.now()}_${req.user.id}`;
    }

    // Create payment transaction record
    const txResult = await pool.query(
      `INSERT INTO payment_transactions
        (user_id, tournament_id, stripe_session_id, amount_total,
         discount_code_id, discount_amount, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.user.id,
        tournamentId,
        stripeSessionId,
        Math.round(finalTotal * 100),
        discountData?.id || null,
        Math.round(discountAmount * 100),
        finalTotal === 0 ? 'completed' : 'pending',
      ]
    );

    // If free (0 total), create registrations immediately
    if (finalTotal === 0) {
      const freeRegIds = await createRegistrationsFromCart(
        req.user.id, tournamentId, validatedCompetitors,
        txResult.rows[0].id, stripeSessionId, discountData
      );

      // Deduct credits from Event Director
      if (tournament.created_by) {
        await creditQueries.deductForRegistration(
          tournament.created_by, validatedCompetitors.length, tournamentId,
          freeRegIds || [],
          `Registration: ${validatedCompetitors.map(c => c.name).join(', ')} for ${tournament.name}`
        );
      }

      // Send confirmation email
      try {
        await sendRegistrationConfirmationEmail(
          req.user.email, tournament, validatedCompetitors,
          finalTotal, discountAmount, stripeSessionId
        );
      } catch (emailErr) {
        console.warn('Failed to send confirmation email:', emailErr.message);
      }

      // If coach registration, create waivers for competitors with guardian emails
      try {
        const coachMembership = await pool.query(
          `SELECT id FROM tournament_members
           WHERE user_id = $1 AND tournament_id = $2 AND role = 'coach' AND status = 'approved'`,
          [req.user.id, tournamentId]
        );
        if (coachMembership.rows.length > 0 && freeRegIds && freeRegIds.length > 0) {
          const { createWaiversForRegistration } = require('./waiverController');
          await createWaiversForRegistration(freeRegIds, req.user.id, tournamentId);
        }
      } catch (waiverErr) {
        console.warn('Waiver creation failed:', waiverErr.message);
      }

      // Notify tournament director of new registration(s)
      if (tournament.created_by) {
        try {
          for (const comp of validatedCompetitors) {
            await notificationQueries.create({
              recipientId: tournament.created_by,
              tournamentId,
              type: 'new_registration',
              payload: {
                competitorName: comp.name,
                eventCount: comp.events.length,
                amountPaid: comp.subtotal,
              },
            });
          }
        } catch (notifErr) {
          console.warn('Failed to create registration notification:', notifErr.message);
        }
      }

      return res.json({
        status: 'completed',
        message: 'Registration confirmed (free with discount)',
        sessionId: stripeSessionId,
        total: finalTotal,
      });
    }

    // Return Stripe session URL for paid registrations
    res.json({
      status: 'pending',
      checkoutUrl: stripeSessionUrl,
      sessionId: stripeSessionId,
      total: finalTotal,
      discountAmount,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/registrations/confirm
 * Confirm payment and create registration records.
 */
async function confirmPayment(req, res, next) {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Check if already confirmed
    const existing = await pool.query(
      'SELECT * FROM payment_transactions WHERE stripe_session_id = $1',
      [sessionId]
    );
    if (!existing.rows[0]) {
      return res.status(404).json({ error: 'Payment session not found' });
    }

    // Only the purchaser (or a super_admin) may confirm a session
    const userRoles = req.user.roles || [];
    if (!userRoles.includes('super_admin') && existing.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to confirm this payment' });
    }

    if (existing.rows[0].status === 'completed') {
      return res.json({ status: 'already_confirmed', message: 'Registration already confirmed' });
    }

    // Verify payment with Stripe
    if (process.env.STRIPE_SECRET_KEY && !sessionId.startsWith('free_')) {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status !== 'paid') {
        return res.status(400).json({ error: 'Payment not completed' });
      }

      // Parse cart data from metadata
      const { userId, tournamentId, discountCode } = session.metadata;
      const cartData = JSON.parse(session.metadata.cartData);

      // Load tournament for email
      const tournament = await tournamentQueries.findById(tournamentId);

      // Get discount data if applicable
      let discountData = null;
      if (discountCode) {
        discountData = await discountQueries.findByCode(discountCode);
      }

      // Create all registrations
      const registrationIds = await createRegistrationsFromCart(
        userId, tournamentId, cartData.competitors,
        existing.rows[0].id, sessionId, discountData
      );

      // Deduct credits from Event Director (1 per competitor)
      if (tournament.created_by) {
        const competitorCount = cartData.competitors.length;
        const deductResult = await creditQueries.deductForRegistration(
          tournament.created_by, competitorCount, tournamentId,
          registrationIds || [],
          `Registration: ${cartData.competitors.map(c => c.name).join(', ')} for ${tournament.name}`
        );
        if (!deductResult.success) {
          console.warn('Credit deduction failed (registrations already created):', deductResult.error);
        }
      }

      // Mark payment as completed
      await pool.query(
        `UPDATE payment_transactions SET status = 'completed', completed_at = NOW()
         WHERE stripe_session_id = $1`,
        [sessionId]
      );

      // Send confirmation email
      const user = await userQueries.findById(userId);
      try {
        await sendRegistrationConfirmationEmail(
          user.email, tournament, cartData.competitors,
          cartData.total, cartData.discountAmount, sessionId
        );
      } catch (emailErr) {
        console.warn('Failed to send confirmation email:', emailErr.message);
      }

      // If coach registration, create waivers for competitors with guardian emails
      try {
        const coachMembership = await pool.query(
          `SELECT id FROM tournament_members
           WHERE user_id = $1 AND tournament_id = $2 AND role = 'coach' AND status = 'approved'`,
          [userId, tournamentId]
        );
        if (coachMembership.rows.length > 0 && registrationIds && registrationIds.length > 0) {
          const { createWaiversForRegistration } = require('./waiverController');
          await createWaiversForRegistration(registrationIds, userId, tournamentId);
        }
      } catch (waiverErr) {
        console.warn('Waiver creation failed:', waiverErr.message);
      }

      // Notify tournament director of new registration(s)
      if (tournament && tournament.created_by) {
        try {
          for (const comp of cartData.competitors) {
            await notificationQueries.create({
              recipientId: tournament.created_by,
              tournamentId,
              type: 'new_registration',
              payload: {
                competitorName: comp.name,
                eventCount: comp.events ? comp.events.length : 0,
                amountPaid: comp.subtotal || 0,
              },
            });
          }
        } catch (notifErr) {
          console.warn('Failed to create registration notification:', notifErr.message);
        }
      }

      res.json({
        status: 'confirmed',
        message: 'Registration confirmed! Check your email for details.',
      });
    } else {
      // Non-Stripe or free confirmation
      res.json({ status: 'confirmed', message: 'Registration confirmed' });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/registrations/my
 * Get logged-in user's registrations (read-only).
 */
async function getMyRegistrations(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT r.*, t.name AS tournament_name, t.date AS tournament_date,
              t.location AS tournament_location,
              cp.first_name AS profile_first_name, cp.last_name AS profile_last_name,
              pt.amount_total AS payment_amount, pt.status AS payment_status_detail,
              pt.stripe_session_id AS payment_session_id,
              COALESCE(
                json_agg(
                  json_build_object(
                    'eventId', re.event_id,
                    'eventName', te.name,
                    'eventType', te.event_type,
                    'isPrimary', re.is_primary,
                    'price', re.price
                  )
                ) FILTER (WHERE re.id IS NOT NULL),
                '[]'
              ) AS events
       FROM registrations r
       LEFT JOIN tournaments t ON t.id = r.tournament_id
       LEFT JOIN competitor_profiles cp ON cp.id = r.profile_id
       LEFT JOIN payment_transactions pt ON pt.id = r.payment_transaction_id
       LEFT JOIN registration_events re ON re.registration_id = r.id
       LEFT JOIN tournament_events te ON te.id = re.event_id
       WHERE r.user_id = $1 AND r.status != 'cancelled'
       GROUP BY r.id, t.name, t.date, t.location, cp.first_name, cp.last_name,
                pt.amount_total, pt.status, pt.stripe_session_id
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );

    // Also get registrations for profiles owned by this user
    const profileRegs = await pool.query(
      `SELECT r.*, t.name AS tournament_name, t.date AS tournament_date,
              t.location AS tournament_location,
              cp.first_name AS profile_first_name, cp.last_name AS profile_last_name,
              pt.amount_total AS payment_amount, pt.status AS payment_status_detail,
              pt.stripe_session_id AS payment_session_id,
              COALESCE(
                json_agg(
                  json_build_object(
                    'eventId', re.event_id,
                    'eventName', te.name,
                    'eventType', te.event_type,
                    'isPrimary', re.is_primary,
                    'price', re.price
                  )
                ) FILTER (WHERE re.id IS NOT NULL),
                '[]'
              ) AS events
       FROM registrations r
       JOIN competitor_profiles cp ON cp.id = r.profile_id AND cp.user_id = $1
       LEFT JOIN tournaments t ON t.id = r.tournament_id
       LEFT JOIN payment_transactions pt ON pt.id = r.payment_transaction_id
       LEFT JOIN registration_events re ON re.registration_id = r.id
       LEFT JOIN tournament_events te ON te.id = re.event_id
       WHERE r.user_id != $1 AND r.status != 'cancelled'
       GROUP BY r.id, t.name, t.date, t.location, cp.first_name, cp.last_name,
                pt.amount_total, pt.status, pt.stripe_session_id
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );

    const allRegs = [...result.rows, ...profileRegs.rows];

    // Deduplicate by id
    const seen = new Set();
    const registrations = allRegs.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    res.json({ registrations });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/registrations/pay-later
 * Validate cart and create registrations with payment_status='unpaid'.
 * Only allowed when the tournament has allowPayLater enabled.
 */
async function payLater(req, res, next) {
  try {
    const { tournamentId, competitors, discountCode } = req.body;

    if (!tournamentId || !Array.isArray(competitors) || competitors.length === 0) {
      return res.status(400).json({ error: 'Tournament ID and at least one competitor are required' });
    }

    // Load tournament
    const tournament = await tournamentQueries.findByIdWithEvents(tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Verify allowPayLater is enabled
    const regSettings = tournament.registration_settings || {};
    if (!regSettings.allowPayLater) {
      return res.status(403).json({ error: 'Pay-later registration is not enabled for this tournament.' });
    }

    // Registration deadline enforcement
    if (tournament.registration_deadline) {
      const rawDl = tournament.registration_deadline;
      const deadline = new Date(typeof rawDl === 'string' && rawDl.length === 10 ? rawDl + 'T23:59:59' : rawDl);
      if (new Date() > deadline) {
        return res.status(400).json({
          error: 'Registration for this tournament has closed.',
          code: 'REGISTRATION_CLOSED',
        });
      }
    }

    // Credit check: ensure Event Director has enough credits
    if (tournament.created_by) {
      const directorBalance = await creditQueries.getBalance(tournament.created_by);
      if (directorBalance < competitors.length) {
        return res.status(402).json({
          error: 'Registration is currently unavailable. Please contact the event organizer.',
          code: 'INSUFFICIENT_CREDITS',
        });
      }
    }

    // Check for active pricing period
    const PricingPeriodQueries = require('../db/queries/pricingPeriods');
    const activePeriod = await PricingPeriodQueries.getActivePeriod(tournamentId);

    const basePrice = activePeriod
      ? parseFloat(activePeriod.base_event_price)
      : (parseFloat(tournament.base_event_price) || 75);
    const addonPrice = activePeriod
      ? parseFloat(activePeriod.addon_event_price)
      : (parseFloat(tournament.addon_event_price) || 25);
    const eventMap = new Map(tournament.events.map(e => [e.id, e]));

    // Validate cart and calculate server-side pricing
    let cartTotal = 0;
    const validatedCompetitors = [];

    for (const comp of competitors) {
      const profile = await profileQueries.findById(comp.profileId);
      if (!profile || profile.user_id !== req.user.id) {
        return res.status(400).json({ error: `Invalid profile: ${comp.profileId}` });
      }

      const validatedEvents = [];
      let competitorSubtotal = 0;

      for (let i = 0; i < comp.events.length; i++) {
        const eventId = comp.events[i].eventId;
        const event = eventMap.get(eventId);
        if (!event) {
          return res.status(400).json({ error: `Event not found: ${eventId}` });
        }

        // Duplicate registration check
        const existingReg = await pool.query(
          `SELECT re.id FROM registration_events re
           JOIN registrations r ON r.id = re.registration_id
           WHERE r.tournament_id = $1 AND r.profile_id = $2 AND re.event_id = $3
             AND r.status != 'cancelled'`,
          [tournamentId, comp.profileId, eventId]
        );
        if (existingReg.rows.length > 0) {
          return res.status(400).json({
            error: `${profile.first_name} ${profile.last_name} is already registered for ${event.name}`,
          });
        }

        // Prerequisite check
        if (event.prerequisite_event_id) {
          const prereqSelected = comp.events.some(e => e.eventId === event.prerequisite_event_id);
          if (!prereqSelected) {
            const prereqReg = await pool.query(
              `SELECT re.id FROM registration_events re
               JOIN registrations r ON r.id = re.registration_id
               WHERE r.tournament_id = $1 AND r.profile_id = $2 AND re.event_id = $3
                 AND r.status != 'cancelled'`,
              [tournamentId, comp.profileId, event.prerequisite_event_id]
            );
            if (prereqReg.rows.length === 0) {
              const prereqEvent = eventMap.get(event.prerequisite_event_id);
              const prereqName = prereqEvent ? prereqEvent.name : 'the prerequisite event';
              return res.status(400).json({
                error: `${event.name} requires registration in ${prereqName} first.`,
                code: 'PREREQUISITE_MISSING',
              });
            }
          }
        }

        // Capacity check
        if (event.max_competitors) {
          const currentCount = await tournamentQueries.getEventRegistrationCount(eventId);
          if (currentCount >= event.max_competitors) {
            return res.status(400).json({
              error: `${event.name} is full (${event.max_competitors}/${event.max_competitors} spots taken).`,
              code: 'EVENT_FULL',
            });
          }
        }

        const isPrimary = i === 0;
        const eventBasePrice = event.price_override !== null ? parseFloat(event.price_override) : basePrice;
        const eventAddonPrice = event.addon_price_override !== null ? parseFloat(event.addon_price_override) : addonPrice;
        const price = isPrimary ? eventBasePrice : eventAddonPrice;

        validatedEvents.push({ eventId, name: event.name, isPrimary, price });
        competitorSubtotal += price;
      }

      validatedCompetitors.push({
        profileId: comp.profileId,
        name: `${profile.first_name} ${profile.last_name}`,
        events: validatedEvents,
        subtotal: competitorSubtotal,
      });
      cartTotal += competitorSubtotal;
    }

    // Validate discount code if provided
    let discountData = null;
    let discountAmount = 0;
    if (discountCode) {
      const discountResult = await discountQueries.validate(discountCode, tournamentId);
      if (!discountResult.valid) {
        return res.status(400).json({ error: discountResult.error });
      }
      discountData = discountResult.discount;
      if (discountData.type === 'percentage') {
        discountAmount = Math.round(cartTotal * (parseFloat(discountData.value) / 100) * 100) / 100;
      } else {
        discountAmount = Math.min(parseFloat(discountData.value), cartTotal);
      }
    }

    const finalTotal = Math.max(0, cartTotal - discountAmount);

    // Create registrations with payment_status='unpaid'
    const regIds = await createRegistrationsFromCartUnpaid(
      req.user.id, tournamentId, validatedCompetitors, discountData, finalTotal
    );

    // Deduct credits from Event Director
    if (tournament.created_by) {
      await creditQueries.deductForRegistration(
        tournament.created_by, validatedCompetitors.length, tournamentId,
        regIds || [],
        `Registration (pay later): ${validatedCompetitors.map(c => c.name).join(', ')} for ${tournament.name}`
      );
    }

    // Notify tournament director
    if (tournament.created_by) {
      try {
        for (const comp of validatedCompetitors) {
          await notificationQueries.create({
            recipientId: tournament.created_by,
            tournamentId,
            type: 'new_registration',
            payload: {
              competitorName: comp.name,
              eventCount: comp.events.length,
              amountPaid: 0,
              paymentStatus: 'unpaid',
            },
          });
        }
      } catch (notifErr) {
        console.warn('Failed to create pay-later notification:', notifErr.message);
      }
    }

    return res.json({
      status: 'outstanding',
      message: 'Registration confirmed. Payment is outstanding.',
      registrationIds: regIds,
      total: finalTotal,
      discountAmount,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Helper: Create registration records from validated cart data.
 */
async function createRegistrationsFromCart(
  userId, tournamentId, competitors, paymentTransactionId, stripeSessionId, discountData
) {
  const client = await pool.connect();
  const registrationIds = [];
  try {
    await client.query('BEGIN');

    for (const comp of competitors) {
      // Create registration
      const regResult = await client.query(
        `INSERT INTO registrations
          (tournament_id, user_id, profile_id, registered_by, payment_status,
           amount_paid, total_due, payment_transaction_id, stripe_session_id, status)
         VALUES ($1, $2, $3, $4, 'paid', $5, $5, $6, $7, 'active')
         RETURNING *`,
        [
          tournamentId, userId, comp.profileId, userId,
          comp.subtotal, paymentTransactionId, stripeSessionId,
        ]
      );
      const registration = regResult.rows[0];
      registrationIds.push(registration.id);

      // Load profile for division assignment
      const profile = await client.query(
        'SELECT * FROM competitor_profiles WHERE id = $1',
        [comp.profileId]
      );

      // Load tournament date for age calculation
      const tournamentRow = await client.query(
        'SELECT date FROM tournaments WHERE id = $1',
        [tournamentId]
      );
      const tournamentDate = tournamentRow.rows[0]?.date;

      // Create registration events with auto-division assignment
      for (let i = 0; i < comp.events.length; i++) {
        const evt = comp.events[i];

        // Try auto-division assignment
        let divisionName = null;
        if (profile.rows[0]) {
          const eventRow = await client.query(
            'SELECT criteria_templates, is_event_type FROM tournament_events WHERE id = $1',
            [evt.eventId]
          );
          const eventData = eventRow.rows[0];
          if (eventData?.is_event_type && eventData?.criteria_templates) {
            const templates = typeof eventData.criteria_templates === 'string'
              ? JSON.parse(eventData.criteria_templates)
              : eventData.criteria_templates;
            divisionName = assignDivision(profile.rows[0], templates, tournamentDate);
          }
        }

        await client.query(
          `INSERT INTO registration_events
            (registration_id, event_id, is_primary, price, selection_order, assigned_division)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (registration_id, event_id) DO NOTHING`,
          [registration.id, evt.eventId, evt.isPrimary, evt.price, i, divisionName]
        );
      }
    }

    // Increment discount code usage if applicable
    if (discountData?.id) {
      await client.query(
        'UPDATE discount_codes SET times_used = times_used + 1 WHERE id = $1',
        [discountData.id]
      );
    }

    await client.query('COMMIT');
    return registrationIds;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Helper: Create registration records with payment_status='unpaid' (pay-later flow).
 */
async function createRegistrationsFromCartUnpaid(
  userId, tournamentId, competitors, discountData, totalDue
) {
  const client = await pool.connect();
  const registrationIds = [];
  try {
    await client.query('BEGIN');

    for (const comp of competitors) {
      const regResult = await client.query(
        `INSERT INTO registrations
          (tournament_id, user_id, profile_id, registered_by, payment_status,
           amount_paid, total_due, status)
         VALUES ($1, $2, $3, $4, 'unpaid', 0, $5, 'active')
         RETURNING *`,
        [tournamentId, userId, comp.profileId, userId, comp.subtotal]
      );
      const registration = regResult.rows[0];
      registrationIds.push(registration.id);

      // Load profile for division assignment
      const profile = await client.query(
        'SELECT * FROM competitor_profiles WHERE id = $1',
        [comp.profileId]
      );

      // Load tournament date for age calculation
      const tournamentRow = await client.query(
        'SELECT date FROM tournaments WHERE id = $1',
        [tournamentId]
      );
      const tournamentDate = tournamentRow.rows[0]?.date;

      for (let i = 0; i < comp.events.length; i++) {
        const evt = comp.events[i];

        let divisionName = null;
        if (profile.rows[0]) {
          const eventRow = await client.query(
            'SELECT criteria_templates, is_event_type FROM tournament_events WHERE id = $1',
            [evt.eventId]
          );
          const eventData = eventRow.rows[0];
          if (eventData?.is_event_type && eventData?.criteria_templates) {
            const templates = typeof eventData.criteria_templates === 'string'
              ? JSON.parse(eventData.criteria_templates)
              : eventData.criteria_templates;
            divisionName = assignDivision(profile.rows[0], templates, tournamentDate);
          }
        }

        await client.query(
          `INSERT INTO registration_events
            (registration_id, event_id, is_primary, price, selection_order, assigned_division)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (registration_id, event_id) DO NOTHING`,
          [registration.id, evt.eventId, evt.isPrimary, evt.price, i, divisionName]
        );
      }
    }

    if (discountData?.id) {
      await client.query(
        'UPDATE discount_codes SET times_used = times_used + 1 WHERE id = $1',
        [discountData.id]
      );
    }

    await client.query('COMMIT');
    return registrationIds;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * GET /api/registrations/my/:id
 * Get a single registration owned by the current user (for badge page).
 */
async function getMyRegistration(req, res, next) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT r.id, r.user_id, r.status, r.tournament_id,
              t.name AS tournament_name, t.date AS tournament_date,
              cp.first_name, cp.last_name
       FROM registrations r
       LEFT JOIN tournaments t ON t.id = r.tournament_id
       LEFT JOIN competitor_profiles cp ON cp.id = r.profile_id
       WHERE r.id = $1`,
      [id]
    );
    const reg = result.rows[0];
    if (!reg) return res.status(404).json({ error: 'Registration not found' });
    if (reg.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (reg.status === 'cancelled') return res.status(403).json({ error: 'Registration is cancelled' });
    res.json({ registration: reg });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/registrations/my/:id/qr
 * Return a QR code PNG for competitor check-in.
 */
async function getMyRegistrationQR(req, res, next) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, user_id, status FROM registrations WHERE id = $1',
      [id]
    );
    const reg = result.rows[0];
    if (!reg) return res.status(404).json({ error: 'Registration not found' });
    if (reg.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (reg.status === 'cancelled') return res.status(403).json({ error: 'Registration is cancelled' });

    const QRCode = require('qrcode');
    const origin = process.env.APP_URL || 'https://www.taikaiapp.com';
    const checkInUrl = `${origin}/checkin?registrationId=${encodeURIComponent(reg.id)}`;

    const png = await QRCode.toBuffer(checkInUrl, {
      width: 200,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    });

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'private, max-age=3600');
    res.send(png);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  registerCompetitor,
  registerInstructor,
  registerClub,
  getRegistrations,
  activateRegistration,
  checkout,
  confirmPayment,
  payLater,
  getMyRegistrations,
  getMyRegistration,
  getMyRegistrationQR,
};
