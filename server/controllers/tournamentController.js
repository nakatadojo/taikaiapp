const tournamentQueries = require('../db/queries/tournaments');
const userQueries = require('../db/queries/users');
const storage = require('../config/storage');
const { sendTournamentPublishedEmail } = require('../email');

// ── Public Endpoints ─────────────────────────────────────────────────────────

/**
 * GET /api/tournaments
 * List all tournaments (public — legacy compatibility).
 */
async function getTournaments(req, res, next) {
  try {
    const tournaments = await tournamentQueries.getAll();
    res.json({ tournaments });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tournaments/directory
 * Published tournaments for the public directory.
 */
async function getDirectory(req, res, next) {
  try {
    const { search, sort, includePast } = req.query;
    const tournaments = await tournamentQueries.getDirectory({
      search,
      sort,
      includePast: includePast === 'true',
    });
    res.json({ tournaments });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tournaments/:id
 * Get a single tournament with events (public).
 */
async function getTournament(req, res, next) {
  try {
    const tournament = await tournamentQueries.findByIdWithEvents(req.params.id);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    res.json({ tournament });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tournaments/slug/:slug
 * Get a single tournament by slug (public page).
 */
async function getTournamentBySlug(req, res, next) {
  try {
    const tournament = await tournamentQueries.findBySlug(req.params.slug);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    // Only return published tournaments to public
    if (!tournament.published) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    res.json({ tournament });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tournaments/:id/events/eligible/:profileId
 * Get eligible events for a competitor profile (requires auth).
 */
async function getEligibleEvents(req, res, next) {
  try {
    const { id: tournamentId, profileId } = req.params;

    // Load profile and verify ownership
    const profileQueries = require('../db/queries/profiles');
    const profile = await profileQueries.findById(profileId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    if (profile.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only view events for your own profiles' });
    }

    const result = await tournamentQueries.getEligibleEvents(tournamentId, profile);
    if (!result.tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Check for existing registrations for this profile in this tournament
    const pool = require('../db/pool');
    const existingRegs = await pool.query(
      `SELECT re.event_id FROM registration_events re
       JOIN registrations r ON r.id = re.registration_id
       WHERE r.tournament_id = $1 AND r.profile_id = $2 AND r.status != 'cancelled'`,
      [tournamentId, profileId]
    );
    const alreadyRegistered = new Set(existingRegs.rows.map(r => r.event_id));

    // Mark events that are already registered
    const events = result.events.map(e => ({
      ...e,
      alreadyRegistered: alreadyRegistered.has(e.id),
    }));

    res.json({
      events,
      tournament: {
        id: result.tournament.id,
        name: result.tournament.name,
        date: result.tournament.date,
        location: result.tournament.location,
        baseEventPrice: parseFloat(result.tournament.base_event_price) || 75,
        addonEventPrice: parseFloat(result.tournament.addon_event_price) || 25,
      },
      profileAge: result.age,
    });
  } catch (err) {
    next(err);
  }
}

// ── Director Endpoints ──────────────────────────────────────────────────────

/**
 * GET /api/tournaments/director/mine
 * Get tournaments owned by the logged-in Event Director.
 */
async function getMyTournaments(req, res, next) {
  try {
    const tournaments = await tournamentQueries.getByDirector(req.user.id);
    res.json({ tournaments });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/tournaments
 * Create a tournament (event_director or admin).
 */
async function createTournament(req, res, next) {
  try {
    const {
      name, date, location, registrationOpen, baseEventPrice, addonEventPrice,
      slug, description, city, state, venueName, venueAddress,
      published, organizationName, contactEmail, registrationDeadline,
    } = req.body;

    // If slug provided, validate uniqueness
    if (slug) {
      const existingSlug = await tournamentQueries.findBySlug(slug);
      if (existingSlug) {
        return res.status(409).json({ error: 'This URL slug is already taken' });
      }
    }

    const tournament = await tournamentQueries.create({
      name, date, location, registrationOpen, baseEventPrice, addonEventPrice,
      createdBy: req.user.id,
      slug, description, city, state, venueName, venueAddress,
      published, organizationName, contactEmail, registrationDeadline,
    });
    res.status(201).json({ tournament });
  } catch (err) {
    if (err.code === '23505' && err.constraint && err.constraint.includes('slug')) {
      return res.status(409).json({ error: 'This URL slug is already taken' });
    }
    next(err);
  }
}

/**
 * PUT /api/tournaments/:id
 * Update a tournament (must own or be super_admin).
 */
async function updateTournament(req, res, next) {
  try {
    // Check ownership (unless super_admin)
    if (!req.user.roles.includes('super_admin')) {
      const owned = await tournamentQueries.isOwnedBy(req.params.id, req.user.id);
      if (!owned) {
        return res.status(403).json({ error: 'You do not own this tournament' });
      }
    }

    const {
      name, date, location, registrationOpen, baseEventPrice, addonEventPrice,
      slug, description, city, state, venueName, venueAddress,
      published, organizationName, contactEmail, registrationDeadline,
    } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (date !== undefined) updates.date = date;
    if (location !== undefined) updates.location = location;
    if (registrationOpen !== undefined) updates.registration_open = registrationOpen;
    if (baseEventPrice !== undefined) updates.base_event_price = baseEventPrice;
    if (addonEventPrice !== undefined) updates.addon_event_price = addonEventPrice;
    if (description !== undefined) updates.description = description;
    if (city !== undefined) updates.city = city;
    if (state !== undefined) updates.state = state;
    if (venueName !== undefined) updates.venue_name = venueName;
    if (venueAddress !== undefined) updates.venue_address = venueAddress;
    if (published !== undefined) updates.published = published;
    if (organizationName !== undefined) updates.organization_name = organizationName;
    if (contactEmail !== undefined) updates.contact_email = contactEmail;
    if (registrationDeadline !== undefined) updates.registration_deadline = registrationDeadline;

    // Handle slug update with uniqueness check
    if (slug !== undefined) {
      const uniqueSlug = await tournamentQueries.generateUniqueSlug(slug, req.params.id);
      updates.slug = uniqueSlug;
    }

    const tournament = await tournamentQueries.update(req.params.id, updates);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    res.json({ tournament });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/tournaments/:id/publish
 * Publish or unpublish a tournament.
 */
async function publishTournament(req, res, next) {
  try {
    // Check ownership (unless super_admin)
    if (!req.user.roles.includes('super_admin')) {
      const owned = await tournamentQueries.isOwnedBy(req.params.id, req.user.id);
      if (!owned) {
        return res.status(403).json({ error: 'You do not own this tournament' });
      }
    }

    const { published } = req.body;
    if (typeof published !== 'boolean') {
      return res.status(400).json({ error: 'published must be a boolean' });
    }

    const tournament = await tournamentQueries.update(req.params.id, { published });
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Send email to director when tournament is published
    if (published) {
      try {
        const director = await userQueries.findById(req.user.id);
        if (director) {
          await sendTournamentPublishedEmail(director.email, tournament);
        }
      } catch (emailErr) {
        console.warn('Failed to send tournament published email:', emailErr.message);
      }
    }

    res.json({ tournament, message: published ? 'Tournament published' : 'Tournament unpublished' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/tournaments/:id/cover-image
 * Upload cover image for a tournament.
 */
async function uploadCoverImage(req, res, next) {
  try {
    // Check ownership (unless super_admin)
    if (!req.user.roles.includes('super_admin')) {
      const owned = await tournamentQueries.isOwnedBy(req.params.id, req.user.id);
      if (!owned) {
        return res.status(403).json({ error: 'You do not own this tournament' });
      }
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Process image with sharp (resize to max 1200x630 for social sharing aspect ratio)
    const sharp = require('sharp');
    const processed = await sharp(req.file.buffer)
      .resize(1200, 630, { fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer();

    const url = await storage.uploadFile(processed, 'cover.webp', 'image/webp');

    const tournament = await tournamentQueries.update(req.params.id, { cover_image_url: url });
    res.json({ tournament, coverImageUrl: url });
  } catch (err) {
    next(err);
  }
}

// ── Admin Endpoints (Legacy — retained for backward compat) ─────────────────

/**
 * POST /api/tournaments/:id/events
 * Create an event for a tournament.
 */
async function createEvent(req, res, next) {
  try {
    // Check ownership (unless super_admin or admin)
    if (!req.user.roles.includes('super_admin') && !req.user.roles.includes('admin')) {
      const owned = await tournamentQueries.isOwnedBy(req.params.id, req.user.id);
      if (!owned) {
        return res.status(403).json({ error: 'You do not own this tournament' });
      }
    }

    const {
      name, eventType, division, gender,
      ageMin, ageMax, rankMin, rankMax,
      priceOverride, addonPriceOverride, maxCompetitors,
    } = req.body;

    const event = await tournamentQueries.createEvent({
      tournamentId: req.params.id,
      name, eventType, division, gender,
      ageMin, ageMax, rankMin, rankMax,
      priceOverride, addonPriceOverride, maxCompetitors,
    });
    res.status(201).json({ event });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/tournaments/:id/events/:eventId
 * Update an event.
 */
async function updateEvent(req, res, next) {
  try {
    // Check ownership
    if (!req.user.roles.includes('super_admin') && !req.user.roles.includes('admin')) {
      const owned = await tournamentQueries.isOwnedBy(req.params.id, req.user.id);
      if (!owned) {
        return res.status(403).json({ error: 'You do not own this tournament' });
      }
    }

    const {
      name, eventType, division, gender,
      ageMin, ageMax, rankMin, rankMax,
      priceOverride, addonPriceOverride, maxCompetitors,
    } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (eventType !== undefined) updates.event_type = eventType;
    if (division !== undefined) updates.division = division;
    if (gender !== undefined) updates.gender = gender;
    if (ageMin !== undefined) updates.age_min = ageMin;
    if (ageMax !== undefined) updates.age_max = ageMax;
    if (rankMin !== undefined) updates.rank_min = rankMin;
    if (rankMax !== undefined) updates.rank_max = rankMax;
    if (priceOverride !== undefined) updates.price_override = priceOverride;
    if (addonPriceOverride !== undefined) updates.addon_price_override = addonPriceOverride;
    if (maxCompetitors !== undefined) updates.max_competitors = maxCompetitors;

    const event = await tournamentQueries.updateEvent(req.params.eventId, updates);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ event });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/tournaments/:id/events/:eventId
 * Delete an event.
 */
async function deleteEvent(req, res, next) {
  try {
    // Check ownership
    if (!req.user.roles.includes('super_admin') && !req.user.roles.includes('admin')) {
      const owned = await tournamentQueries.isOwnedBy(req.params.id, req.user.id);
      if (!owned) {
        return res.status(403).json({ error: 'You do not own this tournament' });
      }
    }

    const event = await tournamentQueries.deleteEvent(req.params.eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ message: 'Event deleted' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/tournaments/:id/sync
 * Bulk sync events from admin localStorage to DB.
 */
async function syncEvents(req, res, next) {
  try {
    // Check ownership
    if (!req.user.roles.includes('super_admin') && !req.user.roles.includes('admin')) {
      const owned = await tournamentQueries.isOwnedBy(req.params.id, req.user.id);
      if (!owned) {
        return res.status(403).json({ error: 'You do not own this tournament' });
      }
    }

    const { events } = req.body;
    if (!Array.isArray(events)) {
      return res.status(400).json({ error: 'Events must be an array' });
    }

    // Also update tournament details if provided
    const { name, date, location, registrationOpen, baseEventPrice, addonEventPrice } = req.body;
    if (name) {
      const updates = {};
      if (name !== undefined) updates.name = name;
      if (date !== undefined) updates.date = date;
      if (location !== undefined) updates.location = location;
      if (registrationOpen !== undefined) updates.registration_open = registrationOpen;
      if (baseEventPrice !== undefined) updates.base_event_price = baseEventPrice;
      if (addonEventPrice !== undefined) updates.addon_event_price = addonEventPrice;
      await tournamentQueries.update(req.params.id, updates);
    }

    const synced = await tournamentQueries.syncEvents(req.params.id, events);
    res.json({ message: `Synced ${synced.length} events`, events: synced });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getTournaments,
  getDirectory,
  getTournament,
  getTournamentBySlug,
  getEligibleEvents,
  getMyTournaments,
  createTournament,
  updateTournament,
  publishTournament,
  uploadCoverImage,
  createEvent,
  updateEvent,
  deleteEvent,
  syncEvents,
};
