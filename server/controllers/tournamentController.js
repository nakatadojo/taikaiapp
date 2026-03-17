const tournamentQueries = require('../db/queries/tournaments');
const userQueries = require('../db/queries/users');
const pool = require('../db/pool');
const storage = require('../config/storage');
const { sendTournamentPublishedEmail } = require('../email');

// ── Public Endpoints ─────────────────────────────────────────────────────────

/**
 * GET /api/tournaments
 * List all tournaments (public — legacy compatibility).
 */
async function getTournaments(req, res, next) {
  try {
    const allTournaments = await tournamentQueries.getAll();
    const userRoles = req.user?.roles || [];
    const isAdmin = userRoles.includes('admin') || userRoles.includes('super_admin');
    const tournaments = isAdmin ? allTournaments : allTournaments.filter(t => t.published);
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
 * Get a single tournament with events.
 * Public callers (unauthenticated or non-owners) only see published tournaments.
 * The tournament owner and super_admins can see unpublished drafts.
 */
async function getTournament(req, res, next) {
  try {
    const tournament = await tournamentQueries.findByIdWithEvents(req.params.id);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (!tournament.published) {
      // Allow the owner and super_admins to view their own draft
      const userId = req.user?.id;
      const userRoles = req.user?.roles || [];
      const isSuperAdmin = userRoles.includes('super_admin');
      const isOwner = userId && tournament.created_by === userId;
      if (!isOwner && !isSuperAdmin) {
        return res.status(404).json({ error: 'Tournament not found' });
      }
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

    // Apply active pricing period — same logic used by checkout/pay-later
    const PricingPeriodQueries = require('../db/queries/pricingPeriods');
    const activePeriod = await PricingPeriodQueries.getActivePeriod(tournamentId);
    let baseEventPrice = parseFloat(result.tournament.base_event_price) || 75;
    let addonEventPrice = parseFloat(result.tournament.addon_event_price) || 25;
    if (activePeriod) {
      baseEventPrice = parseFloat(activePeriod.base_event_price) || baseEventPrice;
      addonEventPrice = parseFloat(activePeriod.addon_event_price) || addonEventPrice;
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

    // Mark events already registered and apply period-adjusted prices
    const events = result.events.map(e => ({
      ...e,
      alreadyRegistered: alreadyRegistered.has(e.id),
      // Re-apply pricing with period override (base query used raw tournament prices)
      basePrice: e.price_override != null ? parseFloat(e.price_override) : baseEventPrice,
      addonPrice: e.addon_price_override != null ? parseFloat(e.addon_price_override) : addonEventPrice,
    }));

    res.json({
      events,
      tournament: {
        id: result.tournament.id,
        name: result.tournament.name,
        date: result.tournament.date,
        location: result.tournament.location,
        baseEventPrice,
        addonEventPrice,
        activePricingPeriod: activePeriod ? activePeriod.name : null,
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
 * Create a tournament (tournament owner or admin).
 */
async function createTournament(req, res, next) {
  try {
    const {
      name, date, location, registrationOpen, baseEventPrice, addonEventPrice,
      slug, description, city, state, venueName, venueAddress,
      published, organizationName, contactEmail, registrationDeadline,
      sanctioningBody, collectTshirtSizes, timezone, currency, weightUnit,
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
      sanctioningBody, collectTshirtSizes, timezone,
      currency, weight_unit: weightUnit,
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
 * Update a tournament (must own).
 */
async function updateTournament(req, res, next) {
  try {
    // Check ownership
    const owned = await tournamentQueries.isOwnedBy(req.params.id, req.user.id);
    if (!owned) {
      return res.status(403).json({ error: 'You do not own this tournament' });
    }

    const {
      name, date, location, registrationOpen, baseEventPrice, addonEventPrice,
      slug, description, city, state, venueName, venueAddress,
      published, organizationName, contactEmail, registrationDeadline,
      sanctioningBody, collectTshirtSizes, registrationSettings, timezone,
      currency, weightUnit, publicSiteConfig,
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
    if (sanctioningBody !== undefined) updates.sanctioning_body = sanctioningBody;
    if (collectTshirtSizes !== undefined) updates.collect_tshirt_sizes = collectTshirtSizes;
    if (timezone !== undefined) updates.timezone = timezone;
    if (currency !== undefined) updates.currency = currency;
    if (weightUnit !== undefined) updates.weight_unit = weightUnit;
    if (publicSiteConfig !== undefined) {
      if (typeof publicSiteConfig !== 'object' || publicSiteConfig === null) {
        return res.status(400).json({ error: 'publicSiteConfig must be an object' });
      }
      updates.public_site_config = JSON.stringify(publicSiteConfig);
    }
    if (registrationSettings !== undefined) {
      // Validate structure
      if (typeof registrationSettings !== 'object' || registrationSettings === null) {
        return res.status(400).json({ error: 'registrationSettings must be an object' });
      }
      updates.registration_settings = JSON.stringify(registrationSettings);
    }

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
    // Check ownership
    const owned = await tournamentQueries.isOwnedBy(req.params.id, req.user.id);
    if (!owned) {
      return res.status(403).json({ error: 'You do not own this tournament' });
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
    // Check ownership
    const owned = await tournamentQueries.isOwnedBy(req.params.id, req.user.id);
    if (!owned) {
      return res.status(403).json({ error: 'You do not own this tournament' });
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

// ── Event Endpoints ─────────────────────────────────────────────────────────

/**
 * POST /api/tournaments/:id/events
 * Create an event for a tournament (must own).
 */
async function createEvent(req, res, next) {
  try {
    const {
      name, eventType, division, gender,
      ageMin, ageMax, rankMin, rankMax,
      priceOverride, addonPriceOverride, maxCompetitors,
      isDefault, teamSize, description,
    } = req.body;

    const event = await tournamentQueries.createEvent({
      tournamentId: req.params.id,
      name, eventType, division, gender,
      ageMin, ageMax, rankMin, rankMax,
      priceOverride, addonPriceOverride, maxCompetitors,
      isDefault, teamSize, description,
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
    const {
      name, eventType, division, gender,
      ageMin, ageMax, rankMin, rankMax,
      priceOverride, addonPriceOverride, maxCompetitors,
      isDefault, teamSize, description,
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
    if (isDefault !== undefined) updates.is_default = isDefault;
    if (teamSize !== undefined) updates.team_size = teamSize;
    if (description !== undefined) updates.description = description;

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
async function deleteTournament(req, res, next) {
  try {
    // Admins and super_admins can delete any tournament; owners can delete their own
    const userRoles = req.user.roles || [];
    const isAdmin = userRoles.includes('admin') || userRoles.includes('super_admin');
    if (!isAdmin) {
      const owned = await tournamentQueries.isOwnedBy(req.params.id, req.user.id);
      if (!owned) {
        return res.status(403).json({ error: 'You do not own this tournament' });
      }
    }

    const deleted = await tournamentQueries.deleteTournament(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    res.json({ message: 'Tournament deleted' });
  } catch (err) {
    next(err);
  }
}

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
 * POST /api/tournaments/:id/sync
 * Bulk sync events from admin localStorage to DB.
 */
async function syncEvents(req, res, next) {
  try {
    // Check ownership
    const owned = await tournamentQueries.isOwnedBy(req.params.id, req.user.id);
    if (!owned) {
      return res.status(403).json({ error: 'You do not own this tournament' });
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

/**
 * GET /api/tournaments/:id/registrations
 * Director-facing: list all registrants for a tournament they own.
 */
async function getRegistrants(req, res, next) {
  try {
    // Check ownership
    const owned = await tournamentQueries.isOwnedBy(req.params.id, req.user.id);
    if (!owned) {
      return res.status(403).json({ error: 'You do not own this tournament' });
    }

    const { rows } = await pool.query(
      `SELECT
         r.id AS registration_id,
         r.status,
         r.payment_status,
         r.amount_paid,
         r.tshirt_size,
         r.created_at AS registered_at,
         cp.first_name,
         cp.last_name,
         cp.date_of_birth,
         cp.gender,
         cp.belt_rank,
         cp.experience_level,
         cp.academy_name,
         u.email,
         COALESCE(
           json_agg(
             json_build_object(
               'eventId', te.id,
               'eventName', te.name,
               'eventType', te.event_type,
               'isPrimary', re.is_primary,
               'price', re.price
             )
             ORDER BY re.selection_order
           ) FILTER (WHERE te.id IS NOT NULL),
           '[]'
         ) AS events
       FROM registrations r
       JOIN users u ON u.id = r.user_id
       LEFT JOIN competitor_profiles cp ON cp.id = r.profile_id
       LEFT JOIN registration_events re ON re.registration_id = r.id
       LEFT JOIN tournament_events te ON te.id = re.event_id
       WHERE r.tournament_id = $1 AND r.status != 'cancelled'
       GROUP BY r.id, cp.first_name, cp.last_name, cp.date_of_birth,
                cp.gender, cp.belt_rank, cp.experience_level, cp.academy_name,
                u.email
       ORDER BY r.created_at DESC`,
      [req.params.id]
    );

    // Summary stats
    const totalCompetitors = rows.length;
    const totalRevenue = rows.reduce((sum, r) => sum + parseFloat(r.amount_paid || 0), 0);

    // Event breakdown
    const eventCounts = {};
    for (const reg of rows) {
      for (const evt of reg.events) {
        if (evt.eventName) {
          eventCounts[evt.eventName] = (eventCounts[evt.eventName] || 0) + 1;
        }
      }
    }

    res.json({
      registrants: rows,
      summary: {
        totalCompetitors,
        totalRevenue,
        eventCounts,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tournaments/director/stats
 * Aggregate stats for the logged-in Event Director's dashboard.
 */
async function getDirectorStats(req, res, next) {
  try {
    const directorId = req.user.id;
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM tournaments WHERE created_by = $1) AS total_tournaments,
        (SELECT COUNT(*) FROM registrations r
         JOIN tournaments t ON t.id = r.tournament_id
         WHERE t.created_by = $1 AND r.status != 'cancelled') AS total_registrants,
        (SELECT COALESCE(SUM(r.amount_paid), 0) FROM registrations r
         JOIN tournaments t ON t.id = r.tournament_id
         WHERE t.created_by = $1 AND r.payment_status = 'paid') AS total_revenue,
        (SELECT COUNT(*) FROM tournaments WHERE created_by = $1 AND published = true) AS published_count
    `, [directorId]);

    // Recent registrations (last 7 days)
    const recent = await pool.query(`
      SELECT r.id, r.created_at, r.amount_paid, r.status, r.payment_status,
             cp.first_name, cp.last_name, t.name AS tournament_name
      FROM registrations r
      JOIN tournaments t ON t.id = r.tournament_id
      LEFT JOIN competitor_profiles cp ON cp.id = r.profile_id
      WHERE t.created_by = $1 AND r.status != 'cancelled'
      ORDER BY r.created_at DESC
      LIMIT 5
    `, [directorId]);

    // Next upcoming tournament
    const upcoming = await pool.query(`
      SELECT id, name, date, slug
      FROM tournaments
      WHERE created_by = $1 AND date >= CURRENT_DATE AND published = true
      ORDER BY date ASC
      LIMIT 1
    `, [directorId]);

    res.json({
      stats: {
        totalTournaments: parseInt(rows[0].total_tournaments),
        totalRegistrants: parseInt(rows[0].total_registrants),
        totalRevenue: parseFloat(rows[0].total_revenue),
        publishedCount: parseInt(rows[0].published_count),
      },
      recentRegistrations: recent.rows,
      nextTournament: upcoming.rows[0] || null,
    });
  } catch (err) { next(err); }
}

/**
 * POST /api/tournaments/:id/clone
 * Clone a tournament (must own the original).
 */
async function cloneTournament(req, res, next) {
  try {
    // Check ownership of the source tournament
    const owned = await tournamentQueries.isOwnedBy(req.params.id, req.user.id);
    if (!owned) {
      return res.status(403).json({ error: 'You do not own this tournament' });
    }

    const cloned = await tournamentQueries.cloneTournament(req.params.id, req.user.id);
    res.status(201).json({ tournament: cloned });
  } catch (err) {
    if (err.message === 'Tournament not found') {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    next(err);
  }
}

// ── Director Competitors / Clubs ─────────────────────────────────────────────

/**
 * GET /api/tournaments/:id/competitors
 * Returns the director_competitors JSONB array.
 */
async function getCompetitors(req, res, next) {
  try {
    const competitors = await tournamentQueries.getDirectorCompetitors(req.params.id);
    res.json({ competitors });
  } catch (err) { next(err); }
}

/**
 * POST /api/tournaments/:id/competitors/sync
 * Replaces the director_competitors JSONB array (full replace).
 */
async function syncCompetitors(req, res, next) {
  try {
    const { competitors } = req.body;
    await tournamentQueries.syncDirectorCompetitors(req.params.id, competitors || []);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

/**
 * GET /api/tournaments/:id/clubs
 * Returns the director_clubs JSONB array.
 */
async function getClubs(req, res, next) {
  try {
    const clubs = await tournamentQueries.getDirectorClubs(req.params.id);
    res.json({ clubs });
  } catch (err) { next(err); }
}

/**
 * POST /api/tournaments/:id/clubs/sync
 * Replaces the director_clubs JSONB array (full replace).
 */
async function syncClubs(req, res, next) {
  try {
    const { clubs } = req.body;
    await tournamentQueries.syncDirectorClubs(req.params.id, clubs || []);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

/**
 * POST /api/tournaments/:id/competitors/:competitorId/checkin
 * Mark a director-added competitor as checked in.
 */
async function checkInDirectorCompetitor(req, res, next) {
  try {

    const competitors = await tournamentQueries.getDirectorCompetitors(req.params.id);
    const idx = competitors.findIndex(c => String(c.id) === String(req.params.competitorId));
    if (idx === -1) return res.status(404).json({ error: 'Competitor not found' });

    competitors[idx] = {
      ...competitors[idx],
      checkedIn: true,
      checkedInAt: new Date().toISOString(),
    };
    await tournamentQueries.syncDirectorCompetitors(req.params.id, competitors);
    res.json({ competitor: competitors[idx] });
  } catch (err) { next(err); }
}

/**
 * DELETE /api/tournaments/:id/competitors/:competitorId/checkin
 * Undo check-in for a director-added competitor.
 */
async function undoCheckInDirectorCompetitor(req, res, next) {
  try {

    const competitors = await tournamentQueries.getDirectorCompetitors(req.params.id);
    const idx = competitors.findIndex(c => String(c.id) === String(req.params.competitorId));
    if (idx === -1) return res.status(404).json({ error: 'Competitor not found' });

    competitors[idx] = {
      ...competitors[idx],
      checkedIn: false,
      checkedInAt: null,
    };
    await tournamentQueries.syncDirectorCompetitors(req.params.id, competitors);
    res.json({ competitor: competitors[idx] });
  } catch (err) { next(err); }
}

module.exports = {
  getTournaments,
  getDirectory,
  getTournament,
  getTournamentBySlug,
  getEligibleEvents,
  getMyTournaments,
  getDirectorStats,
  createTournament,
  updateTournament,
  publishTournament,
  uploadCoverImage,
  createEvent,
  updateEvent,
  deleteTournament,
  deleteEvent,
  syncEvents,
  getRegistrants,
  cloneTournament,
  getCompetitors,
  syncCompetitors,
  getClubs,
  syncClubs,
  checkInDirectorCompetitor,
  undoCheckInDirectorCompetitor,
  getOfficials,
  syncOfficials,
  getStaff,
  syncStaff,
  getInstructors,
  syncInstructors,
};

// ── Director Officials / Staff / Instructors ──────────────────────────────────

async function getOfficials(req, res, next) {
  try {
    const officials = await tournamentQueries.getDirectorOfficials(req.params.id);
    res.json({ officials });
  } catch (err) { next(err); }
}

async function syncOfficials(req, res, next) {
  try {
    const owned = await tournamentQueries.isOwnedBy(req.params.id, req.user.id);
    if (!owned) return res.status(403).json({ error: 'You do not own this tournament' });
    const { officials } = req.body;
    await tournamentQueries.syncDirectorOfficials(req.params.id, officials || []);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function getStaff(req, res, next) {
  try {
    const staff = await tournamentQueries.getDirectorStaff(req.params.id);
    res.json({ staff });
  } catch (err) { next(err); }
}

async function syncStaff(req, res, next) {
  try {
    const owned = await tournamentQueries.isOwnedBy(req.params.id, req.user.id);
    if (!owned) return res.status(403).json({ error: 'You do not own this tournament' });
    const { staff } = req.body;
    await tournamentQueries.syncDirectorStaff(req.params.id, staff || []);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function getInstructors(req, res, next) {
  try {
    const instructors = await tournamentQueries.getDirectorInstructors(req.params.id);
    res.json({ instructors });
  } catch (err) { next(err); }
}

async function syncInstructors(req, res, next) {
  try {
    const owned = await tournamentQueries.isOwnedBy(req.params.id, req.user.id);
    if (!owned) return res.status(403).json({ error: 'You do not own this tournament' });
    const { instructors } = req.body;
    await tournamentQueries.syncDirectorInstructors(req.params.id, instructors || []);
    res.json({ ok: true });
  } catch (err) { next(err); }
}
