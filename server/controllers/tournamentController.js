const tournamentQueries = require('../db/queries/tournaments');

// ── Public Endpoints ─────────────────────────────────────────────────────────

/**
 * GET /api/tournaments
 * List all tournaments (public).
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

// ── Admin Endpoints ──────────────────────────────────────────────────────────

/**
 * POST /api/admin/tournaments
 * Create a tournament (admin only).
 */
async function createTournament(req, res, next) {
  try {
    const { name, date, location, registrationOpen, baseEventPrice, addonEventPrice } = req.body;
    const tournament = await tournamentQueries.create({
      name, date, location, registrationOpen, baseEventPrice, addonEventPrice,
      createdBy: req.user.id,
    });
    res.status(201).json({ tournament });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/admin/tournaments/:id
 * Update a tournament (admin only).
 */
async function updateTournament(req, res, next) {
  try {
    const { name, date, location, registrationOpen, baseEventPrice, addonEventPrice } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (date !== undefined) updates.date = date;
    if (location !== undefined) updates.location = location;
    if (registrationOpen !== undefined) updates.registration_open = registrationOpen;
    if (baseEventPrice !== undefined) updates.base_event_price = baseEventPrice;
    if (addonEventPrice !== undefined) updates.addon_event_price = addonEventPrice;

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
 * POST /api/admin/tournaments/:id/events
 * Create an event for a tournament (admin only).
 */
async function createEvent(req, res, next) {
  try {
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
 * PUT /api/admin/tournaments/:id/events/:eventId
 * Update an event (admin only).
 */
async function updateEvent(req, res, next) {
  try {
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
 * DELETE /api/admin/tournaments/:id/events/:eventId
 * Delete an event (admin only).
 */
async function deleteEvent(req, res, next) {
  try {
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
 * POST /api/admin/tournaments/:id/sync
 * Bulk sync events from admin localStorage to DB.
 */
async function syncEvents(req, res, next) {
  try {
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
  getTournament,
  getEligibleEvents,
  createTournament,
  updateTournament,
  createEvent,
  updateEvent,
  deleteEvent,
  syncEvents,
};
