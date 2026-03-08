/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                                                                           ║
 * ║                  KARATE TOURNAMENT MANAGEMENT SYSTEM                      ║
 * ║                            app.js - Main Logic                            ║
 * ║                                                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * 🚨 CRITICAL NOTICE TO ALL DEVELOPERS 🚨
 *
 * This codebase uses a COMPREHENSIVE ANNOTATION SYSTEM.
 * Every major section has detailed header comments explaining:
 *   - Data structures
 *   - Workflows
 *   - Known bugs
 *   - Routes/navigation
 *   - TODO items
 *
 * 📖 READ THIS FIRST: /CODE_ANNOTATIONS.md
 *
 * ⚠️ BEFORE MAKING ANY CHANGES:
 * 1. Read the annotation header for the section you're modifying
 * 2. Check AUDIT_REPORT.md for related bugs
 * 3. Understand the data flow (see CODE_ANNOTATIONS.md)
 *
 * ✅ AFTER MAKING CHANGES:
 * 1. UPDATE the annotation header (MANDATORY!)
 * 2. Update "Last Updated" date
 * 3. Add new bugs to "KNOWN ISSUES"
 * 4. Remove fixed bugs from "KNOWN ISSUES"
 * 5. Update data structures if changed
 *
 * 🔍 TO FIND ANNOTATIONS:
 * Search for: ═══════════════════════════════════════════════════════════════════════════
 *
 * 📚 DOCUMENTATION:
 * - CODE_ANNOTATIONS.md - Annotation system guide
 * - AUDIT_REPORT.md - 23 critical bugs documented
 * - SCHEMA_ANALYSIS.md - Data structure deep dive
 * - FINDINGS.md - Analysis summary
 *
 * 🎯 CRITICAL SECTIONS (Read annotations before touching!):
 * - Division Management (Line ~1260) - Most buggy, complex data flow
 * - Database Class (Line ~50) - All data flows through here
 * - Operator Scoreboard (Line ~2400) - Real-time sync, memory leaks
 *
 * Last Full Audit: 2026-02-13
 * Version: 1.0
 */

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DATABASE CLASS - LocalStorage Abstraction Layer
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * PURPOSE: Provides CRUD operations for localStorage-backed data persistence
 *
 * DATA TABLES (localStorage keys):
 * ┌──────────────────┬──────────┬────────────────────────────────────────────────────┐
 * │ Table Name       │ Type     │ Structure                                          │
 * ├──────────────────┼──────────┼────────────────────────────────────────────────────┤
 * │ competitors      │ Array    │ [{id, firstName, lastName, dateOfBirth, events}]   │
 * │                  │          │   - dateOfBirth: ISO date string (NEW 2026-02-13)  │
 * │                  │          │   - events: [eventId1, eventId2] (NEW 2026-02-13)  │
 * │                  │          │   - teamCode: string, team code if team event       │
 * │                  │          │   - teamName: string, team name (NEW 2026-02-14)   │
 * │                  │          │   - age: deprecated, use dateOfBirth               │
 * │ instructors      │ Array    │ [{id, firstName, lastName, club, ...}]             │
 * │ clubs            │ Array    │ [{id, name, country, logo, createdAt}]             │
 * │                  │          │   - country: optional (NEW 2026-02-13)             │
 * │ templates        │ Array    │ [{id, name, criteria}]                             │
 * │ mats             │ Array    │ [{id, name, active}]                               │
 * │ matches          │ Array    │ [{id, matId, redId, blueId, ...}]                  │
 * │ tournaments      │ Array    │ [{id, name, date, ageCalculationMethod, logo}]     │
 * │                  │          │   - ageCalculationMethod: 'event-date' or          │
 * │                  │          │     'registration-date' (NEW 2026-02-13)           │
 * │ eventTypes       │ Array    │ [{id, name, description, price, isDefault}]        │
 * │                  │          │   - price: float, registration fee                 │
 * │                  │          │   - isDefault: boolean, base event (NEW 2026-02-14)│
 * │                  │          │   - description: optional text description         │
 * │                  │          │   - REMOVED: scoreboardType, bracketType (moved to │
 * │                  │          │     division level) (2026-02-14)                   │
 * │ divisions        │ Object   │ {eventId: {criteria, generated, ...}}              │
 * │ matSchedule      │ Object   │ {matId: [{time, division, eventId}]}               │
 * │ matScoreboards   │ Object   │ {matId: {redScore, blueScore, ...}}                │
 * │ brackets         │ Object   │ {bracketId: {type, scoreboardType, matches, ...}}  │
 * │                  │          │   - scoreboardType: optional override (NEW)        │
 * │ teams            │ Object   │ {teamCode: {name, eventId, members, ...}}          │
 * │                  │          │   - code: unique 6-char code (TEAM-ABC123)         │
 * │                  │          │   - name: team name entered by captain             │
 * │                  │          │   - eventId: which event the team is for           │
 * │                  │          │   - maxSize: 2 or 3 members                        │
 * │                  │          │   - captainName: first registrant's name           │
 * │                  │          │   - members: [competitorId1, ...] (NEW 2026-02-14) │
 * └──────────────────┴──────────┴────────────────────────────────────────────────────┘
 *
 * ⚠️ CRITICAL ISSUES:
 * 1. NO TOURNAMENT SCOPING - All data is global, not per-tournament
 * 2. divisions has INCONSISTENT schema (see audit report)
 * 3. No quota checking - can exceed localStorage limits
 * 4. No error handling for JSON parse failures
 *
 * 📝 NOTE TO FUTURE DEVELOPERS:
 * When making changes to this class or data structures:
 * 1. Update this header comment with new tables/fields
 * 2. Update the audit report if fixing known bugs
 * 3. Add migration code if changing data structure
 * 4. Test with corrupted localStorage data
 *
 * 🆕 RECENT CHANGES (2026-02-13):
 * - Added dateOfBirth field to competitors (replaces age)
 * - Added events array to competitors (multi-event registration)
 * - Added ageCalculationMethod to tournaments (event-date vs registration-date)
 * - Added price field to eventTypes
 * - Added country field to clubs
 * - Added scoreboardType override to brackets
 *
 * Last Updated: 2026-02-13
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Monotonic ID generator: guarantees unique IDs even with rapid consecutive calls
let _lastGeneratedId = 0;
function generateUniqueId() {
    let newId = Date.now();
    if (newId <= _lastGeneratedId) {
        newId = _lastGeneratedId + 1;
    }
    _lastGeneratedId = newId;
    return newId;
}

// Active tournament — declared early so scoped-storage helpers can reference it.
let currentTournamentId = null;

// ── Tournament-Scoped Storage ───────────────────────────────────────────────
// Keys that should be isolated per tournament to prevent cross-tournament data corruption.
const _SCOPED_KEYS = new Set([
    'competitors', 'instructors', 'clubs', 'templates', 'mats', 'matches',
    'eventTypes', 'divisions', 'matSchedule', 'matScoreboards', 'brackets',
    'teams', 'results', 'scoreboardConfig', 'scoreboardSettings', 'scoreboardConfigs',
    'certificateTemplate', 'certificateConfig', 'publicSiteConfig',
    'scoreboard-state', 'scoreEditLog', 'operatorSidesSwapped',
]);

// Keys that must remain global (shared across all tournaments)
// 'tournaments' — the list of all tournaments
// 'mat-update-trigger' — cross-tab signaling
// 'scheduleSettings_*' / 'matSchedule_*' — already tournament-scoped

function _scopedKey(key) {
    if (currentTournamentId && _SCOPED_KEYS.has(key)) {
        return `t_${currentTournamentId}_${key}`;
    }
    return key;
}

/**
 * Strip large/redundant fields from a competitor object before storing it inside
 * bracket matches (redCorner, blueCorner, winner).  The photo is the main culprit —
 * a single base64 photo can be 100 KB+ and gets duplicated into dozens of match slots.
 * The photo is always available from the master competitors list for display purposes.
 */
function slimCompetitor(c) {
    if (!c) return c;
    const { photo, clubLogo, ...slim } = c;
    return slim;
}

/**
 * Re-attach photo and clubLogo to a slim competitor object by looking up the
 * master competitors list.  Call this when reading competitors OUT of bracket
 * match slots for display (operator, scoreboard, etc.).
 */
function rehydrateCompetitor(c) {
    if (!c) return c;
    if (c.photo && c.clubLogo) return c; // already full
    const allCompetitors = db.load('competitors');
    const master = allCompetitors.find(m => m.id === c.id);
    if (!master) return c;
    return { ...c, photo: master.photo || null, clubLogo: master.clubLogo || null };
}

/**
 * Central save function for the brackets map.
 * Slims every bracket before writing so base64 photos are never stored in match slots.
 */
function saveBrackets(brackets) {
    const slimmed = {};
    Object.keys(brackets).forEach(id => {
        slimmed[id] = slimBracketForStorage(JSON.parse(JSON.stringify(brackets[id])));
    });
    localStorage.setItem(_scopedKey('brackets'), JSON.stringify(slimmed));
}

/**
 * Walk every match slot in a bracket and slim every competitor reference in-place.
 * Called before writing brackets to localStorage.
 */
function slimBracketForStorage(bracket) {
    const slimSlot = (m) => {
        if (!m) return;
        if (m.redCorner)  m.redCorner  = slimCompetitor(m.redCorner);
        if (m.blueCorner) m.blueCorner = slimCompetitor(m.blueCorner);
        if (m.winner)     m.winner     = slimCompetitor(m.winner);
    };
    (bracket.matches   || []).forEach(slimSlot);
    (bracket.winners   || []).forEach(slimSlot);
    (bracket.losers    || []).forEach(slimSlot);
    (bracket.repechageA|| []).forEach(slimSlot);
    (bracket.repechageB|| []).forEach(slimSlot);
    if (bracket.finals) slimSlot(bracket.finals);
    if (bracket.reset)  slimSlot(bracket.reset);
    // Also slim the top-level competitors array
    if (bracket.competitors) bracket.competitors = bracket.competitors.map(slimCompetitor);
    // Pool-play pools
    (bracket.pools || []).forEach(pool => {
        (pool.matches || []).forEach(slimSlot);
        if (pool.competitors) pool.competitors = pool.competitors.map(slimCompetitor);
    });
    // Kata rounds (kata-flags / kata-points) — slim each performance's competitor
    (bracket.rounds || []).forEach(round => {
        (round.performances || []).forEach(perf => {
            if (perf.competitor) perf.competitor = slimCompetitor(perf.competitor);
        });
    });
    // Ranking-list entries — slim each entry's competitor
    (bracket.entries || []).forEach(entry => {
        if (entry.competitor) entry.competitor = slimCompetitor(entry.competitor);
    });
    return bracket;
}

// Database Storage using localStorage
class Database {
    constructor() {
        // Don't init until tournament is selected
    }

    init() {
        // Array-based tables
        const arrayTables = ['competitors', 'instructors', 'clubs', 'templates', 'mats', 'matches', 'tournaments', 'eventTypes'];
        for (const table of arrayTables) {
            const key = (table === 'tournaments') ? table : _scopedKey(table);
            if (!localStorage.getItem(key)) {
                if (table === 'mats') {
                    localStorage.setItem(key, JSON.stringify([
                        { id: 1, name: 'Mat 1', active: true },
                        { id: 2, name: 'Mat 2', active: true }
                    ]));
                } else {
                    localStorage.setItem(key, JSON.stringify([]));
                }
            }
        }
        // Object-based tables
        const objectTables = ['divisions', 'matSchedule', 'matScoreboards'];
        for (const table of objectTables) {
            if (!localStorage.getItem(_scopedKey(table))) {
                localStorage.setItem(_scopedKey(table), JSON.stringify({}));
            }
        }
    }

    save(table, data) {
        const key = (table === 'tournaments') ? table : _scopedKey(table);
        localStorage.setItem(key, JSON.stringify(data));
        // Backward compat: also write to global key for scoreboards/TV displays
        if (currentTournamentId && (table === 'brackets' || table === 'matSchedule' || table === 'matScoreboards' || table === 'scoreboard-state' || table === 'mats')) {
            localStorage.setItem(table, JSON.stringify(data));
        }
    }

    load(table) {
        const key = (table === 'tournaments') ? table : _scopedKey(table);
        const data = localStorage.getItem(key);
        const objectTables = ['divisions', 'matSchedule', 'matScoreboards'];
        if (objectTables.includes(table)) {
            return JSON.parse(data || '{}');
        }
        return JSON.parse(data || '[]');
    }

    add(table, record) {
        const data = this.load(table);
        record.id = generateUniqueId();
        data.push(record);
        this.save(table, data);
        return record;
    }

    update(table, id, updatedRecord) {
        const data = this.load(table);
        const index = data.findIndex(item => item.id === id);
        if (index !== -1) {
            data[index] = { ...data[index], ...updatedRecord };
            this.save(table, data);
            return data[index];
        }
        return null;
    }

    delete(table, id) {
        const data = this.load(table);
        const filtered = data.filter(item => item.id !== id);
        this.save(table, filtered);
    }

    clear(table) {
        const objectTables = ['divisions', 'matSchedule', 'matScoreboards'];
        if (objectTables.includes(table)) {
            this.save(table, {});
        } else {
            this.save(table, []);
        }
    }
}

const db = new Database();

// One-time migration: move unscoped localStorage data under tournament prefix
function _migrateUnscopedData() {
    if (!currentTournamentId) return;
    const keysToMigrate = [..._SCOPED_KEYS];
    for (const key of keysToMigrate) {
        const scopedKey = `t_${currentTournamentId}_${key}`;
        // Only migrate if scoped key doesn't exist yet but unscoped does
        if (!localStorage.getItem(scopedKey) && localStorage.getItem(key)) {
            const data = localStorage.getItem(key);
            if (data && data !== '[]' && data !== '{}' && data !== 'null') {
                try {
                    localStorage.setItem(scopedKey, data);
                    console.log(`[migration] Moved ${key} → ${scopedKey}`);
                } catch (e) {
                    // Quota exceeded — try to free space by removing old unscoped keys
                    console.warn(`[migration] Quota exceeded migrating ${key}, cleaning up stale data...`);
                    _cleanupLocalStorage();
                    try {
                        localStorage.setItem(scopedKey, data);
                    } catch (e2) {
                        console.warn(`[migration] Still cannot migrate ${key}, skipping`);
                    }
                }
            }
        }
    }
}

// Clean up stale/orphaned localStorage data to free space
function _cleanupLocalStorage() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        // Remove unscoped copies of scoped keys (old pre-migration data)
        if (_SCOPED_KEYS.has(key)) {
            keysToRemove.push(key);
        }
    }
    for (const key of keysToRemove) {
        localStorage.removeItem(key);
    }
    if (keysToRemove.length > 0) {
        console.log(`[cleanup] Removed ${keysToRemove.length} stale unscoped keys`);
    }
}

// Logo error handler
function handleLogoError(img) {
    const h1 = document.createElement('h1');
    h1.style.margin = '20px 0';
    h1.style.fontSize = '2em';
    h1.innerHTML = 'TAIKAI';
    img.parentNode.replaceChild(h1, img);
}

// Current template being edited
let currentTemplate = null;
let criteriaCounter = 0;

// ── Server Sync Helpers ──────────────────────────────────────────────────────
// Non-blocking debounced sync to persist localStorage data to the server.

const _syncDebounceTimers = {};

function _debouncedSync(key, fn, delayMs = 1500) {
    if (_syncDebounceTimers[key]) clearTimeout(_syncDebounceTimers[key]);
    _syncDebounceTimers[key] = setTimeout(() => {
        fn().catch(err => console.warn(`[sync] ${key} failed:`, err.message));
    }, delayMs);
}

function setSyncIndicator(state) {
    const el = document.getElementById('server-sync-indicator');
    if (!el) return;
    el.style.display = 'inline-flex';
    const dot = el.querySelector('.sync-dot');
    const label = el.querySelector('.sync-label');
    if (!dot || !label) return;
    dot.className = 'sync-dot';
    if (state === 'syncing') {
        dot.classList.add('sync-dot--syncing');
        label.textContent = 'Saving...';
    } else if (state === 'error') {
        dot.classList.add('sync-dot--error');
        label.textContent = 'Save failed';
        setTimeout(() => setSyncIndicator('ok'), 10000);
    } else {
        label.textContent = 'Saved';
    }
}

async function _syncScheduleToServer() {
    if (!currentTournamentId) return;
    const matSchedule = loadMatScheduleData();
    const scheduleSettings = getScheduleSettings();
    setSyncIndicator('syncing');
    try {
        const res = await fetch(`/api/tournaments/${currentTournamentId}/schedule/sync`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matSchedule, scheduleSettings }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setSyncIndicator('ok');
    } catch (err) {
        setSyncIndicator('error');
        throw err;
    }
}

async function _syncBracketsToServer() {
    if (!currentTournamentId) return;
    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
    setSyncIndicator('syncing');
    try {
        const res = await fetch(`/api/tournaments/${currentTournamentId}/brackets/sync`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ brackets }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setSyncIndicator('ok');
    } catch (err) {
        setSyncIndicator('error');
        throw err;
    }
}

async function _syncDivisionsToServer() {
    if (!currentTournamentId) return;
    const allDivisions = JSON.parse(localStorage.getItem(_scopedKey('divisions')) || '{}');
    const generatedDivisions = {};
    Object.keys(allDivisions).forEach(eventId => {
        if (allDivisions[eventId]?.generated) {
            generatedDivisions[eventId] = {
                generated: allDivisions[eventId].generated,
                updatedAt: allDivisions[eventId].updatedAt,
            };
        }
    });
    setSyncIndicator('syncing');
    try {
        const res = await fetch(`/api/tournaments/${currentTournamentId}/divisions/sync`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ generatedDivisions }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setSyncIndicator('ok');
    } catch (err) {
        setSyncIndicator('error');
        throw err;
    }
}

async function _syncTemplateToServer(eventId, templates) {
    if (!currentTournamentId || !eventId) return;
    const res = await fetch(
        `/api/tournaments/${currentTournamentId}/events/${eventId}/templates/sync`,
        {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ criteriaTemplates: templates }),
        }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

async function _syncTeamsToServer() {
    if (!currentTournamentId) return;
    const teams = JSON.parse(localStorage.getItem(_scopedKey('teams')) || '{}');
    setSyncIndicator('syncing');
    try {
        const res = await fetch(`/api/tournaments/${currentTournamentId}/teams/sync`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teams }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setSyncIndicator('ok');
    } catch (err) {
        setSyncIndicator('error');
        throw err;
    }
}

async function _syncJudgeVotesToServer() {
    if (!currentTournamentId) return;
    const judgeVoteLog = JSON.parse(localStorage.getItem(_scopedKey('judgeVoteLog')) || '[]');
    if (judgeVoteLog.length === 0) return;
    try {
        const res = await fetch(`/api/tournaments/${currentTournamentId}/judge-votes/sync`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ votes: judgeVoteLog }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // Clear the log after successful sync
        localStorage.setItem(_scopedKey('judgeVoteLog'), '[]');
        console.log('[Judge Analytics] Synced', judgeVoteLog.length, 'votes to server');
    } catch (err) {
        console.warn('[Judge Analytics] Sync failed:', err.message);
        // Don't clear — will retry on next debounce
    }
}

async function _loadTeamsFromServer() {
    if (!currentTournamentId) return;
    try {
        const res = await fetch(`/api/tournaments/${currentTournamentId}/teams`, {
            credentials: 'include',
        });
        if (!res.ok) return; // silently skip if server not available
        const data = await res.json();
        if (data.teams && Object.keys(data.teams).length > 0) {
            const localTeams = JSON.parse(localStorage.getItem(_scopedKey('teams')) || '{}');
            // Only overwrite if local is empty (server is source of truth for initial load)
            if (Object.keys(localTeams).length === 0) {
                localStorage.setItem(_scopedKey('teams'), JSON.stringify(data.teams));
                console.log(`[sync] Loaded ${Object.keys(data.teams).length} team(s) from server`);
            }
        }
    } catch (err) {
        console.warn('[sync] Failed to load teams from server:', err.message);
    }
}

// Ordered rank list for grouped belt-range matching (WKF/AAU)
const RANK_ORDER = [
    '10th kyu', '9th kyu', '8th kyu', '7th kyu', '6th kyu', '5th kyu',
    '4th kyu', '3rd kyu', '2nd kyu', '1st kyu',
    '1st dan', '2nd dan', '3rd dan', '4th dan', '5th dan',
    '6th dan', '7th dan', '8th dan', '9th dan', '10th dan',
];

// ── Pricing Helpers ──────────────────────────────────────────────────────────

function getCurrentTournament() {
    const tournaments = db.load('tournaments');
    return tournaments.find(t => String(t.id) === String(currentTournamentId)) || null;
}

/**
 * Resolve the price for an event based on whether it's a primary or add-on selection.
 * Priority: event-level override > tournament-level default > hardcoded fallback.
 */
function getEventPrice(event, isAddOn, tournament) {
    const defaults = tournament?.pricing || { basePrice: 75.00, addOnPrice: 25.00 };
    if (isAddOn) {
        return event.addOnPrice != null ? event.addOnPrice : defaults.addOnPrice;
    }
    return event.basePrice != null ? event.basePrice : defaults.basePrice;
}

/**
 * Calculate full pricing breakdown for an ordered list of selected events.
 * Index 0 = primary event (base price), index 1+ = add-on events.
 */
function calculatePricingBreakdown(selectedEventIds, eventTypes, tournament) {
    const breakdown = [];
    let total = 0;
    selectedEventIds.forEach((eventId, index) => {
        const event = eventTypes.find(e => e.id === eventId);
        if (!event) return;
        const isAddOn = index > 0;
        const price = getEventPrice(event, isAddOn, tournament);
        breakdown.push({
            eventId: event.id,
            eventName: event.name,
            type: isAddOn ? 'addon' : 'primary',
            price: price
        });
        total += price;
    });
    return { breakdown, total };
}

// ── Payment Status Helpers ───────────────────────────────────────────────────

function getPaymentStatusBadge(status) {
    const colors = {
        paid:    { bg: 'rgba(39,174,96,0.15)', text: '#27ae60', label: 'Paid' },
        unpaid:  { bg: 'rgba(231,76,60,0.15)', text: '#e74c3c', label: 'Unpaid' },
        partial: { bg: 'rgba(243,156,18,0.15)', text: '#f39c12', label: 'Partial' },
        waived:  { bg: 'rgba(149,165,166,0.15)', text: '#95a5a6', label: 'Waived' },
    };
    const s = colors[status] || colors.unpaid;
    return `<span style="padding:2px 8px;border-radius:4px;font-size:12px;background:${s.bg};color:${s.text};font-weight:600;">${s.label}</span>`;
}

window.togglePaymentStatus = function(competitorId) {
    const competitors = db.load('competitors');
    const comp = competitors.find(c => c.id === competitorId);
    if (!comp) return;
    const cycle = ['unpaid', 'paid', 'partial', 'waived'];
    const idx = cycle.indexOf(comp.paymentStatus || 'unpaid');
    comp.paymentStatus = cycle[(idx + 1) % cycle.length];
    localStorage.setItem(_scopedKey('competitors'), JSON.stringify(competitors));
    loadCompetitors(true);
};

// ── Tournament-scoped data helpers ──────────────────────────────────────────

function getTournamentCompetitors(tournamentId = currentTournamentId) {
    if (!tournamentId) return [];
    const allCompetitors = db.load('competitors');
    return allCompetitors.filter(c => c.tournamentId === tournamentId);
}

function addTournamentCompetitor(competitor, tournamentId = currentTournamentId) {
    if (!tournamentId) {
        console.error('No tournament selected');
        return null;
    }
    competitor.tournamentId = tournamentId;
    return db.add('competitors', competitor);
}

function ensureTournamentSelected() {
    if (!currentTournamentId) {
        showMessage('⚠️ Please select a tournament first', 'error');
        // Highlight tournament selector
        const selector = document.getElementById('active-tournament');
        if (selector) {
            selector.style.border = '2px solid #ef4444';
            setTimeout(() => {
                selector.style.border = '';
            }, 2000);
        }
        return false;
    }
    return true;
}
let currentTournamentLogoData = null;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TOURNAMENT MANAGEMENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ROUTE: Dashboard → "Select Tournament" dropdown → New Tournament button
 *
 * FLOW:
 * 1. showTournamentForm() - Opens modal
 * 2. User fills form (name, date, location, logo)
 * 3. Form submission → Creates tournament → Saves to localStorage
 * 4. switchTournament() - Loads tournament data
 *
 * DATA STRUCTURE:
 * tournaments[] = [{
 *   id: timestamp,
 *   name: string,
 *   date: string,
 *   location: string,
 *   logo: base64 string (optional)
 * }]
 *
 * ⚠️ CRITICAL BUG: Tournament switching doesn't isolate data!
 * - All competitors, divisions, brackets are GLOBAL
 * - currentTournamentId is set but never used for data scoping
 * - Multiple tournaments will have data collisions
 *
 * 📝 TODO: Implement tournament-scoped data (prefix all keys with tournamentId)
 *
 * Last Updated: 2026-02-13
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SANCTIONING BODY DEFAULTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Provides WKF, AAU, and custom defaults for:
 * - Corner names (AKA/SHIRO vs RED/WHITE)
 * - Corner colors (WKF uses red/blue, AAU uses red/white)
 * - Age calculation method (WKF: Dec 31st, AAU: event date)
 *
 * Last Updated: 2026-02-14
 * ═══════════════════════════════════════════════════════════════════════════
 */

function getSanctioningBodyDefaults(sanctioningBody) {
    const defaults = {
        'wkf': {
            corner1Name: 'AKA',
            corner2Name: 'SHIRO',
            corner1Color: '#ff3b30', // Red
            corner2Color: '#0a84ff', // Blue
            ageCalculationMethod: 'wkf-standard',
            ageCalculationDescription: 'Age as of December 31st of competition year'
        },
        'aau': {
            corner1Name: 'RED',
            corner2Name: 'WHITE',
            corner1Color: '#ff3b30', // Red
            corner2Color: '#ffffff', // White
            ageCalculationMethod: 'aau-standard',
            ageCalculationDescription: 'Age on day of competition'
        },
        'custom': {
            corner1Name: 'RED',
            corner2Name: 'BLUE',
            corner1Color: '#ff3b30', // Red
            corner2Color: '#0a84ff', // Blue
            ageCalculationMethod: 'registration-date',
            ageCalculationDescription: 'Custom age calculation'
        }
    };

    return defaults[sanctioningBody] || defaults['custom'];
}

// Auto-update form fields when sanctioning body changes
function updateSanctioningBodyDefaults() {
    const sanctioningBody = document.getElementById('sanctioning-body').value;

    if (!sanctioningBody) return;

    const defaults = getSanctioningBodyDefaults(sanctioningBody);

    // Auto-select age calculation method
    document.getElementById('age-calculation-method').value = defaults.ageCalculationMethod;

    // Update hint text
    const hint = document.getElementById('age-calc-hint');
    if (hint) {
        if (sanctioningBody === 'wkf') {
            hint.textContent = 'WKF uses age as of December 31st of the competition year. Example: Tournament on March 15, 2026 → age calculated as of Dec 31, 2026.';
        } else if (sanctioningBody === 'aau') {
            hint.textContent = 'AAU uses age on the day of competition. Example: Tournament on March 15, 2026 → age calculated as of March 15, 2026.';
        } else {
            hint.textContent = 'Custom tournament - select your preferred age calculation method.';
        }
    }
}

// Tournament Management
function showTournamentForm() {
    document.getElementById('tournament-modal').classList.remove('hidden');
}

function hideTournamentForm() {
    document.getElementById('tournament-modal').classList.add('hidden');
    document.getElementById('tournament-form').reset();
    currentTournamentLogoData = null;
    document.getElementById('logo-preview').classList.add('hidden');
}

function switchTournament() {
    const select = document.getElementById('active-tournament');
    currentTournamentId = select.value || null;
    if (currentTournamentId) {
        _migrateUnscopedData();
        db.init();
        document.getElementById('main-nav').classList.remove('hidden');
        loadCompetitors();
        loadDashboard();
        _loadTeamsFromServer();
    } else {
        document.getElementById('main-nav').classList.add('hidden');
    }

    // Update the delete danger zone label so user knows which tournament is selected
    const nameEl = document.getElementById('delete-tournament-name');
    if (nameEl) {
        if (currentTournamentId) {
            const tournaments = db.load('tournaments');
            const t = tournaments.find(t => String(t.id) === String(currentTournamentId));
            nameEl.textContent = t ? `"${t.name}"` : '';
        } else {
            nameEl.textContent = '';
        }
    }
}

function clearLogo() {
    currentTournamentLogoData = null;
    document.getElementById('logo-preview').classList.add('hidden');
    document.getElementById('tournament-logo').value = '';
}

// Load tournament logo
document.getElementById('tournament-logo')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            currentTournamentLogoData = event.target.result;
            document.getElementById('logo-preview-img').src = currentTournamentLogoData;
            document.getElementById('logo-preview').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
});

// Tournament form submission
document.getElementById('tournament-form')?.addEventListener('submit', (e) => {
    e.preventDefault();

    const sanctioningBody = document.getElementById('sanctioning-body').value;
    const defaults = getSanctioningBodyDefaults(sanctioningBody);

    const tournament = {
        name: document.getElementById('tournament-name').value,
        date: document.getElementById('tournament-date').value,
        location: document.getElementById('tournament-location').value,
        sanctioningBody: sanctioningBody, // NEW: Store sanctioning body
        ageCalculationMethod: document.getElementById('age-calculation-method').value,
        logo: currentTournamentLogoData || null,
        // Store corner defaults from sanctioning body
        cornerDefaults: {
            corner1Name: defaults.corner1Name,
            corner2Name: defaults.corner2Name,
            corner1Color: defaults.corner1Color,
            corner2Color: defaults.corner2Color
        },
        // Registration pricing defaults
        pricing: {
            basePrice: parseFloat(document.getElementById('tournament-base-price')?.value) || 75.00,
            addOnPrice: parseFloat(document.getElementById('tournament-addon-price')?.value) || 25.00
        },
        createdAt: new Date().toISOString()
    };

    // Initialize tournaments array if needed
    if (!localStorage.getItem('tournaments')) {
        localStorage.setItem('tournaments', JSON.stringify([]));
    }

    const savedTournament = db.add('tournaments', tournament);
    loadTournamentSelector();

    // Auto-select the new tournament
    document.getElementById('active-tournament').value = savedTournament.id;
    currentTournamentId = savedTournament.id;
    document.getElementById('main-nav').classList.remove('hidden');

    // Auto-generate unified scoreboard config from sanctioning body
    autoGenerateScoreboardConfig(sanctioningBody);

    const bodyName = sanctioningBody === 'wkf' ? 'WKF' : sanctioningBody === 'aau' ? 'AAU' : 'Custom';
    showMessage(`Tournament created successfully with ${bodyName} rules! Scoreboard configuration auto-generated.`);
    hideTournamentForm();
});

function loadTournamentSelector() {
    const tournaments = db.load('tournaments');
    const select = document.getElementById('active-tournament');
    select.innerHTML = '<option value="">Select Tournament</option>';

    tournaments.forEach(tournament => {
        const option = document.createElement('option');
        option.value = tournament.id;
        option.textContent = `${tournament.name} - ${new Date(typeof tournament.date === 'string' && tournament.date.length === 10 ? tournament.date + 'T12:00:00' : tournament.date).toLocaleDateString()}`;
        select.appendChild(option);
    });
}

// Load tournaments on page load
loadTournamentSelector();

// Migration: Assign legacy competitors to current/first tournament
function migrateLegacyCompetitors() {
    const competitors = db.load('competitors');
    const tournaments = db.load('tournaments');

    if (tournaments.length === 0) return; // No tournaments to migrate to

    let migrated = 0;
    const targetTournamentId = currentTournamentId || tournaments[0].id;

    competitors.forEach(comp => {
        if (!comp.tournamentId) {
            comp.tournamentId = targetTournamentId;
            migrated++;
        }
    });

    if (migrated > 0) {
        localStorage.setItem(_scopedKey('competitors'), JSON.stringify(competitors));
        console.log(`Migrated ${migrated} legacy competitors to tournament ID: ${targetTournamentId}`);
    }
}

// Migration: Calculate pricing for legacy competitors that lack pricing data
function migrateLegacyPricing() {
    const competitors = db.load('competitors');
    const eventTypes = db.load('eventTypes');
    const tournament = getCurrentTournament();
    let migrated = 0;

    competitors.forEach(comp => {
        if (comp.events && comp.events.length > 0 && !comp.pricing) {
            comp.pricing = calculatePricingBreakdown(comp.events, eventTypes, tournament);
            comp.primaryEventId = comp.events[0] || null;
            comp.paymentStatus = comp.paymentStatus || 'unpaid';
            migrated++;
        }
        // Ensure paymentStatus exists even if pricing already set
        if (!comp.paymentStatus) {
            comp.paymentStatus = 'unpaid';
            migrated++;
        }
    });

    if (migrated > 0) {
        localStorage.setItem(_scopedKey('competitors'), JSON.stringify(competitors));
        console.log(`Migrated pricing data for ${migrated} competitors`);
    }
}

// Run migrations on page load
migrateLegacyCompetitors();
migrateLegacyPricing();

// Dashboard
function loadDashboard() {
    const allCompetitors = db.load('competitors');
    const events = db.load('eventTypes') || [];
    const divisions = db.load('divisions');
    const matches = db.load('matches');

    // Filter by current tournament
    const competitors = currentTournamentId
        ? allCompetitors.filter(c => c.tournamentId === currentTournamentId)
        : allCompetitors;

    document.getElementById('stat-competitors').textContent = competitors.length;
    document.getElementById('stat-events').textContent = events.length;

    // Count divisions across all event types
    let totalDivisions = 0;
    Object.values(divisions).forEach(eventData => {
        if (eventData && eventData.generated) {
            // New nested structure: { criteria, generated: { divisionName: [competitors] } }
            totalDivisions += Object.keys(eventData.generated).length;
        } else if (Array.isArray(eventData)) {
            // Legacy array structure
            totalDivisions += eventData.length;
        }
    });
    document.getElementById('stat-divisions').textContent = totalDivisions;
    document.getElementById('stat-matches').textContent = matches.length;

    // Financial summary
    let totalRevenue = 0;
    let paidCount = 0;
    let unpaidCount = 0;
    competitors.forEach(comp => {
        if (comp.pricing?.total) totalRevenue += comp.pricing.total;
        if (comp.paymentStatus === 'paid') paidCount++;
        else unpaidCount++;
    });
    const revenueEl = document.getElementById('stat-revenue');
    if (revenueEl) revenueEl.textContent = `$${totalRevenue.toFixed(2)}`;
    const paidEl = document.getElementById('stat-paid-count');
    if (paidEl) paidEl.textContent = paidCount;
    const unpaidEl = document.getElementById('stat-unpaid-count');
    if (unpaidEl) unpaidEl.textContent = unpaidCount;
}

// ═══════════════════════════════════════════════════════════════════════════
// MEDAL COUNT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════
//
// Estimates how many gold, silver, and bronze medals are needed based on
// division data. Works in two modes:
//   Mode 1 (Pre-generation): Simulates division building from templates
//   Mode 2 (Post-generation): Counts from actual generated divisions
// Automatically detects which mode to use per event.

/**
 * Pure medal math: returns medal counts for a given number of competitors.
 */
function getMedalsForCount(competitorCount) {
    if (competitorCount <= 1) return { gold: 0, silver: 0, bronze: 0 };
    if (competitorCount === 2) return { gold: 1, silver: 1, bronze: 0 };
    if (competitorCount === 3) return { gold: 1, silver: 1, bronze: 1 };
    return { gold: 1, silver: 1, bronze: 2 };
}

/**
 * Calculates medal counts across all events.
 * Returns { totals: {gold, silver, bronze}, events: [ {name, gold, silver, bronze, isTeam, teamSize, mode} ] }
 */
function calculateMedalCounts() {
    const divisions = db.load('divisions');
    const events = db.load('eventTypes') || [];
    const allCompetitors = db.load('competitors');
    const competitors = currentTournamentId
        ? allCompetitors.filter(c => c.tournamentId === currentTournamentId)
        : allCompetitors;

    // Get tournament settings for age calculation
    const tournaments = db.load('tournaments');
    const currentTournament = tournaments.find(t => t.id === currentTournamentId);
    const ageMethod = currentTournament?.ageCalculationMethod || 'aau-standard';
    const eventDate = currentTournament?.date || new Date().toISOString();

    const result = {
        totals: { gold: 0, silver: 0, bronze: 0 },
        events: []
    };

    events.forEach(event => {
        if (event.isDefault) return; // Skip base registration fee events

        const eventId = event.id;
        const eventData = divisions[eventId];
        const isTeam = event.teamSize > 1;
        const multiplier = isTeam ? event.teamSize : 1;

        let eventGold = 0;
        let eventSilver = 0;
        let eventBronze = 0;
        let mode = 'none';

        if (eventData && eventData.generated && Object.keys(eventData.generated).length > 0) {
            // MODE 2: Post-generation — use actual generated divisions
            mode = 'actual';
            Object.values(eventData.generated).forEach(compArray => {
                const count = Array.isArray(compArray) ? compArray.length : 0;
                const medals = getMedalsForCount(count);
                eventGold += medals.gold;
                eventSilver += medals.silver;
                eventBronze += medals.bronze;
            });
        } else if (eventData && eventData.templates && eventData.templates.length > 0) {
            // MODE 1: Pre-generation — simulate from templates
            mode = 'estimated';

            // Get competitors registered for this event
            const eventCompetitors = competitors.filter(c =>
                c.events && c.events.includes(eventId)
            );

            if (eventCompetitors.length > 0) {
                // Prepare competitors with calculated age for buildDivisions()
                const compsWithAge = eventCompetitors.map(comp => ({
                    ...comp,
                    age: comp.dateOfBirth
                        ? calculateAge(comp.dateOfBirth, ageMethod, eventDate)
                        : (comp.age != null ? comp.age : 0)
                }));

                eventData.templates.forEach(template => {
                    if (!template.criteria || template.criteria.length === 0) {
                        // No criteria = one division with all event competitors
                        const medals = getMedalsForCount(compsWithAge.length);
                        eventGold += medals.gold;
                        eventSilver += medals.silver;
                        eventBronze += medals.bronze;
                    } else {
                        // Reuse buildDivisions() to simulate the exact same splits
                        const simulated = buildDivisions(compsWithAge, template.criteria);
                        Object.values(simulated).forEach(compArray => {
                            const count = Array.isArray(compArray) ? compArray.length : 0;
                            const medals = getMedalsForCount(count);
                            eventGold += medals.gold;
                            eventSilver += medals.silver;
                            eventBronze += medals.bronze;
                        });
                    }
                });
            }
        }

        // Apply team multiplier
        eventGold *= multiplier;
        eventSilver *= multiplier;
        eventBronze *= multiplier;

        // Add to totals
        result.totals.gold += eventGold;
        result.totals.silver += eventSilver;
        result.totals.bronze += eventBronze;

        // Add per-event data (only if event has division config)
        if (mode !== 'none') {
            result.events.push({
                name: event.name,
                gold: eventGold,
                silver: eventSilver,
                bronze: eventBronze,
                total: eventGold + eventSilver + eventBronze,
                isTeam: isTeam,
                teamSize: event.teamSize,
                mode: mode
            });
        }
    });

    return result;
}

/**
 * Renders the medal count panel on the dashboard.
 */
function updateMedalCountDisplay() {
    const data = calculateMedalCounts();
    const grandTotal = data.totals.gold + data.totals.silver + data.totals.bronze;

    // Update totals
    document.getElementById('medal-total').textContent = grandTotal;
    document.getElementById('medal-gold').textContent = data.totals.gold;
    document.getElementById('medal-silver').textContent = data.totals.silver;
    document.getElementById('medal-bronze').textContent = data.totals.bronze;

    // Build per-event breakdown
    const container = document.getElementById('medal-event-breakdown');

    if (data.events.length === 0) {
        container.innerHTML = '<p class="medal-no-data">Add event types with division templates to see medal estimates.</p>';
        return;
    }

    let html = '<h3>Per-Event Breakdown</h3>';

    data.events.forEach(evt => {
        const teamTag = evt.isTeam
            ? `<span class="medal-event-tag team">Team &times;${evt.teamSize}</span>`
            : '';
        const modeTag = evt.mode === 'estimated'
            ? '<span class="medal-event-tag estimated">Estimated</span>'
            : '<span class="medal-event-tag actual">Actual</span>';

        html += `
            <div class="medal-event-row">
                <div class="medal-event-info">
                    <span class="medal-event-name">${evt.name}</span>
                    ${teamTag}
                    ${modeTag}
                </div>
                <div class="medal-event-counts">
                    <span class="gold" title="Gold">&#x1F947; ${evt.gold}</span>
                    <span class="silver" title="Silver">&#x1F948; ${evt.silver}</span>
                    <span class="bronze" title="Bronze">&#x1F949; ${evt.bronze}</span>
                    <span class="event-total" title="Total">&bull; ${evt.total}</span>
                </div>
            </div>`;
    });

    container.innerHTML = html;
}

function openMedalCountModal() {
    updateMedalCountDisplay();
    document.getElementById('medal-count-modal').classList.remove('hidden');
}

function closeMedalCountModal() {
    document.getElementById('medal-count-modal').classList.add('hidden');
}

// Navigation
document.querySelectorAll('.nav-btn, .nav-sub-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const view = btn.dataset.view;

        // Update active button (clear both nav-btn and nav-sub-btn active states)
        document.querySelectorAll('.nav-btn, .nav-sub-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Auto-expand settings children when a sub-item is clicked
        if (btn.classList.contains('nav-sub-btn')) {
            const toggle = document.getElementById('settings-toggle');
            const children = document.getElementById('settings-children');
            if (toggle && children) {
                toggle.classList.add('expanded');
                children.classList.add('expanded');
            }
        }

        // Update active view
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`${view}-view`).classList.add('active');

        // Load data for the view
        if (view === 'dashboard') loadDashboard();
        if (view === 'competitors') loadCompetitors();
        if (view === 'instructors') loadInstructors();
        if (view === 'clubs') loadClubs();
        if (view === 'events') {
            loadEventTypes();
            loadEventTypeSelector();
        }
        if (view === 'scoreboard-configs') {
            loadUnifiedScoreboardConfig();
        }
        if (view === 'divisions') {
            loadEventTypeSelector();
            loadTemplateSelector();
            loadDivisions();
        }
        if (view === 'brackets') {
            loadBrackets();
        }
        if (view === 'schedule') {
            displayMats();
            loadMatSchedule();
        }
        if (view === 'scoreboards') {
            loadMatScoreboards();
            loadScoreboardView();
        }
        if (view === 'public-site') {
            loadPublicSiteConfig();
        }
        if (view === 'results') {
            loadResults();
        }
        if (view === 'settings') {
            loadSettings();
        }
        if (view === 'settings-tournament-info') {
            loadTournamentInfoView();
        }
        if (view === 'settings-certificates') {
            loadCertificatesView();
        }
        if (view === 'academy') {
            loadAcademyView();
        }
        if (view === 'medical-incidents') {
            loadMedicalIncidents();
        }
        if (view === 'settings-sponsors') {
            loadSponsorsView();
        }
        if (view === 'settings-feedback') {
            loadFeedbackView();
        }
        if (view === 'judge-analytics') {
            loadJudgeAnalyticsView();
        }
    });
});

// Toggle settings nav expand/collapse
function toggleSettingsNav() {
    const toggle = document.getElementById('settings-toggle');
    const children = document.getElementById('settings-children');
    if (toggle && children) {
        toggle.classList.toggle('expanded');
        children.classList.toggle('expanded');
    }
}

// Navigation helper
function navigateTo(viewName) {
    const btn = document.querySelector(`[data-view="${viewName}"]`);
    if (btn) {
        btn.click();
    }
}

// Message Display
function showMessage(message, type = 'success') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;

    const main = document.querySelector('main');
    const firstView = main.querySelector('.view.active');
    firstView.insertBefore(messageDiv, firstView.firstChild);

    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

// Reusable image compression helper
function compressImage(dataUrl, maxWidth, maxHeight, quality) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = function() {
            let width = img.naturalWidth;
            let height = img.naturalHeight;

            // Calculate aspect-ratio-preserving dimensions
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }

            // Draw to canvas at target size
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Export as JPEG with given quality
            const compressed = canvas.toDataURL('image/jpeg', quality);

            // Only use compressed version if it's actually smaller
            resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
        };
        img.onerror = function() {
            // If compression fails, return original
            resolve(dataUrl);
        };
        img.src = dataUrl;
    });
}

// Photo preview
let currentPhotoData = null;

// Competitor edit mode (mirrors club pattern: editingClubId)
let editingCompetitorId = null; // null = add mode, number = edit mode

document.getElementById('photo')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            // Compress to 300x300 max (largest display size is 200x200 for winner celebration)
            compressImage(event.target.result, 300, 300, 0.8).then(compressed => {
                currentPhotoData = compressed;
                document.getElementById('photo-preview-img').src = currentPhotoData;
                document.getElementById('photo-preview').classList.remove('hidden');
            });
        };
        reader.readAsDataURL(file);
    }
});

function clearPhoto() {
    currentPhotoData = null;
    document.getElementById('photo').value = '';
    document.getElementById('photo-preview').classList.add('hidden');
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * COMPETITOR REGISTRATION & MANAGEMENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * PURPOSE: Handle competitor registration with multi-event support and DOB-based age
 *
 * WORKFLOW:
 * 1. Click "Add Competitor" button
 * 2. showCompetitorForm() - Opens form, loads dojos and events
 * 3. User enters competitor info including Date of Birth
 * 4. calculateAge() shows real-time age preview (registration vs event)
 * 5. User selects one or more events to register for
 * 6. Form submission validates and saves to competitors table
 * 7. loadCompetitors() displays all competitors with calculated ages
 *
 * KEY FEATURES (2026-02-13):
 * - Date of Birth instead of age (stores DOB, calculates age dynamically)
 * - Multi-event registration (checkboxes for multiple events)
 * - Real-time age preview (shows age at registration AND event date)
 * - Dojo selection with "Add New Dojo" option
 * - Dojo logo upload when adding new dojo
 * - Photo upload with preview
 * - Event pricing display
 *
 * DATA STRUCTURE (Competitor):
 * {
 *   id: 123,
 *   firstName: "John",
 *   lastName: "Doe",
 *   dateOfBirth: "2014-01-05",        // ISO date string (NEW)
 *   weight: 45.5,
 *   rank: "Green Belt",
 *   experience: 3.5,
 *   gender: "Male",
 *   club: "Tokyo Dojo",
 *   clubLogo: "data:image/png...",    // Base64
 *   photo: "data:image/png...",       // Base64
 *   events: [1, 3, 5],                // Array of event IDs (NEW)
 *   registrationDate: "2026-02-13T..."
 * }
 *
 * AGE CALCULATION:
 * - Age is CALCULATED from dateOfBirth, not stored
 * - Calculation method set at tournament level:
 *   - "event-date": Age on tournament date (standard)
 *   - "registration-date": Age when registered
 * - calculateAge(dob, referenceDate) handles leap years, birth month/day
 * - Legacy support: Old competitors with 'age' field still work
 *
 * MULTI-EVENT REGISTRATION:
 * - loadEventCheckboxes() populates event options with prices
 * - Competitors can select multiple events
 * - Validation requires at least one event
 * - Events stored as array of IDs: [1, 3, 5]
 * - Display shows event names in table
 *
 * DOJO INTEGRATION:
 * - loadClubDropdown() loads from clubs table
 * - "+ Add New Dojo" option appears at bottom
 * - When selected, shows:
 *   - New dojo name input
 *   - Dojo logo upload (optional)
 * - New dojo auto-saved when competitor registered
 * - Dojo logo cached in competitor.clubLogo
 *
 * ✅ FEATURES:
 * 1. ✅ DOB-based age calculation (replaces static age)
 * 2. ✅ Multi-event registration with pricing
 * 3. ✅ Real-time age preview in form
 * 4. ✅ Dynamic age display in table (respects tournament setting)
 * 5. ✅ Dojo management integration
 * 6. ✅ Photo upload with preview
 * 7. ✅ Legacy support for old data
 *
 * ⚠️ KNOWN ISSUES:
 * 1. No validation for future DOB
 * 2. No min/max age constraints
 * 3. Photo size not limited (can exceed localStorage)
 *
 * 📝 TODO:
 * - Add DOB validation (must be in past)
 * - Add age range warnings (e.g., <4 or >100)
 * - Add photo compression before save
 * - Add bulk import from CSV
 *
 * Last Updated: 2026-02-13
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Competitor Form
function showCompetitorForm() {
    // If not in edit mode, reset to add mode
    if (!editingCompetitorId) {
        editingCompetitorId = null;
        const formTitle = document.querySelector('#competitor-form-container h3');
        if (formTitle) formTitle.textContent = 'Competitor Registration';
    }
    document.getElementById('competitor-form-container').classList.remove('hidden');
    loadClubDropdown();
    loadEventCheckboxes();
}

/**
 * Calculate age from date of birth based on sanctioning body rules
 * @param {string} dateOfBirth - ISO date string (YYYY-MM-DD)
 * @param {string} method - 'wkf-standard', 'aau-standard', or 'registration-date'
 * @param {string} eventDate - ISO date string of the tournament/event
 * @returns {number} calculated age
 */
function calculateAge(dateOfBirth, method = 'aau-standard', eventDate = new Date()) {
    // Guard: date-only "YYYY-MM-DD" strings → local noon to avoid timezone shift
    const safeParse = (d) => (typeof d === 'string' && d.length === 10) ? new Date(d + 'T12:00:00') : new Date(d);
    const dob = safeParse(dateOfBirth);

    if (method === 'wkf-standard') {
        // WKF Rule: Age as of December 31st of the competition year
        const competitionYear = safeParse(eventDate).getFullYear();
        const dec31 = new Date(competitionYear, 11, 31); // Dec 31st of competition year
        let age = dec31.getFullYear() - dob.getFullYear();
        const monthDiff = dec31.getMonth() - dob.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && dec31.getDate() < dob.getDate())) {
            age--;
        }

        return age;
    } else if (method === 'aau-standard') {
        // AAU Rule: Age on day of competition
        const ref = safeParse(eventDate);
        let age = ref.getFullYear() - dob.getFullYear();
        const monthDiff = ref.getMonth() - dob.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < dob.getDate())) {
            age--;
        }

        return age;
    } else {
        // registration-date: Age right now (legacy behavior)
        const ref = new Date();
        let age = ref.getFullYear() - dob.getFullYear();
        const monthDiff = ref.getMonth() - dob.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < dob.getDate())) {
            age--;
        }

        return age;
    }
}

/**
 * Helper: Get display-friendly age from a competitor object.
 * Handles both new schema (dateOfBirth) and legacy schema (age).
 */
function getDisplayAge(comp) {
    if (!comp) return '-';
    if (comp.dateOfBirth) {
        const age = calculateAge(comp.dateOfBirth);
        // Guard against invalid/nonsensical ages
        if (isNaN(age) || age <= 0 || age > 120) return '-';
        return age;
    }
    return comp.age != null && comp.age > 0 ? comp.age : '-';
}

// Show age preview when DOB is entered
document.getElementById('dateOfBirth')?.addEventListener('change', function(e) {
    const dob = e.target.value;
    const ageDisplay = document.getElementById('age-display');

    if (dob && ageDisplay) {
        // Get current tournament
        const tournaments = db.load('tournaments');
        const currentTournament = tournaments.find(t => t.id === currentTournamentId);

        if (currentTournament) {
            const method = currentTournament.ageCalculationMethod || 'aau-standard';
            const ageAtRegistration = calculateAge(dob, 'registration-date', new Date());
            const ageAtEvent = calculateAge(dob, method, currentTournament.date);

            const methodLabel = method === 'wkf-standard'
                ? 'WKF (Dec 31st)'
                : method === 'aau-standard'
                    ? 'AAU (Event date)'
                    : 'Event date';

            ageDisplay.textContent = `Age now: ${ageAtRegistration} | Age for competition (${methodLabel}): ${ageAtEvent}`;
        } else {
            const currentAge = calculateAge(dob, 'registration-date', new Date());
            ageDisplay.textContent = `Current age: ${currentAge}`;
        }
    }
});

// Ordered array tracking event selection order — index 0 = primary (base price)
let selectedEventOrder = [];

function loadEventCheckboxes(preselectedEvents = []) {
    const eventTypes = db.load('eventTypes');
    const container = document.getElementById('event-checkboxes');

    if (!container) return;

    if (eventTypes.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); font-size: 14px;">No events available. Please create events first.</p>';
        return;
    }

    container.innerHTML = '';

    const defaultEvent = eventTypes.find(event => event.isDefault);

    // Initialize selection order
    if (preselectedEvents.length > 0) {
        selectedEventOrder = [...preselectedEvents];
    } else {
        // Auto-select default event as primary
        selectedEventOrder = defaultEvent ? [defaultEvent.id] : [];
    }

    // Render ALL events as checkboxes (including default, which starts pre-checked)
    eventTypes.forEach(event => {
        const checkboxDiv = document.createElement('div');
        checkboxDiv.id = `event-row-${event.id}`;
        checkboxDiv.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: var(--bg-primary); border-radius: 8px; transition: border-color 0.2s;';

        const teamSize = event.teamSize || 1;
        const teamLabel = teamSize > 1 ? ` (Team of ${teamSize})` : '';
        const isChecked = selectedEventOrder.includes(event.id);

        checkboxDiv.innerHTML = `
            <input
                type="checkbox"
                id="event-${event.id}"
                name="events"
                value="${event.id}"
                data-team-size="${teamSize}"
                ${isChecked ? 'checked' : ''}
                onchange="updateEventOrder(${event.id})"
                style="width: 18px; height: 18px; cursor: pointer; flex-shrink: 0;"
            >
            <label for="event-${event.id}" style="cursor: pointer; flex: 1; font-size: 14px;">
                <strong>${event.name}</strong>${teamLabel}
            </label>
            <span id="event-badge-${event.id}" style="padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; white-space: nowrap;"></span>
        `;

        container.appendChild(checkboxDiv);
    });

    // Add price summary container
    const summaryDiv = document.createElement('div');
    summaryDiv.id = 'price-summary';
    summaryDiv.style.cssText = 'margin-top: 16px; padding: 16px; background: var(--bg-primary); border-radius: 10px; border: 1px solid var(--glass-border);';
    summaryDiv.innerHTML = `
        <div id="price-breakdown"></div>
        <div id="price-total" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--glass-border); font-size: 16px; font-weight: 700; color: var(--accent);"></div>
    `;
    container.appendChild(summaryDiv);

    updateEventBadges();
    updatePriceSummary();
}

function updateEventOrder(eventId) {
    const checkbox = document.getElementById(`event-${eventId}`);
    if (checkbox && checkbox.checked) {
        if (!selectedEventOrder.includes(eventId)) {
            selectedEventOrder.push(eventId);
        }
    } else {
        selectedEventOrder = selectedEventOrder.filter(id => id !== eventId);
    }
    updateEventBadges();
    updatePriceSummary();
    handleEventSelection(); // preserve existing team event logic
}

function updateEventBadges() {
    const eventTypes = db.load('eventTypes');
    const tournament = getCurrentTournament();

    eventTypes.forEach(event => {
        const badge = document.getElementById(`event-badge-${event.id}`);
        const row = document.getElementById(`event-row-${event.id}`);
        if (!badge) return;

        const orderIndex = selectedEventOrder.indexOf(event.id);
        if (orderIndex === -1) {
            badge.textContent = '';
            badge.style.background = 'transparent';
            badge.style.color = 'transparent';
            if (row) row.style.border = '1px solid transparent';
        } else if (orderIndex === 0) {
            const price = getEventPrice(event, false, tournament);
            badge.textContent = `PRIMARY — $${price.toFixed(2)}`;
            badge.style.background = 'var(--accent)';
            badge.style.color = '#fff';
            if (row) row.style.border = '1px solid var(--accent)';
        } else {
            const price = getEventPrice(event, true, tournament);
            badge.textContent = `ADD-ON — $${price.toFixed(2)}`;
            badge.style.background = 'rgba(255,255,255,0.1)';
            badge.style.color = 'var(--text-secondary)';
            if (row) row.style.border = '1px solid var(--glass-border)';
        }
    });
}

function updatePriceSummary() {
    const eventTypes = db.load('eventTypes');
    const tournament = getCurrentTournament();
    const breakdownEl = document.getElementById('price-breakdown');
    const totalEl = document.getElementById('price-total');

    if (!breakdownEl || !totalEl) return;

    if (selectedEventOrder.length === 0) {
        breakdownEl.innerHTML = '<p style="color: var(--text-secondary); font-size: 13px;">No events selected. Please select at least one event.</p>';
        totalEl.textContent = '';
        return;
    }

    const { breakdown, total } = calculatePricingBreakdown(selectedEventOrder, eventTypes, tournament);

    breakdownEl.innerHTML = breakdown.map(item => `
        <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px;">
            <span>
                ${item.type === 'primary' ? '✦ ' : '  '}
                ${item.eventName}
                <span style="color: var(--text-secondary); font-size: 12px;">(${item.type === 'primary' ? 'Primary' : 'Add-on'})</span>
            </span>
            <span style="font-weight: 600;">$${item.price.toFixed(2)}</span>
        </div>
    `).join('');

    totalEl.innerHTML = `Total: $${total.toFixed(2)}`;
}

function handleEventSelection() {
    const checkboxes = document.querySelectorAll('input[name="events"]:checked');
    const teamSection = document.getElementById('team-registration-section');

    let hasTeamEvent = false;

    checkboxes.forEach(checkbox => {
        const teamSize = parseInt(checkbox.dataset.teamSize);
        if (teamSize > 1) {
            hasTeamEvent = true;
        }
    });

    if (hasTeamEvent) {
        teamSection.classList.remove('hidden');
    } else {
        teamSection.classList.add('hidden');
    }
}

function toggleTeamOptions() {
    const teamOption = document.querySelector('input[name="team-option"]:checked').value;
    const createSection = document.getElementById('team-create-section');
    const joinSection = document.getElementById('team-join-section');

    if (teamOption === 'create') {
        createSection.classList.remove('hidden');
        joinSection.classList.add('hidden');
    } else {
        createSection.classList.add('hidden');
        joinSection.classList.remove('hidden');
    }
}

function generateTeamCode() {
    // Generate a unique 6-character team code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding similar-looking characters
    let code = 'TEAM-';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function verifyTeamCode() {
    const teamCode = document.getElementById('team-code').value.trim().toUpperCase();
    const teamInfoDiv = document.getElementById('team-info');

    if (!teamCode) {
        showMessage('Please enter a team code', 'error');
        return;
    }

    // Find team by code
    const teams = JSON.parse(localStorage.getItem(_scopedKey('teams')) || '{}');
    const team = teams[teamCode];

    if (!team) {
        showMessage('Invalid team code', 'error');
        teamInfoDiv.classList.add('hidden');
        return;
    }

    // Check if team is full
    if (team.members.length >= team.maxSize) {
        showMessage('This team is already full', 'error');
        teamInfoDiv.classList.add('hidden');
        return;
    }

    // Get event info
    const eventTypes = db.load('eventTypes');
    const event = eventTypes.find(e => e.id === team.eventId);

    // Show team info
    teamInfoDiv.classList.remove('hidden');
    teamInfoDiv.innerHTML = `
        <strong style="color: var(--accent);">✓ Valid Team Code</strong><br>
        <strong>Event:</strong> ${event ? event.name : 'Unknown'}<br>
        <strong>Team Captain:</strong> ${team.captainName}<br>
        <strong>Current Members:</strong> ${team.members.length} / ${team.maxSize}<br>
        <strong>Spots Available:</strong> ${team.maxSize - team.members.length}<br>
        <p style="margin-top: 8px; color: var(--text-secondary);">You will join this team (no payment required)</p>
    `;

    showMessage('Team code verified!', 'success');
}

function hideCompetitorForm() {
    editingCompetitorId = null; // Reset edit mode
    const container = document.getElementById('competitor-form-container');
    const form = document.getElementById('competitor-form');
    if (container) container.classList.add('hidden');
    if (form) form.reset();
    currentPhotoData = null;
    currentNewClubLogoData = null;
    document.getElementById('photo-preview')?.classList.add('hidden');
    document.getElementById('new-club-name-group').style.display = 'none';
    document.getElementById('new-club-logo-group').style.display = 'none';
    document.getElementById('new-club-logo-preview')?.classList.add('hidden');

    // Reset form title back to add mode
    const formTitle = document.querySelector('#competitor-form-container h3');
    if (formTitle) formTitle.textContent = 'Competitor Registration';
}

// Club dropdown handler
let currentNewClubLogoData = null;

function handleClubSelection() {
    const clubSelect = document.getElementById('club');
    const newClubGroup = document.getElementById('new-club-name-group');
    const newClubLogoGroup = document.getElementById('new-club-logo-group');
    const newClubInput = document.getElementById('new-club-name');

    if (clubSelect.value === '__new__') {
        newClubGroup.style.display = 'block';
        newClubLogoGroup.style.display = 'block';
        newClubInput.required = true;
    } else {
        newClubGroup.style.display = 'none';
        newClubLogoGroup.style.display = 'none';
        newClubInput.required = false;
        newClubInput.value = '';
        currentNewClubLogoData = null;
        document.getElementById('new-club-logo-preview')?.classList.add('hidden');
    }
}

// Handle club logo upload in competitor form (with compression)
document.getElementById('new-club-logo')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            compressImage(event.target.result, 200, 200, 0.8).then(compressed => {
                currentNewClubLogoData = compressed;
                const preview = document.getElementById('new-club-logo-preview');
                const img = document.getElementById('new-club-logo-preview-img');
                if (img) img.src = currentNewClubLogoData;
                if (preview) preview.classList.remove('hidden');
            });
        };
        reader.readAsDataURL(file);
    }
});

function clearNewClubLogo() {
    currentNewClubLogoData = null;
    document.getElementById('new-club-logo').value = '';
    document.getElementById('new-club-logo-preview').classList.add('hidden');
}

// Club data management - stores club name with logo
function saveClubData(clubName, clubLogo) {
    const clubs = db.load('clubs');

    // Check if club already exists
    const existingClub = clubs.find(c => c.name === clubName);

    if (!existingClub && clubLogo) {
        // Add new club with logo
        db.add('clubs', {
            name: clubName,
            logo: clubLogo,
            createdAt: new Date().toISOString()
        });
    } else if (existingClub && clubLogo && !existingClub.logo) {
        // Update existing club with logo if it doesn't have one
        db.update('clubs', existingClub.id, { logo: clubLogo });
    }
}

function getClubLogo(clubName) {
    const clubs = db.load('clubs');
    const club = clubs.find(c => c.name === clubName);
    return club?.logo || null;
}

// Load clubs into dropdown
function loadClubDropdown() {
    const clubs = db.load('clubs');
    const competitors = db.load('competitors');
    const clubSelect = document.getElementById('club');

    if (!clubSelect) return;

    // Get unique club names from clubs table
    const clubTableNames = clubs.map(c => c.name);

    // Also get club names from existing competitors (for legacy data)
    const competitorClubNames = competitors.map(c => c.club).filter(Boolean);

    // Combine and get unique, sorted list
    const allClubNames = [...new Set([...clubTableNames, ...competitorClubNames])].sort();

    clubSelect.innerHTML = '<option value="">Select Dojo</option>';

    allClubNames.forEach(clubName => {
        const option = document.createElement('option');
        option.value = clubName;
        option.textContent = clubName;
        clubSelect.appendChild(option);
    });

    // Add "New Dojo" option
    const newOption = document.createElement('option');
    newOption.value = '__new__';
    newOption.textContent = '+ Add New Dojo';
    clubSelect.appendChild(newOption);
}

// Competitor Registration
document.getElementById('competitor-form').addEventListener('submit', (e) => {
    e.preventDefault();

    // Ensure tournament is selected
    if (!ensureTournamentSelected()) {
        return;
    }

    const clubSelect = document.getElementById('club');
    let clubName = clubSelect.value;
    let clubLogo = null;

    // If new club, use the input field value and save club
    if (clubName === '__new__') {
        clubName = document.getElementById('new-club-name').value;
        if (clubName) {
            // Save the new club with logo
            const newClub = {
                name: clubName,
                logo: currentNewClubLogoData || null,
                country: '',
                createdAt: new Date().toISOString()
            };
            db.add('clubs', newClub);
            clubLogo = currentNewClubLogoData;
        }
    } else if (clubName) {
        // Existing club selected - ensure it exists in clubs table
        const clubs = db.load('clubs');
        const existingClub = clubs.find(c => c.name === clubName);

        if (!existingClub) {
            // Club doesn't exist in clubs table yet (legacy data), add it
            const newClub = {
                name: clubName,
                logo: null,
                country: '',
                createdAt: new Date().toISOString()
            };
            db.add('clubs', newClub);
        }

        clubLogo = getClubLogo(clubName);
    }

    // Use the ordered selection array maintained by loadEventCheckboxes/updateEventOrder
    const eventTypes = db.load('eventTypes');

    // Validate at least one event selected
    if (selectedEventOrder.length === 0) {
        showMessage('Please select at least one event to register for.', 'error');
        return;
    }

    // Build selected events from the ordered array
    const selectedEvents = [...selectedEventOrder];

    // Handle team registration
    let teamCode = null;
    let teamName = null;
    const teamSection = document.getElementById('team-registration-section');

    if (!teamSection.classList.contains('hidden')) {
        const teamOption = document.querySelector('input[name="team-option"]:checked')?.value;

        if (teamOption === 'create') {
            // Creating new team
            teamName = document.getElementById('team-name').value.trim();
            if (!teamName) {
                showMessage('Please enter a team name', 'error');
                return;
            }

            // Find the team event
            const teamEventId = selectedEvents.find(eventId => {
                const event = eventTypes.find(e => e.id === eventId);
                return event && event.teamSize > 1;
            });

            const teamEvent = eventTypes.find(e => e.id === teamEventId);

            // Generate unique team code
            teamCode = generateTeamCode();

            // Create team record
            const teams = JSON.parse(localStorage.getItem(_scopedKey('teams')) || '{}');
            teams[teamCode] = {
                code: teamCode,
                name: teamName,
                eventId: teamEventId,
                maxSize: teamEvent.teamSize,
                captainName: document.getElementById('firstName').value + ' ' + document.getElementById('lastName').value,
                members: [], // Will add competitor ID after creation
                createdAt: new Date().toISOString()
            };
            localStorage.setItem(_scopedKey('teams'), JSON.stringify(teams));
            _debouncedSync('teams', _syncTeamsToServer, 2000);

        } else if (teamOption === 'join') {
            // Joining existing team
            teamCode = document.getElementById('team-code').value.trim().toUpperCase();
            if (!teamCode) {
                showMessage('Please enter a team code', 'error');
                return;
            }

            const teams = JSON.parse(localStorage.getItem(_scopedKey('teams')) || '{}');
            const team = teams[teamCode];

            if (!team) {
                showMessage('Invalid team code', 'error');
                return;
            }

            if (team.members.length >= team.maxSize) {
                showMessage('This team is already full', 'error');
                return;
            }

            teamName = team.name;
        }
    }

    const dateOfBirth = document.getElementById('dateOfBirth').value;

    const tournament = getCurrentTournament();

    const competitorFields = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        dateOfBirth: dateOfBirth,
        weight: parseFloat(document.getElementById('weight').value),
        rank: document.getElementById('rank').value,
        experience: parseFloat(document.getElementById('experience').value),
        gender: document.getElementById('gender').value,
        club: clubName,
        clubLogo: clubLogo,
        photo: currentPhotoData || null,
        events: selectedEvents,
        primaryEventId: selectedEvents[0] || null,
        pricing: calculatePricingBreakdown(selectedEvents, eventTypes, tournament),
        paymentStatus: document.getElementById('payment-status')?.value || 'unpaid',
        teamCode: teamCode,
        teamName: teamName
    };

    if (editingCompetitorId) {
        // ═══ EDIT MODE — update existing competitor (mirrors club edit pattern) ═══
        const allCompetitors = db.load('competitors');
        const compIndex = allCompetitors.findIndex(c => c.id === editingCompetitorId);

        if (compIndex === -1) {
            showMessage('Competitor not found', 'error');
            return;
        }

        const oldCompetitor = { ...allCompetitors[compIndex] };

        // Preserve existing payment status if not changed via dropdown
        if (!document.getElementById('payment-status')) {
            competitorFields.paymentStatus = oldCompetitor.paymentStatus || 'unpaid';
        }

        // Update using spread — preserve id, registrationDate, tournamentId
        allCompetitors[compIndex] = {
            ...allCompetitors[compIndex],
            ...competitorFields,
            updatedAt: new Date().toISOString()
        };

        const updatedCompetitor = allCompetitors[compIndex];
        localStorage.setItem(_scopedKey('competitors'), JSON.stringify(allCompetitors));

        // Update competitor data embedded in brackets (they store full objects, not IDs)
        updateCompetitorInBrackets(editingCompetitorId, updatedCompetitor);

        // Check if division-affecting fields changed
        const divisionFieldsChanged =
            oldCompetitor.dateOfBirth !== updatedCompetitor.dateOfBirth ||
            oldCompetitor.gender !== updatedCompetitor.gender ||
            oldCompetitor.rank !== updatedCompetitor.rank ||
            oldCompetitor.weight !== updatedCompetitor.weight ||
            oldCompetitor.experience !== updatedCompetitor.experience;

        showMessage('Competitor updated successfully!', 'success');

        if (divisionFieldsChanged) {
            try {
                autoAssignToDivisions(updatedCompetitor, editingCompetitorId);
            } catch (error) {
                console.error('Auto-division re-assignment failed:', error);
            }
        }

        editingCompetitorId = null;
    } else {
        // ═══ ADD MODE — create new competitor (existing logic) ═══
        const competitor = {
            ...competitorFields,
            registrationDate: new Date().toISOString(),
            tournamentId: currentTournamentId
        };

        const competitorId = db.add('competitors', competitor);

        // Add competitor to team members list
        if (teamCode) {
            const teams = JSON.parse(localStorage.getItem(_scopedKey('teams')) || '{}');
            const team = teams[teamCode];
            if (team) {
                team.members.push(competitorId);
                localStorage.setItem(_scopedKey('teams'), JSON.stringify(teams));
                _debouncedSync('teams', _syncTeamsToServer, 2000);
            }
        }

        // AUTO-DIVISION GENERATION: Match competitor to templates and auto-create divisions/brackets
        try {
            autoAssignToDivisions(competitor, competitorId);
        } catch (error) {
            console.error('Auto-division assignment failed:', error);
            showMessage(`Competitor registered, but auto-division failed: ${error.message}`, 'warning');
        }

        // Show success message with team code if applicable
        if (teamCode && teamName && competitor.teamCode === teamCode) {
            const teamOption = document.querySelector('input[name="team-option"]:checked')?.value;
            if (teamOption === 'create') {
                showMessage(
                    `Competitor registered successfully!\n\nTeam Code: ${teamCode}\n\nShare this code with your ${eventTypes.find(e => e.teamSize > 1)?.teamSize - 1} teammate(s) so they can join "${teamName}".`,
                    'success'
                );
                showToast(`Team created! Code: ${teamCode} — share with teammates`, 'success');
            } else {
                showMessage(`Successfully joined team "${teamName}"!`, 'success');
            }
        } else {
            showMessage('Competitor registered successfully!');
        }
    }

    hideCompetitorForm();
    // Sync clubs once, then reload both views
    syncCompetitorClubsToTable();
    loadCompetitors(true);
    loadClubs(true);
    loadDashboard();
    currentPhotoData = null;
});

// Update competitor data embedded in all brackets
function updateCompetitorInBrackets(competitorId, updatedCompetitor) {
    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
    let changed = false;

    // Fields to copy into embedded competitor objects
    const fieldsToUpdate = ['firstName', 'lastName', 'dateOfBirth', 'weight', 'rank',
                            'experience', 'gender', 'club', 'clubLogo', 'photo', 'events'];

    function updateCompObj(comp) {
        if (!comp || comp.id !== competitorId) return false;
        let updated = false;
        fieldsToUpdate.forEach(field => {
            if (comp[field] !== updatedCompetitor[field]) {
                comp[field] = updatedCompetitor[field];
                updated = true;
            }
        });
        return updated;
    }

    for (const bracketId in brackets) {
        const bracket = brackets[bracketId];

        if (bracket.type === 'single-elimination' || bracket.type === 'round-robin' || bracket.type === 'repechage') {
            [bracket.matches, bracket.repechageA, bracket.repechageB].forEach(arr => {
                (arr || []).forEach(match => {
                    if (updateCompObj(match.redCorner)) changed = true;
                    if (updateCompObj(match.blueCorner)) changed = true;
                    if (updateCompObj(match.winner)) changed = true;
                });
            });
            // Also update competitors array if it exists
            (bracket.competitors || []).forEach((comp, idx) => {
                if (comp && comp.id === competitorId) {
                    fieldsToUpdate.forEach(f => { bracket.competitors[idx][f] = updatedCompetitor[f]; });
                    changed = true;
                }
            });
        } else if (bracket.type === 'double-elimination') {
            (bracket.winners || []).forEach(match => {
                if (updateCompObj(match.redCorner)) changed = true;
                if (updateCompObj(match.blueCorner)) changed = true;
                if (updateCompObj(match.winner)) changed = true;
            });
            (bracket.losers || []).forEach(match => {
                if (updateCompObj(match.redCorner)) changed = true;
                if (updateCompObj(match.blueCorner)) changed = true;
                if (updateCompObj(match.winner)) changed = true;
            });
            if (bracket.finals) {
                if (updateCompObj(bracket.finals.redCorner)) changed = true;
                if (updateCompObj(bracket.finals.blueCorner)) changed = true;
                if (updateCompObj(bracket.finals.winner)) changed = true;
            }
            (bracket.competitors || []).forEach((comp, idx) => {
                if (comp && comp.id === competitorId) {
                    fieldsToUpdate.forEach(f => { bracket.competitors[idx][f] = updatedCompetitor[f]; });
                    changed = true;
                }
            });
        } else if (bracket.type === 'pool-play') {
            (bracket.pools || []).forEach(pool => {
                (pool.competitors || []).forEach((comp, idx) => {
                    if (comp && comp.id === competitorId) {
                        fieldsToUpdate.forEach(f => { pool.competitors[idx][f] = updatedCompetitor[f]; });
                        changed = true;
                    }
                });
                (pool.matches || []).forEach(match => {
                    if (updateCompObj(match.redCorner)) changed = true;
                    if (updateCompObj(match.blueCorner)) changed = true;
                    if (updateCompObj(match.winner)) changed = true;
                });
            });
        } else if (bracket.type === 'ranking-list') {
            (bracket.entries || []).forEach(entry => {
                if (updateCompObj(entry.competitor)) changed = true;
            });
            (bracket.competitors || []).forEach((comp, idx) => {
                if (comp && comp.id === competitorId) {
                    fieldsToUpdate.forEach(f => { bracket.competitors[idx][f] = updatedCompetitor[f]; });
                    changed = true;
                }
            });
        } else if (bracket.type === 'kata-flags' || bracket.type === 'kata-points') {
            (bracket.rounds || []).forEach(round => {
                (round.performances || []).forEach(perf => {
                    if (updateCompObj(perf.competitor)) changed = true;
                });
            });
            (bracket.competitors || []).forEach((comp, idx) => {
                if (comp && comp.id === competitorId) {
                    fieldsToUpdate.forEach(f => { bracket.competitors[idx][f] = updatedCompetitor[f]; });
                    changed = true;
                }
            });
        }
    }

    if (changed) {
        saveBrackets(brackets);
        console.log(`Updated competitor ${competitorId} in brackets`);
    }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AUTO-DIVISION GENERATION SYSTEM
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * PURPOSE: Automatically assign competitors to divisions and generate brackets
 *
 * FLOW:
 * 1. Competitor registers for event (e.g., "Kata Competition")
 * 2. Find all templates for that event
 * 3. Match competitor to templates based on criteria (age, gender, etc.)
 * 4. Validate: 0 matches = error, 1 match = assign, 2+ matches = overlap error
 * 5. Create/update division based on template
 * 6. Auto-generate bracket for division
 *
 * ADDED: 2026-02-14
 * ═══════════════════════════════════════════════════════════════════════════
 */

function autoAssignToDivisions(competitor, competitorId) {
    console.log('=== AUTO-DIVISION ASSIGNMENT START ===');

    const eventTypes = db.load('eventTypes');
    const freshDivisions = db.load('divisions');

    // Find all non-default events that have division templates configured
    const eventsWithTemplates = Object.keys(freshDivisions).filter(eventId => {
        const event = eventTypes.find(e => String(e.id) === String(eventId));
        return event && !event.isDefault && freshDivisions[eventId]?.templates?.length > 0;
    });

    if (eventsWithTemplates.length === 0) {
        console.log('No division templates configured, skipping auto-division');
        return;
    }

    // Load all tournament competitors (including the newly saved one) and calculate ages.
    // This mirrors exactly what the "Generate Divisions" button does so division names
    // are always consistent — both use buildDivisions() with range.label joining.
    const allCompetitors = db.load('competitors');
    const competitors = currentTournamentId
        ? allCompetitors.filter(c => c.tournamentId === currentTournamentId)
        : allCompetitors;

    const tournaments = db.load('tournaments');
    const currentTournament = tournaments.find(t => t.id === currentTournamentId);
    const ageCalculationMethod = currentTournament?.ageCalculationMethod || 'aau-standard';
    const eventDate = currentTournament?.date || new Date();

    const competitorsWithAge = competitors.map(comp => ({
        ...comp,
        age: comp.dateOfBirth ? calculateAge(comp.dateOfBirth, ageCalculationMethod, eventDate) : (comp.age || 0)
    }));

    // Regenerate divisions for every event with templates using the same
    // buildDivisions() logic as the manual Generate button
    eventsWithTemplates.forEach(eventId => {
        const event = eventTypes.find(e => String(e.id) === String(eventId));
        const eventData = freshDivisions[eventId];
        console.log(`Auto-regenerating divisions for: ${event.name}`);

        const generatedDivisions = {};
        eventData.templates.forEach(template => {
            const result = buildDivisions(competitorsWithAge, template.criteria);
            Object.assign(generatedDivisions, result);
        });

        freshDivisions[eventId] = {
            templates: eventData.templates,
            generated: generatedDivisions,
            updatedAt: new Date().toISOString()
        };
    });

    localStorage.setItem(_scopedKey('divisions'), JSON.stringify(freshDivisions));
    console.log('=== AUTO-DIVISION ASSIGNMENT COMPLETE ===');
}

function findMatchingTemplate(eventId, competitor, competitorAge) {
    const divisions = db.load('divisions');
    const eventData = divisions[eventId];

    if (!eventData || !eventData.templates || eventData.templates.length === 0) {
        return null;
    }

    const matchingTemplates = [];

    eventData.templates.forEach(template => {
        if (competitorMatchesTemplate(competitor, competitorAge, template)) {
            matchingTemplates.push(template);
        }
    });

    // Validate: must match exactly 1 template
    if (matchingTemplates.length === 0) {
        return null; // No match
    } else if (matchingTemplates.length > 1) {
        // Template overlap error
        const templateNames = matchingTemplates.map(t => t.name).join('", "');
        throw new Error(`Template overlap detected: Competitor matches multiple templates ("${templateNames}"). Please fix template criteria to avoid overlaps.`);
    }

    return matchingTemplates[0];
}

function competitorMatchesTemplate(competitor, competitorAge, template) {
    // Check if competitor matches ALL criteria in the template
    if (!template.criteria || template.criteria.length === 0) {
        return true; // No criteria = matches all
    }

    for (const criterion of template.criteria) {
        if (!competitorMatchesCriterion(competitor, competitorAge, criterion)) {
            return false; // Failed one criterion
        }
    }

    return true; // Matches all criteria
}

function competitorMatchesCriterion(competitor, competitorAge, criterion) {
    switch (criterion.type) {
        case 'age':
            // Check if competitor's age falls within ANY of the age ranges
            return criterion.ranges.some(range =>
                competitorAge >= range.min && competitorAge <= range.max
            );

        case 'gender':
            // Check if competitor's gender matches ANY of the gender options
            return criterion.ranges.some(range =>
                competitor.gender === range.value
            );

        case 'weight':
            return criterion.ranges.some(range =>
                competitor.weight >= range.min && competitor.weight <= range.max
            );

        case 'rank':
            return criterion.ranges.some(range =>
                competitor.rank === range.value
            );

        case 'experience':
            return criterion.ranges.some(range =>
                competitor.experience >= range.min && competitor.experience <= range.max
            );

        default:
            return true; // Unknown criterion type, assume match
    }
}

function assignToDivisionAndGenerateBracket(competitor, competitorId, eventId, template, competitorAge) {
    console.log(`Assigning to template: ${template.name}`);

    // Build division name from template criteria
    const divisionName = buildDivisionNameFromTemplate(competitor, competitorAge, template);
    console.log(`Division name: ${divisionName}`);

    // Get or create division
    const divisions = db.load('divisions');
    if (!divisions[eventId]) {
        divisions[eventId] = { templates: [], generated: {} };
    }

    if (!divisions[eventId].generated) {
        divisions[eventId].generated = {};
    }

    // Get existing division or create new one
    if (!divisions[eventId].generated[divisionName]) {
        divisions[eventId].generated[divisionName] = [];
    }

    // Add competitor to division (avoid duplicates)
    const divisionCompetitors = divisions[eventId].generated[divisionName];
    if (!divisionCompetitors.find(c => c.id === competitorId)) {
        divisionCompetitors.push(competitor);
        console.log(`Added competitor to division. Total competitors: ${divisionCompetitors.length}`);
    }

    // Save updated divisions
    localStorage.setItem(_scopedKey('divisions'), JSON.stringify(divisions));
}

// Build a division name automatically from a competitor's own attributes,
// used when no template is configured for an event.
function buildAutoSingleDivisionName(competitor, age) {
    const parts = [];

    // Age bucket
    if (age < 8)        parts.push('Tiny (≤7)');
    else if (age <= 11) parts.push('Kids (8-11)');
    else if (age <= 14) parts.push('Cadets (12-14)');
    else if (age <= 17) parts.push('Juniors (15-17)');
    else if (age <= 35) parts.push('Adults (18-35)');
    else                parts.push('Masters (36+)');

    // Gender
    if (competitor.gender) parts.push(competitor.gender);

    // Rank group
    const rank = (competitor.rank || '').toLowerCase();
    const rankIdx = RANK_ORDER.indexOf(rank);
    if (rankIdx === -1)     parts.push(competitor.rank || 'Unknown Rank');
    else if (rankIdx <= 9)  parts.push('Kyu');
    else                    parts.push('Dan');

    return parts.join(' | ');
}

function buildDivisionNameFromTemplate(competitor, competitorAge, template) {
    const parts = [template.name];

    template.criteria.forEach(criterion => {
        switch (criterion.type) {
            case 'age':
                const ageRange = criterion.ranges.find(r =>
                    competitorAge >= r.min && competitorAge <= r.max
                );
                if (ageRange) {
                    parts.push(ageRange.label);
                } else {
                    // Competitor age doesn't match any range - add placeholder
                    parts.push(`Age ${competitorAge}`);
                    console.warn(`Competitor ${competitor.firstName} ${competitor.lastName} age ${competitorAge} doesn't match any age range`);
                }
                break;

            case 'gender':
                const genderRange = criterion.ranges.find(r => r.value === competitor.gender);
                if (genderRange) {
                    parts.push(genderRange.label || competitor.gender);
                } else if (competitor.gender) {
                    parts.push(competitor.gender);
                } else {
                    parts.push('Gender Unknown');
                    console.warn(`Competitor ${competitor.firstName} ${competitor.lastName} has no gender specified`);
                }
                break;

            case 'weight':
                const weightRange = criterion.ranges.find(r =>
                    competitor.weight >= r.min && competitor.weight <= r.max
                );
                if (weightRange) {
                    parts.push(weightRange.label);
                } else {
                    // Competitor weight doesn't match any range
                    parts.push(`${competitor.weight || '?'}kg`);
                    console.warn(`Competitor ${competitor.firstName} ${competitor.lastName} weight ${competitor.weight}kg doesn't match any weight range`);
                }
                break;

            case 'rank':
                const rankRange = criterion.ranges.find(r => r.value === competitor.rank);
                if (rankRange) {
                    parts.push(rankRange.label || competitor.rank);
                } else if (competitor.rank) {
                    parts.push(competitor.rank);
                } else {
                    parts.push('Rank Unknown');
                    console.warn(`Competitor ${competitor.firstName} ${competitor.lastName} has no rank specified`);
                }
                break;

            case 'experience':
                const expRange = criterion.ranges.find(r =>
                    competitor.experience >= r.min && competitor.experience <= r.max
                );
                if (expRange) {
                    parts.push(expRange.label);
                } else {
                    // Competitor experience doesn't match any range
                    parts.push(`${competitor.experience || 0} yrs exp`);
                    console.warn(`Competitor ${competitor.firstName} ${competitor.lastName} experience ${competitor.experience} years doesn't match any experience range`);
                }
                break;
        }
    });

    return parts.join(' | ');
}

function autoGenerateBracket(eventId, divisionName, competitors, template) {
    console.log(`Auto-generating bracket for: ${divisionName}`);
    console.log(`Competitors: ${competitors.length}`);

    // Deduplicate competitors by ID
    const seenIds = new Set();
    competitors = competitors.filter(c => {
        if (!c || !c.id) return false;
        if (seenIds.has(c.id)) return false;
        seenIds.add(c.id);
        return true;
    });

    if (competitors.length === 0) {
        console.log('No competitors, skipping bracket generation');
        return;
    }

    // Get scoreboard config
    const scoreboardConfigs = db.load('scoreboardConfigs');
    const scoreboardConfig = scoreboardConfigs.find(c => c.id === parseInt(template.scoreboardType));

    if (!scoreboardConfig) {
        console.error('Scoreboard config not found:', template.scoreboardType);
        return;
    }

    // Create bracket
    const bracketId = `${eventId}_${divisionName.replace(/[^a-zA-Z0-9]/g, '_')}_${generateUniqueId()}`;

    // Determine bracket type: use template setting, or infer from scoreboard type
    let bracketType = template.bracketType;
    if (!bracketType) {
        const baseType = scoreboardConfig.baseType;
        if (baseType === 'kata-points' || baseType === 'kobudo') {
            bracketType = 'pool-play';
        } else {
            bracketType = 'single-elimination';
        }
        console.log(`  No bracketType on template, defaulting to "${bracketType}" (scoreboard: ${baseType})`);
    }

    const bracket = {
        id: bracketId,
        divisionName: divisionName,
        eventId: eventId,
        type: bracketType,
        scoreboardType: scoreboardConfig.baseType,
        scoreboardConfig: scoreboardConfig,
        competitors: competitors,
        matches: [],
        createdAt: new Date().toISOString(),
        locked: false // Bracket is unlocked initially
    };

    // Generate matches based on bracket type
    generateMatchesForBracket(bracket);

    // Save bracket
    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');

    // Check if bracket already exists for this division
    const existingBracketKey = Object.keys(brackets).find(key =>
        brackets[key].divisionName === divisionName && brackets[key].eventId === eventId
    );

    if (existingBracketKey) {
        // Check if bracket is locked
        if (brackets[existingBracketKey].locked) {
            console.log('Bracket is locked, cannot regenerate');
            throw new Error(`Division "${divisionName}" bracket is locked (match in progress). Cannot add new competitors.`);
        }

        console.log('Regenerating existing bracket');
        delete brackets[existingBracketKey]; // Delete old bracket
    }

    brackets[bracketId] = bracket;
    saveBrackets(brackets);

    console.log(`Bracket generated: ${bracketId}`);
}

function generateMatchesForBracket(bracket) {
    const competitors = bracket.competitors;

    if (bracket.type === 'round-robin') {
        // Round-robin: every competitor faces every other competitor
        const matches = [];
        let matchId = 1;
        for (let i = 0; i < competitors.length; i++) {
            for (let j = i + 1; j < competitors.length; j++) {
                matches.push({
                    id: matchId++,
                    round: 1,
                    redCorner: competitors[i],
                    blueCorner: competitors[j],
                    winner: null,
                    status: 'pending'
                });
            }
        }
        bracket.matches = matches;
        bracket.rounds = competitors.length - 1;

    } else if (bracket.type === 'pool-play') {
        // Pool play: divide into pools, round-robin within each pool
        const totalCompetitors = competitors.length;
        let numPools = 1;
        if (totalCompetitors > 12) numPools = 4;
        else if (totalCompetitors > 8) numPools = 3;
        else if (totalCompetitors > 5) numPools = 2;

        // Snake draft to balance pools
        const pools = Array.from({ length: numPools }, () => []);
        let poolIndex = 0;
        let direction = 1;
        competitors.forEach(competitor => {
            pools[poolIndex].push(competitor);
            poolIndex += direction;
            if (poolIndex >= numPools || poolIndex < 0) {
                direction *= -1;
                poolIndex += direction;
            }
        });

        // Generate round-robin matches within each pool
        bracket.pools = [];
        bracket.matches = []; // Keep a flat list too for compatibility
        let globalMatchId = 1;

        pools.forEach((poolCompetitors, poolIdx) => {
            const poolMatches = [];
            for (let i = 0; i < poolCompetitors.length; i++) {
                for (let j = i + 1; j < poolCompetitors.length; j++) {
                    const match = {
                        id: `pool${poolIdx + 1}_match${globalMatchId++}`,
                        redCorner: poolCompetitors[i],
                        blueCorner: poolCompetitors[j],
                        winner: null,
                        score1: null,
                        score2: null,
                        status: 'pending'
                    };
                    poolMatches.push(match);
                    bracket.matches.push(match);
                }
            }

            bracket.pools.push({
                poolNumber: poolIdx + 1,
                poolName: String.fromCharCode(65 + poolIdx),
                competitors: poolCompetitors,
                matches: poolMatches,
                standings: poolCompetitors.map(c => ({
                    competitor: c,
                    wins: 0,
                    losses: 0,
                    points: 0,
                    rank: null
                }))
            });
        });

        bracket.finals = [];
        bracket.rounds = 1;

    } else if (bracket.type === 'ranking-list') {
        // Ranking list: no matches, just entries for individual scoring
        bracket.entries = competitors.map((comp, idx) => ({
            competitor: comp,
            performanceOrder: idx + 1,
            score: null,
            rank: null,
            status: 'pending'
        }));
        bracket.matches = [];
        bracket.rounds = 0;

    } else {
        // Single-elimination (and double-elimination fallback)
        const matches = [];
        for (let i = 0; i < competitors.length; i += 2) {
            if (i + 1 < competitors.length) {
                matches.push({
                    id: matches.length + 1,
                    round: 1,
                    redCorner: competitors[i],
                    blueCorner: competitors[i + 1],
                    winner: null,
                    status: 'pending'
                });
            } else {
                matches.push({
                    id: matches.length + 1,
                    round: 1,
                    redCorner: competitors[i],
                    blueCorner: null,
                    winner: competitors[i],
                    status: 'bye'
                });
            }
        }
        bracket.matches = matches;
        bracket.rounds = Math.ceil(Math.log2(Math.max(competitors.length, 1)));
    }
}

/**
 * BRACKET LOCKING MECHANISM
 *
 * PURPOSE: Lock brackets once competition starts to prevent regeneration
 *
 * WHEN TO LOCK:
 * - Automatically when first match starts (status changes from 'pending' to 'in-progress')
 * - Manually via "Lock Bracket" button
 *
 * WHEN LOCKED:
 * - Cannot regenerate bracket (new registrations rejected for that division)
 * - Cannot delete bracket
 * - Can still update match results
 */

function lockBracket(bracketId) {
    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
    const bracket = brackets[bracketId];

    if (!bracket) {
        showMessage('Bracket not found', 'error');
        return;
    }

    if (bracket.locked) {
        showMessage('Bracket is already locked', 'warning');
        return;
    }

    const confirm = window.confirm(
        `Lock bracket for "${bracket.divisionName}"?\n\n` +
        `Once locked:\n` +
        `✗ Cannot regenerate bracket\n` +
        `✗ Cannot add new competitors\n` +
        `✗ Cannot delete bracket\n\n` +
        `Matches can still be scored.`
    );

    if (!confirm) return;

    bracket.locked = true;
    bracket.lockedAt = new Date().toISOString();
    saveBrackets(brackets);
    _debouncedSync('brackets', _syncBracketsToServer, 2000);

    loadBrackets();
    showMessage(`Bracket locked for "${bracket.divisionName}"`, 'success');
}

function unlockBracket(bracketId) {
    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
    const bracket = brackets[bracketId];

    if (!bracket) {
        showMessage('Bracket not found', 'error');
        return;
    }

    if (!bracket.locked) {
        showMessage('Bracket is not locked', 'warning');
        return;
    }

    const confirm = window.confirm(
        `Unlock bracket for "${bracket.divisionName}"?\n\n` +
        `⚠️ WARNING: This will allow:\n` +
        `• New competitors to be added (bracket will regenerate)\n` +
        `• Bracket to be deleted\n\n` +
        `Only unlock if you need to make changes before competition starts.`
    );

    if (!confirm) return;

    bracket.locked = false;
    delete bracket.lockedAt;
    saveBrackets(brackets);
    _debouncedSync('brackets', _syncBracketsToServer, 2000);

    loadBrackets();
    showMessage(`Bracket unlocked for "${bracket.divisionName}"`, 'success');
}

function autoLockBracketOnMatchStart(bracketId) {
    // Called when a match status changes from 'pending' to 'in-progress'
    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
    const bracket = brackets[bracketId];

    if (!bracket || bracket.locked) return;

    console.log(`Auto-locking bracket ${bracketId} (first match started)`);

    bracket.locked = true;
    bracket.lockedAt = new Date().toISOString();
    bracket.autoLocked = true; // Flag to indicate it was auto-locked
    saveBrackets(brackets);
}

function loadCompetitors(skipSync = false) {
    // Sync clubs first to ensure clubs table is up to date (unless already synced)
    if (!skipSync) {
        syncCompetitorClubsToTable();
    }

    const allCompetitors = db.load('competitors');
    const eventTypes = db.load('eventTypes');
    const tournaments = db.load('tournaments');
    const tbody = document.getElementById('competitors-tbody');

    if (!tbody) return; // Element doesn't exist on this page

    tbody.innerHTML = '';

    // Filter competitors by current tournament
    const competitors = currentTournamentId
        ? allCompetitors.filter(c => c.tournamentId === currentTournamentId)
        : allCompetitors; // Show all if no tournament selected (legacy support)

    // Show tournament filter status
    if (currentTournamentId) {
        const currentTournament = tournaments.find(t => t.id === currentTournamentId);
        if (currentTournament) {
            const filterBanner = document.getElementById('tournament-filter-banner');
            if (filterBanner) {
                filterBanner.textContent = `Showing competitors for: ${currentTournament.name}`;
                filterBanner.classList.remove('hidden');
            }
        }
    }

    // Get current tournament for age calculation
    const currentTournament = tournaments.find(t => t.id === currentTournamentId);
    const ageCalculationMethod = currentTournament?.ageCalculationMethod || 'aau-standard';
    const eventDate = currentTournament?.date || new Date();

    competitors.forEach(comp => {
        const tr = document.createElement('tr');
        const photoHtml = comp.photo
            ? `<img src="${comp.photo}" class="table-photo" alt="${comp.firstName}">`
            : '<div style="width: 40px; height: 40px; background: var(--glass-bg); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px;">No Photo</div>';

        // Calculate age based on tournament settings
        let ageDisplay = '-';
        if (comp.dateOfBirth) {
            const age = calculateAge(comp.dateOfBirth, ageCalculationMethod, eventDate);
            ageDisplay = age.toString();
        } else if (comp.age) {
            // Legacy support for old competitors with age field
            ageDisplay = comp.age.toString();
        }

        // Get event names for this competitor
        let eventsHtml = '-';
        if (comp.events && comp.events.length > 0) {
            const eventNames = comp.events.map(eventId => {
                const event = eventTypes.find(e => e.id === eventId);
                return event ? event.name : `Event #${eventId}`;
            });
            eventsHtml = eventNames.join('<br>');
        }

        const totalDue = comp.pricing?.total != null ? `$${comp.pricing.total.toFixed(2)}` : '-';
        const paymentBadge = getPaymentStatusBadge(comp.paymentStatus || 'unpaid');

        tr.innerHTML = `
            <td>${photoHtml}</td>
            <td>${comp.firstName} ${comp.lastName}</td>
            <td>${ageDisplay}</td>
            <td>${comp.gender || '-'}</td>
            <td>${comp.weight} kg</td>
            <td>${comp.rank}</td>
            <td>${comp.club}</td>
            <td style="font-size: 12px;">${eventsHtml}</td>
            <td style="font-size: 13px; font-weight: 600;">${totalDue}</td>
            <td style="cursor: pointer;" onclick="togglePaymentStatus(${comp.id})">${paymentBadge}</td>
            <td>
                <button class="btn btn-small" onclick="editCompetitor(${comp.id})">Edit</button>
                <button class="btn btn-small btn-danger" onclick="deleteCompetitor(${comp.id})">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Update competitor selects for scoreboard
    updateCompetitorSelects();
}

function deleteCompetitor(id) {
    if (confirm('Are you sure you want to delete this competitor?')) {
        db.delete('competitors', id);
        loadCompetitors();
        loadDashboard();
        showMessage('Competitor deleted successfully!');
    }
}

// Edit competitor — follows exact same pattern as editClub()
window.editCompetitor = function(id) {
    const competitors = db.load('competitors');
    const comp = competitors.find(c => c.id === id);

    if (!comp) {
        showMessage('Competitor not found', 'error');
        return;
    }

    // Set edit mode
    editingCompetitorId = id;

    // Show the form first (loads club dropdown + event checkboxes)
    showCompetitorForm();

    // Pre-populate form fields
    document.getElementById('firstName').value = comp.firstName || '';
    document.getElementById('lastName').value = comp.lastName || '';
    document.getElementById('dateOfBirth').value = comp.dateOfBirth || '';
    document.getElementById('weight').value = comp.weight ?? '';
    document.getElementById('rank').value = comp.rank || '';
    document.getElementById('experience').value = comp.experience ?? '';
    document.getElementById('gender').value = comp.gender || '';

    // Trigger age display update
    const dobInput = document.getElementById('dateOfBirth');
    if (dobInput) dobInput.dispatchEvent(new Event('change'));

    // Set club dropdown
    const clubSelect = document.getElementById('club');
    if (clubSelect && comp.club) {
        // Check if club exists in dropdown options
        const clubOption = Array.from(clubSelect.options).find(opt => opt.value === comp.club);
        if (clubOption) {
            clubSelect.value = comp.club;
        } else {
            // Club not in dropdown — select "new" and fill in the name
            clubSelect.value = '__new__';
            handleClubSelection();
            document.getElementById('new-club-name').value = comp.club;
        }
    }

    // Reload event checkboxes with saved ordered selection
    selectedEventOrder = comp.events ? [...comp.events] : [];
    loadEventCheckboxes(comp.events || []);

    // Pre-populate payment status
    const paymentStatusEl = document.getElementById('payment-status');
    if (paymentStatusEl) paymentStatusEl.value = comp.paymentStatus || 'unpaid';

    // Handle team fields
    if (comp.teamCode || comp.teamName) {
        const teamSection = document.getElementById('team-registration-section');
        if (teamSection && !teamSection.classList.contains('hidden')) {
            if (comp.teamCode) {
                const joinRadio = document.querySelector('input[name="team-option"][value="join"]');
                if (joinRadio) {
                    joinRadio.checked = true;
                    toggleTeamOptions();
                    document.getElementById('team-code').value = comp.teamCode;
                }
            }
            if (comp.teamName) {
                document.getElementById('team-name').value = comp.teamName;
            }
        }
    }

    // Handle photo
    if (comp.photo) {
        currentPhotoData = comp.photo;
        const previewImg = document.getElementById('photo-preview-img');
        const previewContainer = document.getElementById('photo-preview');
        if (previewImg) previewImg.src = comp.photo;
        if (previewContainer) previewContainer.classList.remove('hidden');
    } else {
        currentPhotoData = null;
        document.getElementById('photo-preview')?.classList.add('hidden');
    }

    // Update form title to "Edit Competitor"
    const formTitle = document.querySelector('#competitor-form-container h3');
    if (formTitle) formTitle.textContent = 'Edit Competitor';

    // Scroll form into view
    document.getElementById('competitor-form-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

function generateTestCompetitors() {
    // ═══════════════════════════════════════════════════════════════════════
    // TEMPLATE-AWARE TEST DATA GENERATOR
    // ═══════════════════════════════════════════════════════════════════════
    //
    // Reads actual division templates and reverse-engineers ~100 competitors
    // that are guaranteed to fill real division slots. Handles team events,
    // manages clubs, and does scoped cleanup.

    // ── Name pools (diverse mix) ──
    const firstNames = [
        'Aiden', 'Akira', 'Alejandro', 'Amara', 'Anika', 'Arjun', 'Ava', 'Benjamin',
        'Camila', 'Carlos', 'Charlotte', 'Chen', 'Chloe', 'Daniel', 'Davi', 'Diana',
        'Elena', 'Elijah', 'Emilia', 'Ethan', 'Fatima', 'Gabriel', 'Hana', 'Haruto',
        'Hiroshi', 'Hugo', 'Ibrahim', 'Isabella', 'Isla', 'Jack', 'James', 'Jasmine',
        'Jayden', 'Jin', 'Kai', 'Kaito', 'Kara', 'Kenji', 'Layla', 'Leo',
        'Liam', 'Lily', 'Logan', 'Lucas', 'Luna', 'Malik', 'Maria', 'Mia',
        'Mohammed', 'Nadia', 'Nathan', 'Nia', 'Noah', 'Nora', 'Oliver', 'Omar',
        'Owen', 'Priya', 'Rafael', 'Rin', 'Riya', 'Rosa', 'Ryan', 'Sakura',
        'Samuel', 'Sara', 'Sebastian', 'Sofia', 'Sora', 'Takeshi', 'Tariq', 'Thomas',
        'Victoria', 'William', 'Yuki', 'Zara', 'Adriana', 'Andre', 'Beatriz', 'Blake',
        'Caleb', 'Carmen', 'Dante', 'Dina', 'Eric', 'Eva', 'Felix', 'Grace',
        'Hannah', 'Ian', 'Jade', 'Jordan', 'Kira', 'Leah', 'Marco', 'Maya',
        'Naomi', 'Oscar', 'Paola', 'Quinn', 'Reese', 'Riley', 'Sami', 'Tara',
        'Uma', 'Victor', 'Wendy', 'Xavier', 'Yara', 'Zoe', 'Abel', 'Bianca',
        'Cruz', 'Daphne', 'Eli', 'Fiona', 'Gavin', 'Helena', 'Ivan', 'Julia',
        'Khalil', 'Lucia', 'Mateo', 'Nina', 'Orion', 'Petra', 'Ramon', 'Selena',
        'Theo', 'Ursula', 'Vivian', 'Wesley', 'Ximena', 'Yosef', 'Zuri', 'Amir',
        'Briana', 'Cyrus', 'Dahlia', 'Elio', 'Freya', 'Gage', 'Hector', 'Ingrid',
        'Javier', 'Kaya', 'Lorenzo', 'Mika', 'Nico', 'Olive', 'Paloma', 'River'
    ];

    const lastNames = [
        'Nakamura', 'Gonzalez', 'Kim', 'Patel', 'O\'Brien', 'Santos', 'Schmidt', 'Wang',
        'Johnson', 'Garcia', 'Williams', 'Brown', 'Lee', 'Martinez', 'Anderson', 'Thomas',
        'Taylor', 'Moore', 'Jackson', 'Martin', 'Tanaka', 'Muller', 'Silva', 'Johansson',
        'Chen', 'Ali', 'Rossi', 'Fernandez', 'Dubois', 'Ivanov', 'Yamamoto', 'Cruz',
        'Park', 'Nguyen', 'Singh', 'Sato', 'Costa', 'Petrov', 'Hansen', 'Larsen',
        'Rivera', 'Torres', 'Takahashi', 'Meyer', 'Berg', 'Eriksson', 'Lopez', 'Morales',
        'Suzuki', 'Fischer', 'Okafor', 'Reyes', 'Volkov', 'Becker', 'Ortiz', 'Hoffman',
        'Diaz', 'Reed', 'Brooks', 'Kelly', 'Ruiz', 'Cox', 'Ward', 'Long',
        'Murphy', 'Sullivan', 'Bennett', 'Cooper', 'Hart', 'West', 'Stone', 'Fox',
        'Delgado', 'Vega', 'Ishida', 'Watanabe', 'Kato', 'Shimizu', 'Morita', 'Choi'
    ];

    const clubPool = [
        'Rising Sun Karate', 'Midwest Martial Arts Dojo', 'Heartland Dojo',
        'Sakura Karate Dojo', 'Iron Fist Martial Arts', 'Pacific Coast Karate',
        'Dragon Spirit Dojo', 'Mountain View Karate', 'Thunder Bay Martial Arts',
        'Golden Tiger Dojo'
    ];

    const defaultRanks = ['White', 'Yellow', 'Orange', 'Green', 'Blue', 'Purple', 'Brown', '1st Dan', '2nd Dan', '3rd Dan'];

    // ── Utility: shuffle array ──
    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    // ── STEP 0: Validate prerequisites ──
    const eventTypes = db.load('eventTypes');
    const nonDefaultEvents = eventTypes.filter(e => !e.isDefault);
    const defaultEvent = eventTypes.find(e => e.isDefault);

    if (nonDefaultEvents.length === 0) {
        showMessage('Please create at least one non-default event type first.', 'error');
        return;
    }

    const divisions = db.load('divisions');
    let hasTemplates = false;
    for (const event of nonDefaultEvents) {
        const eventData = divisions[event.id];
        if (eventData && eventData.templates && eventData.templates.length > 0) {
            hasTemplates = true;
            break;
        }
    }
    if (!hasTemplates) {
        showMessage('Please create division templates for at least one event first.', 'error');
        return;
    }

    // ── STEP 1: Clear existing data (scoped to currentTournamentId) ──
    console.log('=== GENERATE TEST COMPETITORS: STEP 1 — Clearing existing data ===');

    // Delete competitors for current tournament only
    const allCompetitors = db.load('competitors');
    const tournamentCompetitors = currentTournamentId
        ? allCompetitors.filter(c => c.tournamentId === currentTournamentId)
        : allCompetitors;
    tournamentCompetitors.forEach(c => db.delete('competitors', c.id));
    console.log(`  Deleted ${tournamentCompetitors.length} competitors`);

    // Clear generated divisions (keep templates)
    const eventIds = nonDefaultEvents.map(e => e.id);
    for (const eventId of eventIds) {
        if (divisions[eventId]) {
            divisions[eventId].generated = {};
        }
    }
    localStorage.setItem(_scopedKey('divisions'), JSON.stringify(divisions));
    console.log('  Cleared generated divisions');

    // Clear brackets for current tournament's events
    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
    const bracketIdsToDelete = [];
    for (const [bracketId, bracket] of Object.entries(brackets)) {
        if (eventIds.includes(bracket.eventId)) {
            bracketIdsToDelete.push(bracketId);
        }
    }
    bracketIdsToDelete.forEach(id => delete brackets[id]);
    saveBrackets(brackets);
    console.log(`  Deleted ${bracketIdsToDelete.length} brackets`);

    // Clear teams for current tournament's events
    const teams = JSON.parse(localStorage.getItem(_scopedKey('teams')) || '{}');
    const teamCodesToDelete = [];
    for (const [code, team] of Object.entries(teams)) {
        if (eventIds.includes(team.eventId)) {
            teamCodesToDelete.push(code);
        }
    }
    teamCodesToDelete.forEach(code => delete teams[code]);
    localStorage.setItem(_scopedKey('teams'), JSON.stringify(teams));
    _debouncedSync('teams', _syncTeamsToServer, 2000);
    console.log(`  Deleted ${teamCodesToDelete.length} teams`);

    // ── STEP 2: Ensure 6-8 clubs ──
    console.log('=== STEP 2 — Ensuring clubs ===');
    let existingClubs = db.load('clubs');
    const existingClubNames = new Set(existingClubs.map(c => c.name));
    const shuffledClubPool = shuffle(clubPool);

    for (const name of shuffledClubPool) {
        if (existingClubs.length >= 8) break;
        if (!existingClubNames.has(name)) {
            db.add('clubs', {
                name: name,
                logo: null,
                country: '',
                createdAt: new Date().toISOString()
            });
            existingClubNames.add(name);
        }
    }
    existingClubs = db.load('clubs');
    const clubNames = existingClubs.map(c => c.name);
    console.log(`  ${clubNames.length} clubs available: ${clubNames.join(', ')}`);

    // ── STEP 3: Read tournament structure ──
    console.log('=== STEP 3 — Reading tournament structure ===');
    const tournaments = db.load('tournaments');
    const currentTournament = tournaments.find(t => t.id === currentTournamentId);
    const ageMethod = currentTournament?.ageCalculationMethod || 'aau-standard';
    const eventDate = currentTournament?.date || new Date().toISOString();

    // ── STEP 4: Enumerate all division slots from templates ──
    console.log('=== STEP 4 — Enumerating division slots ===');

    // Build Cartesian product of ranges for each template
    function enumerateRangeCombinations(criteria) {
        if (!criteria || criteria.length === 0) return [{}];

        let combos = [{}];
        for (const criterion of criteria) {
            const newCombos = [];
            for (const existing of combos) {
                for (const range of criterion.ranges) {
                    newCombos.push({ ...existing, [criterion.type]: range });
                }
            }
            combos = newCombos;
        }
        return combos;
    }

    // Generate a DOB that produces the target age under the tournament's age method
    function generateDOB(targetAge) {
        const safeEvt = (typeof eventDate === 'string' && eventDate.length === 10) ? new Date(eventDate + 'T12:00:00') : new Date(eventDate);
        let refDate;
        if (ageMethod === 'wkf-standard') {
            const year = safeEvt.getFullYear();
            refDate = new Date(year, 11, 31);
        } else if (ageMethod === 'aau-standard') {
            refDate = safeEvt;
        } else {
            refDate = new Date();
        }

        const birthYear = refDate.getFullYear() - targetAge;
        // Pick a random month/day that keeps us within the target age
        // To be safe, pick months 1-10 of the birth year (ensures age is targetAge on refDate)
        const birthMonth = Math.floor(Math.random() * 10) + 1; // Jan-Oct
        const birthDay = Math.floor(Math.random() * 28) + 1;
        const dob = `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;

        // Verify and adjust if needed
        const computed = calculateAge(dob, ageMethod, eventDate);
        if (computed !== targetAge) {
            // Off by one — shift the birth year
            const adjustedYear = birthYear + (computed - targetAge);
            return `${adjustedYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;
        }
        return dob;
    }

    // Realistic weight ranges by age when no weight criterion is specified
    function realisticWeight(age) {
        if (age <= 7) return 18 + Math.random() * 10;
        if (age <= 10) return 25 + Math.random() * 15;
        if (age <= 13) return 30 + Math.random() * 25;
        if (age <= 17) return 45 + Math.random() * 30;
        return 55 + Math.random() * 40;
    }

    // Collect all division slots: { eventId, template, combo, isTeam, teamSize }
    const divisionSlots = [];

    for (const event of nonDefaultEvents) {
        const eventData = divisions[event.id];
        if (!eventData || !eventData.templates || eventData.templates.length === 0) {
            console.log(`  Skipping event "${event.name}" — no templates`);
            continue;
        }

        for (const template of eventData.templates) {
            const combos = enumerateRangeCombinations(template.criteria);
            for (const combo of combos) {
                divisionSlots.push({
                    eventId: event.id,
                    eventName: event.name,
                    template: template,
                    combo: combo,
                    isTeam: event.teamSize > 1,
                    teamSize: event.teamSize || 1
                });
            }
        }
    }

    console.log(`  Found ${divisionSlots.length} division slots across all events`);

    if (divisionSlots.length === 0) {
        showMessage('No division templates found. Please create templates first.', 'error');
        return;
    }

    // ── Calculate per-slot competitor counts to target ~100 total ──
    const TARGET = 100;

    // Separate team and individual slots
    const individualSlots = divisionSlots.filter(s => !s.isTeam);
    const teamSlots = divisionSlots.filter(s => s.isTeam);

    // For team slots, each "entry" is teamSize competitors
    // Target entries per team slot: 3-5 teams
    const teamEntries = teamSlots.reduce((sum, s) => sum + 4 * s.teamSize, 0); // estimate 4 teams average
    const remainingForIndividual = Math.max(TARGET - teamEntries, individualSlots.length * 2);

    let perSlotIndividual;
    if (individualSlots.length > 0) {
        perSlotIndividual = Math.round(remainingForIndividual / individualSlots.length);
        perSlotIndividual = Math.max(2, Math.min(10, perSlotIndividual));
    } else {
        perSlotIndividual = 0;
    }

    // Vary per-slot counts for realism
    function varyCount(base) {
        const variation = Math.floor(Math.random() * 5) - 2; // -2 to +2
        return Math.max(2, base + variation);
    }

    // ── STEP 5: Generate competitors ──
    console.log('=== STEP 5 — Generating competitors ===');

    const shuffledFirst = shuffle(firstNames);
    const shuffledLast = shuffle(lastNames);
    const usedNames = new Set();
    let nameIndex = 0;

    function getUniqueName() {
        // Try combinations until we find an unused one
        for (let attempt = 0; attempt < 500; attempt++) {
            const fi = (nameIndex + attempt) % shuffledFirst.length;
            const li = Math.floor((nameIndex + attempt) / shuffledFirst.length + attempt) % shuffledLast.length;
            const fullName = `${shuffledFirst[fi]}|${shuffledLast[li]}`;
            if (!usedNames.has(fullName)) {
                usedNames.add(fullName);
                nameIndex++;
                return { firstName: shuffledFirst[fi], lastName: shuffledLast[li] };
            }
        }
        // Fallback: add numeric suffix
        nameIndex++;
        const fi = nameIndex % shuffledFirst.length;
        const li = nameIndex % shuffledLast.length;
        return { firstName: shuffledFirst[fi], lastName: shuffledLast[li] + nameIndex };
    }

    let clubIndex = 0;
    function nextClub() {
        const club = clubNames[clubIndex % clubNames.length];
        clubIndex++;
        return club;
    }

    const competitorsToCreate = [];
    const perEventCount = {};
    const perClubCount = {};

    // Process individual division slots
    for (const slot of individualSlots) {
        const count = varyCount(perSlotIndividual);
        for (let i = 0; i < count; i++) {
            const comp = buildCompetitorFromSlot(slot);
            if (comp) competitorsToCreate.push(comp);
        }
    }

    // Process team division slots
    for (const slot of teamSlots) {
        const numTeams = Math.max(3, Math.min(6, varyCount(4)));
        for (let t = 0; t < numTeams; t++) {
            const teamCode = `TEAM-${slot.eventId}-${generateUniqueId()}`;
            const teamName = `${nextClub()} Team ${t + 1}`;
            const teamClub = clubNames[(clubIndex - 1) % clubNames.length]; // Use the club that was just picked

            for (let m = 0; m < slot.teamSize; m++) {
                const comp = buildCompetitorFromSlot(slot, teamCode, teamName, teamClub);
                if (comp) competitorsToCreate.push(comp);
            }
        }
    }

    function buildCompetitorFromSlot(slot, teamCode, teamName, forcedClub) {
        const { combo, eventId, isTeam, teamSize } = slot;
        const { firstName, lastName } = getUniqueName();
        const club = forcedClub || nextClub();

        // Determine attributes from the range combination
        let age, gender, weight, rank, experience;

        // Age
        if (combo.age) {
            const minAge = Math.ceil(combo.age.min);
            const maxAge = Math.floor(combo.age.max);
            age = minAge + Math.floor(Math.random() * (maxAge - minAge + 1));
        } else {
            age = 8 + Math.floor(Math.random() * 25); // 8-32 default
        }

        // Gender
        if (combo.gender) {
            if (combo.gender.value === 'Open') {
                gender = Math.random() < 0.5 ? 'Male' : 'Female';
            } else {
                gender = combo.gender.value;
            }
        } else {
            gender = Math.random() < 0.5 ? 'Male' : 'Female';
        }

        // Weight
        if (combo.weight) {
            const wMin = combo.weight.min;
            const wMax = Math.min(combo.weight.max, 200); // Cap unreasonable max
            weight = parseFloat((wMin + Math.random() * (wMax - wMin)).toFixed(1));
        } else {
            weight = parseFloat(realisticWeight(age).toFixed(1));
        }

        // Rank
        if (combo.rank) {
            rank = combo.rank.value;
        } else {
            // Pick a rank realistic for the age
            if (age <= 10) rank = defaultRanks[Math.floor(Math.random() * 4)]; // White-Green
            else if (age <= 15) rank = defaultRanks[Math.floor(Math.random() * 6)]; // White-Purple
            else rank = defaultRanks[Math.floor(Math.random() * defaultRanks.length)];
        }

        // Experience
        if (combo.experience) {
            const eMin = combo.experience.min;
            const eMax = combo.experience.max;
            experience = parseFloat((eMin + Math.random() * (eMax - eMin)).toFixed(1));
        } else {
            // Realistic: roughly correlated with rank
            const rankIdx = defaultRanks.indexOf(rank);
            experience = parseFloat((Math.max(0, rankIdx * 0.8 + Math.random() * 1.5 - 0.5)).toFixed(1));
        }

        // DOB
        const dateOfBirth = generateDOB(age);

        // Events: this event + default event
        const events = [eventId];
        if (defaultEvent && !events.includes(defaultEvent.id)) {
            events.push(defaultEvent.id);
        }

        // Track counts
        perEventCount[slot.eventName] = (perEventCount[slot.eventName] || 0) + 1;
        perClubCount[club] = (perClubCount[club] || 0) + 1;

        return {
            firstName,
            lastName,
            dateOfBirth,
            weight,
            rank,
            experience,
            gender,
            club,
            clubLogo: null,
            photo: null,
            events,
            teamCode: teamCode || null,
            teamName: teamName || null,
            registrationDate: new Date().toISOString(),
            tournamentId: currentTournamentId
        };
    }

    console.log(`  Prepared ${competitorsToCreate.length} competitors`);

    // ── STEP 6: Save competitors and auto-assign to divisions ──
    console.log('=== STEP 6 — Saving and auto-assigning ===');

    let successCount = 0;
    let failCount = 0;

    // For team events, we need to create team entries
    const teamRegistry = JSON.parse(localStorage.getItem(_scopedKey('teams')) || '{}');

    for (const comp of competitorsToCreate) {
        const competitorId = db.add('competitors', comp);

        // Register team if this is a team competitor
        if (comp.teamCode) {
            if (!teamRegistry[comp.teamCode]) {
                const teamEvent = nonDefaultEvents.find(e => comp.events.includes(e.id) && e.teamSize > 1);
                teamRegistry[comp.teamCode] = {
                    code: comp.teamCode,
                    name: comp.teamName,
                    eventId: teamEvent ? teamEvent.id : comp.events[0],
                    maxSize: teamEvent ? teamEvent.teamSize : 3,
                    captainName: `${comp.firstName} ${comp.lastName}`,
                    members: [competitorId],
                    createdAt: new Date().toISOString()
                };
            } else {
                teamRegistry[comp.teamCode].members.push(competitorId);
            }
        }

        // Auto-assign to divisions (creates generated divisions and brackets)
        try {
            autoAssignToDivisions(comp, competitorId);
            successCount++;
        } catch (error) {
            console.warn(`  Failed to assign ${comp.firstName} ${comp.lastName}: ${error.message}`);
            failCount++;
        }
    }

    // Save team registry
    localStorage.setItem(_scopedKey('teams'), JSON.stringify(teamRegistry));
    _debouncedSync('teams', _syncTeamsToServer, 2000);

    // ── STEP 7: Refresh UI and log summary ──
    syncCompetitorClubsToTable();
    loadCompetitors(true);
    loadClubs(true);
    loadDashboard();

    // Log summary
    console.log('=== TEST COMPETITOR GENERATION SUMMARY ===');
    console.log(`  Total created: ${competitorsToCreate.length}`);
    console.log(`  Successfully assigned: ${successCount}`);
    console.log(`  Failed assignments: ${failCount}`);
    console.log('  Per-event breakdown:');
    for (const [name, count] of Object.entries(perEventCount).sort((a, b) => b[1] - a[1])) {
        console.log(`    ${name}: ${count}`);
    }
    console.log('  Per-club breakdown:');
    for (const [name, count] of Object.entries(perClubCount).sort((a, b) => b[1] - a[1])) {
        console.log(`    ${name}: ${count}`);
    }

    const teamCount = Object.keys(teamRegistry).length - teamCodesToDelete.length;
    const teamMsg = teamCount > 0 ? ` (${teamCount} teams)` : '';

    showMessage(
        `✓ Generated ${competitorsToCreate.length} test competitors${teamMsg} across ${Object.keys(perEventCount).length} events and ${clubNames.length} dojos. ${failCount > 0 ? `(${failCount} assignment failures)` : ''}`,
        'success'
    );
}

function clearAllCompetitors() {
    if (confirm('⚠️ WARNING: This will delete ALL competitors, divisions, and scheduled matches permanently!\n\nAre you absolutely sure you want to continue?')) {
        if (confirm('This action CANNOT be undone! Click OK to confirm deletion of all competitors, divisions, and matches.')) {
            // Clear competitors
            db.clear('competitors');

            // Clear all divisions for current tournament
            localStorage.setItem(_scopedKey('divisions'), JSON.stringify({}));

            // Clear mat schedule
            localStorage.setItem(_scopedKey('matSchedule'), JSON.stringify({}));

            // Clear matches
            db.clear('matches');

            // Clear brackets
            localStorage.setItem(_scopedKey('brackets'), JSON.stringify({}));

            // Reload views
            loadCompetitors();
            loadDashboard();

            // Also reload divisions view if needed
            const divisionsContainer = document.getElementById('divisions-container');
            if (divisionsContainer) {
                divisionsContainer.innerHTML = '<p style="color: var(--text-secondary);">No divisions generated yet. Create a template and click "Generate Divisions".</p>';
            }

            showMessage('All competitors, divisions, and matches have been deleted!');
        }
    }
}

function exportCompetitors() {
    const competitors = db.load('competitors');
    const csv = convertToCSV(competitors);
    downloadCSV(csv, 'competitors.csv');
}

// ═══════════════════════════════════════════════════════════════════════════
// CLUB MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

let currentClubLogoData = null;
let editingClubId = null; // Track if we're editing an existing club

function showClubForm() {
    editingClubId = null; // Reset to add mode
    currentClubLogoData = null;
    document.getElementById('club-form-container').classList.remove('hidden');
    document.getElementById('club-form').reset();
    document.getElementById('club-logo-preview')?.classList.add('hidden');

    // Update form title
    const formTitle = document.querySelector('#club-form-container h3');
    if (formTitle) formTitle.textContent = 'Dojo Registration';
}

window.editClub = function(id) {
    const clubs = db.load('clubs');
    const club = clubs.find(c => c.id === id);

    if (!club) {
        showMessage('Dojo not found', 'error');
        return;
    }

    // Set edit mode
    editingClubId = id;

    // Populate form fields
    document.getElementById('club-name').value = club.name;
    document.getElementById('club-country').value = club.country || '';

    // Handle logo
    if (club.logo) {
        currentClubLogoData = club.logo;
        const preview = document.getElementById('club-logo-preview');
        const img = document.getElementById('club-logo-preview-img');
        if (img) img.src = club.logo;
        if (preview) preview.classList.remove('hidden');
    } else {
        currentClubLogoData = null;
        document.getElementById('club-logo-preview')?.classList.add('hidden');
    }

    // Show form and update title
    document.getElementById('club-form-container').classList.remove('hidden');
    const formTitle = document.querySelector('#club-form-container h3');
    if (formTitle) formTitle.textContent = 'Edit Dojo';
};

function hideClubForm() {
    editingClubId = null;
    const container = document.getElementById('club-form-container');
    const form = document.getElementById('club-form');
    if (container) container.classList.add('hidden');
    if (form) form.reset();
    currentClubLogoData = null;
    document.getElementById('club-logo-preview')?.classList.add('hidden');
}

// Club logo upload handler (with compression)
document.getElementById('club-logo')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            // Compress to 200x200 max
            compressImage(event.target.result, 200, 200, 0.8).then(compressed => {
                currentClubLogoData = compressed;
                const preview = document.getElementById('club-logo-preview');
                const img = document.getElementById('club-logo-preview-img');
                if (img) img.src = currentClubLogoData;
                if (preview) preview.classList.remove('hidden');
            });
        };
        reader.readAsDataURL(file);
    }
});

function clearClubLogo() {
    currentClubLogoData = null;
    document.getElementById('club-logo').value = '';
    document.getElementById('club-logo-preview')?.classList.add('hidden');
}

// Club form submission
document.getElementById('club-form')?.addEventListener('submit', (e) => {
    e.preventDefault();

    const clubName = document.getElementById('club-name').value.trim();
    const clubs = db.load('clubs');

    // Check if club name already exists (but allow keeping same name when editing)
    const existingClub = clubs.find(c => c.name.toLowerCase() === clubName.toLowerCase() && c.id !== editingClubId);

    if (existingClub) {
        showMessage('A dojo with this name already exists', 'error');
        return;
    }

    if (editingClubId) {
        // Edit mode - update existing club
        const clubIndex = clubs.findIndex(c => c.id === editingClubId);
        if (clubIndex === -1) {
            showMessage('Dojo not found', 'error');
            return;
        }

        const oldClubName = clubs[clubIndex].name;

        clubs[clubIndex] = {
            ...clubs[clubIndex],
            name: clubName,
            country: document.getElementById('club-country').value.trim() || '',
            logo: currentClubLogoData || null,
            updatedAt: new Date().toISOString()
        };

        localStorage.setItem(_scopedKey('clubs'), JSON.stringify(clubs));

        // If club name changed, update all competitors with this club
        if (oldClubName !== clubName) {
            const competitors = db.load('competitors');
            let updatedCount = 0;
            competitors.forEach(comp => {
                if (comp.club === oldClubName) {
                    comp.club = clubName;
                    updatedCount++;
                }
            });
            if (updatedCount > 0) {
                localStorage.setItem(_scopedKey('competitors'), JSON.stringify(competitors));
            }
        }

        showMessage('Dojo updated successfully!');
    } else {
        // Add mode - create new club
        const club = {
            name: clubName,
            country: document.getElementById('club-country').value.trim() || '',
            logo: currentClubLogoData || null,
            createdAt: new Date().toISOString()
        };

        db.add('clubs', club);
        showMessage('Dojo added successfully!');
    }

    hideClubForm();
    loadClubs();
    loadClubDropdown(); // Refresh dropdown in competitor form
});

function syncCompetitorClubsToTable() {
    // Sync all competitor clubs to the clubs table
    const clubs = db.load('clubs');
    const competitors = db.load('competitors');

    if (competitors.length === 0) return; // Nothing to sync

    const existingClubNames = clubs.map(c => c.name.toLowerCase());
    let addedCount = 0;

    competitors.forEach(comp => {
        if (comp.club && !existingClubNames.includes(comp.club.toLowerCase())) {
            // This club doesn't exist in clubs table, add it
            console.log('Adding club to table:', comp.club);
            const newClub = {
                name: comp.club,
                logo: comp.clubLogo || null,
                country: '',
                createdAt: new Date().toISOString()
            };
            db.add('clubs', newClub);
            existingClubNames.push(comp.club.toLowerCase()); // Prevent duplicates in this run
            addedCount++;
        }
    });

    if (addedCount > 0) {
        console.log(`Added ${addedCount} clubs from competitors to clubs table`);
    }
}

function loadClubs(skipSync = false) {
    // First sync competitor clubs to ensure all clubs are in the table (unless already synced)
    if (!skipSync) {
        syncCompetitorClubsToTable();
    }

    const clubs = db.load('clubs');
    const competitors = db.load('competitors');
    const tbody = document.getElementById('clubs-tbody');

    if (!tbody) return;

    tbody.innerHTML = '';

    if (clubs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">No dojos registered yet. Click "Add Dojo" to get started.</td></tr>';
        return;
    }

    clubs.forEach(club => {
        const tr = document.createElement('tr');

        // Count members from competitors
        const memberCount = competitors.filter(c => c.club === club.name).length;

        const logoHtml = club.logo
            ? `<img src="${club.logo}" class="table-photo" alt="${club.name}" style="width: 50px; height: 50px; object-fit: contain;">`
            : '<div style="width: 50px; height: 50px; background: var(--glass-bg); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 10px; text-align: center;">No Logo</div>';

        tr.innerHTML = `
            <td>${logoHtml}</td>
            <td><strong>${club.name}</strong></td>
            <td>${club.country || '-'}</td>
            <td>${memberCount}</td>
            <td>
                <button class="btn btn-small" onclick="editClub(${club.id})">Edit</button>
                <button class="btn btn-small btn-danger" onclick="deleteClub(${club.id})">Delete</button>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

function deleteClub(id) {
    const clubs = db.load('clubs');
    const club = clubs.find(c => c.id === id);

    if (!club) return;

    // Check if club has members
    const competitors = db.load('competitors');
    const memberCount = competitors.filter(c => c.club === club.name).length;

    let confirmMsg = `Are you sure you want to delete "${club.name}"?`;
    if (memberCount > 0) {
        confirmMsg += `\n\nWarning: This dojo has ${memberCount} registered competitor(s). They will still show the dojo name but the dojo logo will be removed.`;
    }

    if (confirm(confirmMsg)) {
        db.delete('clubs', id);
        loadClubs();
        loadClubDropdown();
        showMessage('Dojo deleted successfully!');
    }
}

function clearAllClubs() {
    const clubs = db.load('clubs');
    const competitors = db.load('competitors');
    const totalMembers = competitors.length;

    if (confirm(`⚠️ WARNING: This will delete ALL ${clubs.length} dojos!\n\n${totalMembers} competitors are registered. Their dojo names will remain but dojo logos will be removed.\n\nAre you sure?`)) {
        db.clear('clubs');
        loadClubs();
        loadClubDropdown();
        showMessage('All dojos deleted!');
    }
}

function filterClubs() {
    const searchTerm = document.getElementById('club-search').value.toLowerCase();
    const rows = document.querySelectorAll('#clubs-tbody tr');

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// Instructor Management
let currentInstructorClubLogoData = null;

function showInstructorForm() {
    document.getElementById('instructor-form-container').classList.remove('hidden');
    loadClubDropdown();
}

// Instructor club logo preview
document.getElementById('instructor-club-logo')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            currentInstructorClubLogoData = event.target.result;
            const preview = document.getElementById('instructor-club-logo-preview-img');
            if (preview) {
                preview.src = currentInstructorClubLogoData;
                document.getElementById('instructor-club-logo-preview').classList.remove('hidden');
            }
        };
        reader.readAsDataURL(file);
    }
});

function clearInstructorClubLogo() {
    currentInstructorClubLogoData = null;
    const input = document.getElementById('instructor-club-logo');
    const preview = document.getElementById('instructor-club-logo-preview');
    if (input) input.value = '';
    if (preview) preview.classList.add('hidden');
}

// Instructor form - only add listener if element exists
const instructorForm = document.getElementById('instructor-form');
if (instructorForm) {
    instructorForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const clubName = document.getElementById('instructorClub').value;

        const instructor = {
            firstName: document.getElementById('instructorFirstName').value,
            lastName: document.getElementById('instructorLastName').value,
            rank: document.getElementById('instructorRank').value,
            club: clubName,
            email: document.getElementById('instructorEmail').value,
            phone: document.getElementById('instructorPhone').value || null,
            registrationDate: new Date().toISOString()
        };

        // Save club data with logo
        if (currentInstructorClubLogoData) {
            saveClubData(clubName, currentInstructorClubLogoData);
        }

        db.add('instructors', instructor);
        showMessage('Instructor registered successfully!');
        hideInstructorForm();
        loadInstructors();
        loadClubDropdown(); // Refresh club dropdown for competitors
        currentInstructorClubLogoData = null;
    });
}

function loadInstructors() {
    const instructors = db.load('instructors');
    const tbody = document.getElementById('instructors-tbody');

    if (!tbody) return;

    tbody.innerHTML = '';

    instructors.forEach(instructor => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${instructor.firstName} ${instructor.lastName}</td>
            <td>${instructor.rank}</td>
            <td>${instructor.club}</td>
            <td>${instructor.email}</td>
            <td>${instructor.phone || '-'}</td>
            <td>
                <button class="btn btn-small btn-danger" onclick="deleteInstructor(${instructor.id})">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function deleteInstructor(id) {
    if (confirm('Are you sure you want to delete this instructor?')) {
        db.delete('instructors', id);
        loadInstructors();
        loadClubDropdown(); // Refresh club dropdown
        showMessage('Instructor deleted successfully!');
    }
}

function clearAllInstructors() {
    if (confirm('⚠️ WARNING: This will delete ALL instructors and their dojos permanently!\n\nAre you absolutely sure you want to continue?')) {
        if (confirm('This action CANNOT be undone! Click OK to confirm deletion of all instructors.')) {
            db.clear('instructors');
            db.clear('clubs');
            loadInstructors();
            loadClubDropdown();
            loadDashboard();
            showMessage('All instructors and dojos have been deleted!');
        }
    }
}

function filterInstructors() {
    const searchTerm = document.getElementById('instructor-search').value.toLowerCase();
    const rows = document.querySelectorAll('#instructors-tbody tr');

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

function filterCompetitors() {
    const searchTerm = document.getElementById('competitor-search')?.value.toLowerCase() || '';
    const rows = document.querySelectorAll('#competitors-tbody tr');

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// Club Management
// Duplicate club form functions removed - using the ones at line ~939 with logo support

// Duplicate loadClubs() function removed - using the one at line ~1034 with sync functionality
// Duplicate deleteClub() function removed - using the one at line ~2178

function updateClubSelects() {
    const clubs = db.load('clubs');
    const selects = [
        document.getElementById('club'),
        document.getElementById('instructorClub')
    ].filter(Boolean); // Filter out null elements

    selects.forEach(select => {
        if (!select) return; // Skip if element doesn't exist

        const currentValue = select.value;
        select.innerHTML = '<option value="">Select Dojo</option>';
        clubs.forEach(club => {
            const option = document.createElement('option');
            option.value = club.name;
            option.textContent = club.name;
            select.appendChild(option);
        });
        select.value = currentValue;
    });
}

// Instructor Management
// Duplicate instructor form functions removed - using the ones at line ~1124 with club dropdown loading

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EVENT TYPE MANAGEMENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ROUTE: Events tab → "Create Event Type" → Event form
 *
 * SIMPLIFIED STRUCTURE (2026-02-14):
 * Event types now ONLY define basic event info. Scoreboard type and bracket
 * type are configured at the DIVISION level for maximum flexibility.
 *
 * FLOW:
 * 1. User clicks "Create Event Type"
 * 2. showEventForm() opens simplified form (name, description, price, isDefault)
 * 3. User fills in basic event details
 * 4. Form submission validates default event uniqueness
 * 5. Event saved to eventTypes[] array
 * 6. loadEventTypes() displays event cards
 *
 * DATA STRUCTURE:
 * eventTypes = [
 *   {
 *     id: timestamp,
 *     name: "Youth Kata",
 *     description: "Kata competition for youth divisions",
 *     price: 25.00,                    // Registration fee
 *     isDefault: false,                // If true, auto-included for all competitors
 *     createdAt: "ISO timestamp"
 *   }
 * ]
 *
 * DEFAULT EVENT PRICING MODEL:
 * - ONE event can be marked as "default" (base registration fee)
 * - Default event is automatically included for all competitors
 * - Default event does NOT show as checkbox in registration form
 * - All other events are "add-ons" shown as checkboxes
 * - Total cost = Default event price + Sum of selected add-on prices
 * - handleDefaultEventChange() prevents multiple defaults
 *
 * ✅ FEATURES (2026-02-14):
 * 1. ✅ REMOVED: scoreboardType, bracketType, matchDuration, bufferTime, etc
 * 2. ✅ MOVED: Scoreboard and bracket configuration to division level
 * 3. ✅ ADDED: isDefault flag for base registration fee model
 * 4. ✅ ADDED: description field for event details
 * 5. ✅ Simplified event cards showing only name, description, price, default status
 * 6. ✅ Default event validation (only one allowed)
 * 7. ✅ Registration form hides default event, auto-includes it in competitor.events[]
 *
 * ⚠️ KNOWN ISSUES:
 * 1. No validation for event name uniqueness
 * 2. No edit functionality for existing events
 * 3. Deleting event doesn't clean up divisions/brackets
 * 4. No warning if deleting the default event
 *
 * 📝 TODO:
 * - Add event name uniqueness validation
 * - Add edit event functionality
 * - Cascade delete to divisions/brackets when event deleted
 * - Warn user when deleting default event
 *
 * Last Updated: 2026-02-14
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Event Type Management
function showEventForm() {
    document.getElementById('event-form-container').classList.remove('hidden');
}

function hideEventForm() {
    const container = document.getElementById('event-form-container');
    const form = document.getElementById('event-form');
    if (container) container.classList.add('hidden');
    if (form) form.reset();
}

function handleDefaultEventChange() {
    const isDefault = document.getElementById('event-is-default').checked;

    if (isDefault) {
        const eventTypes = db.load('eventTypes');
        const existingDefault = eventTypes.find(et => et.isDefault);

        if (existingDefault) {
            showToast(`Note: "${existingDefault.name}" is currently the default event. Saving this event as default will replace it.`, 'warning');
        }
    }
}

// Event form submission
const eventForm = document.getElementById('event-form');
if (eventForm) {
    eventForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const isDefault = document.getElementById('event-is-default').checked;

        // If this is being set as default, check if another event is already default
        if (isDefault) {
            const eventTypes = db.load('eventTypes');
            const existingDefault = eventTypes.find(et => et.isDefault);

            if (existingDefault) {
                const confirm = window.confirm(
                    `"${existingDefault.name}" is currently the default event.\n\n` +
                    `Do you want to make "${document.getElementById('event-name').value}" the new default event instead?`
                );

                if (!confirm) {
                    return; // User cancelled
                }

                // Remove default flag from existing default event
                existingDefault.isDefault = false;
                db.save('eventTypes', eventTypes);
            }
        }

        const basePriceVal = document.getElementById('event-base-price')?.value;
        const addOnPriceVal = document.getElementById('event-addon-price')?.value;

        const eventType = {
            name: document.getElementById('event-name').value,
            description: document.getElementById('event-description').value || '',
            teamSize: parseInt(document.getElementById('event-team-size').value) || 1,
            // Tiered pricing overrides (null = use tournament default)
            basePrice: basePriceVal !== '' && basePriceVal != null ? parseFloat(basePriceVal) : null,
            addOnPrice: addOnPriceVal !== '' && addOnPriceVal != null ? parseFloat(addOnPriceVal) : null,
            // Legacy price field for backward compat
            price: basePriceVal !== '' && basePriceVal != null ? parseFloat(basePriceVal) : 0,
            isDefault: isDefault,
            createdAt: new Date().toISOString()
        };

        // Initialize event types storage if needed
        if (!localStorage.getItem(_scopedKey('eventTypes'))) {
            localStorage.setItem(_scopedKey('eventTypes'), JSON.stringify([]));
        }

        db.add('eventTypes', eventType);
        showMessage('Event type created successfully!');
        hideEventForm();
        loadEventTypes();
        loadEventTypeSelector();
    });
}

function loadEventTypes() {
    const eventTypes = db.load('eventTypes');
    const container = document.getElementById('events-container');

    if (!container) return;

    container.innerHTML = '';

    if (eventTypes.length === 0) {
        container.innerHTML = '<p class="hint">No event types created yet. Click "Create Event Type" to get started.</p>';
        return;
    }

    const tournament = getCurrentTournament ? getCurrentTournament() : null;
    const globalBase = tournament?.pricing?.basePrice ?? 75.00;
    const globalAddOn = tournament?.pricing?.addOnPrice ?? 25.00;

    eventTypes.forEach(event => {
        const card = document.createElement('div');
        card.className = 'event-card';

        const teamSizeLabel = event.teamSize > 1 ? `Team of ${event.teamSize}` : 'Individual';

        // Show resolved prices (per-event override or tournament default)
        const resolvedBase = event.basePrice != null ? event.basePrice : globalBase;
        const resolvedAddOn = event.addOnPrice != null ? event.addOnPrice : globalAddOn;
        const hasOverride = event.basePrice != null || event.addOnPrice != null;
        const priceHtml = `
            <div class="event-detail">
                <strong>As Primary:</strong> $${resolvedBase.toFixed(2)}${hasOverride && event.basePrice != null ? ' <span style="color:var(--accent);font-size:11px;">(override)</span>' : ''}
            </div>
            <div class="event-detail">
                <strong>As Add-On:</strong> $${resolvedAddOn.toFixed(2)}${hasOverride && event.addOnPrice != null ? ' <span style="color:var(--accent);font-size:11px;">(override)</span>' : ''}
            </div>
        `;

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <h3>${event.name}${event.isDefault ? ' <span style="background: var(--accent); color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.7em; margin-left: 8px;">DEFAULT</span>' : ''}</h3>
            </div>
            ${event.description ? `<div class="event-detail" style="color: var(--text-secondary); margin-bottom: 12px;">${event.description}</div>` : ''}
            <div class="event-detail"><strong>Team Size:</strong> ${teamSizeLabel}</div>
            ${priceHtml}
            ${event.isDefault ? '<div class="event-detail" style="color: var(--accent);"><strong>Type:</strong> Base Registration Fee (auto-included for all competitors)</div>' : '<div class="event-detail"><strong>Type:</strong> Add-on Event (optional)</div>'}
            <div class="event-actions">
                <button class="btn btn-small btn-danger" onclick="deleteEventType(${event.id})">Delete</button>
            </div>
        `;

        container.appendChild(card);
    });
}

function deleteEventType(id) {
    if (confirm('Are you sure you want to delete this event type?')) {
        db.delete('eventTypes', id);
        loadEventTypes();
        loadEventTypeSelector();
        showMessage('Event type deleted successfully!');
    }
}

function loadEventTypeSelector() {
    const eventTypes = db.load('eventTypes');
    const selector = document.getElementById('division-event-selector');

    if (!selector) return;

    selector.innerHTML = '<option value="">Select Event Type</option>';

    // Filter out default events (general registration) - only show add-on events
    const nonDefaultEvents = eventTypes.filter(event => !event.isDefault);

    if (nonDefaultEvents.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '(No add-on events - create event types first)';
        option.disabled = true;
        selector.appendChild(option);
        return;
    }

    nonDefaultEvents.forEach(event => {
        const option = document.createElement('option');
        option.value = event.id;
        option.textContent = event.name;
        selector.appendChild(option);
    });
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SCOREBOARD CONFIGURATION MANAGEMENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * PURPOSE: Create and manage custom scoreboard configurations
 *
 * STRUCTURE:
 * scoreboardConfigs = [
 *   {
 *     id: timestamp,
 *     name: "Junior Kumite",
 *     baseType: "kumite",
 *     settings: {
 *       matchDuration: 2,
 *       pointsToWin: 7,
 *       bufferTime: 60,
 *       cornerJudges: 4,
 *       penaltiesEnabled: true,
 *       overtimeEnabled: true,
 *       overtimeDuration: 60
 *     }
 *   }
 * ]
 *
 * Last Updated: 2026-02-14
 * ═══════════════════════════════════════════════════════════════════════════
 */

function showScoreboardForm() {
    document.getElementById('scoreboard-form-container').classList.remove('hidden');

    // Pre-populate corner names and colors from tournament sanctioning body defaults
    if (currentTournamentId) {
        const tournaments = db.load('tournaments');
        const currentTournament = tournaments.find(t => String(t.id) === String(currentTournamentId));

        if (currentTournament && currentTournament.cornerDefaults) {
            const defaults = currentTournament.cornerDefaults;

            // Pre-populate kumite corner settings
            if (document.getElementById('kumite-corner1-name')) {
                document.getElementById('kumite-corner1-name').value = defaults.corner1Name;
                document.getElementById('kumite-corner1-color').value = defaults.corner1Color;
                document.getElementById('kumite-corner2-name').value = defaults.corner2Name;
                document.getElementById('kumite-corner2-color').value = defaults.corner2Color;
            }

            // Pre-populate kata-flags corner settings
            if (document.getElementById('kata-flags-corner1-name')) {
                document.getElementById('kata-flags-corner1-name').value = defaults.corner1Name;
                document.getElementById('kata-flags-corner1-color').value = defaults.corner1Color;
                document.getElementById('kata-flags-corner2-name').value = defaults.corner2Name;
                document.getElementById('kata-flags-corner2-color').value = defaults.corner2Color;
            }

            // Pre-populate kata-points corner settings
            if (document.getElementById('kata-points-corner1-name')) {
                document.getElementById('kata-points-corner1-name').value = defaults.corner1Name;
                document.getElementById('kata-points-corner1-color').value = defaults.corner1Color;
                document.getElementById('kata-points-corner2-name').value = defaults.corner2Name;
                document.getElementById('kata-points-corner2-color').value = defaults.corner2Color;
            }

            // Pre-populate kobudo corner settings
            if (document.getElementById('kobudo-corner1-name')) {
                document.getElementById('kobudo-corner1-name').value = defaults.corner1Name;
                document.getElementById('kobudo-corner1-color').value = defaults.corner1Color;
                document.getElementById('kobudo-corner2-name').value = defaults.corner2Name;
                document.getElementById('kobudo-corner2-color').value = defaults.corner2Color;
            }
        }
    }
}

function hideScoreboardForm() {
    const container = document.getElementById('scoreboard-form-container');
    const form = document.getElementById('scoreboard-form');
    if (container) container.classList.add('hidden');
    if (form) form.reset();
    updateScoreboardFields(); // Reset field visibility
}

function updateScoreboardFields() {
    const baseType = document.getElementById('scoreboard-base-type').value;

    // Hide all settings sections
    document.querySelectorAll('.scoreboard-type-settings').forEach(el => {
        el.classList.add('hidden');
    });

    // Show relevant settings section
    if (baseType === 'kumite') {
        document.getElementById('kumite-settings').classList.remove('hidden');
    } else if (baseType === 'kata-flags') {
        document.getElementById('kata-flags-settings').classList.remove('hidden');
    } else if (baseType === 'kata-points') {
        document.getElementById('kata-points-settings').classList.remove('hidden');
    } else if (baseType === 'kobudo') {
        document.getElementById('kobudo-settings').classList.remove('hidden');
    }
}

// Scoreboard form submission
const scoreboardForm = document.getElementById('scoreboard-form');
if (scoreboardForm) {
    scoreboardForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const name = document.getElementById('scoreboard-config-name').value.trim();
        const baseType = document.getElementById('scoreboard-base-type').value;

        if (!name || !baseType) {
            showMessage('Please fill in all required fields', 'error');
            return;
        }

        const config = {
            id: generateUniqueId(),
            name: name,
            baseType: baseType,
            settings: {},
            createdAt: new Date().toISOString()
        };

        // Collect settings based on baseType
        if (baseType === 'kumite') {
            config.settings = {
                // Point values (WKF/AAU standard)
                ipponValue: parseInt(document.getElementById('kumite-ippon-value').value) || 3,
                wazaAriValue: parseInt(document.getElementById('kumite-wazaari-value').value) || 2,
                yukoValue: parseInt(document.getElementById('kumite-yuko-value').value) || 1,
                // Match settings
                matchDuration: parseFloat(document.getElementById('kumite-match-duration').value),
                pointsToWin: parseInt(document.getElementById('kumite-points-to-win').value),
                bufferTime: parseInt(document.getElementById('kumite-buffer-time').value),
                cornerJudges: parseInt(document.getElementById('kumite-corner-judges').value),
                penaltiesEnabled: document.getElementById('kumite-penalties-enabled').checked,
                overtimeEnabled: document.getElementById('kumite-overtime-enabled').checked,
                overtimeDuration: parseInt(document.getElementById('kumite-overtime-duration').value),
                corner1Name: document.getElementById('kumite-corner1-name').value.trim(),
                corner1Color: document.getElementById('kumite-corner1-color').value,
                corner2Name: document.getElementById('kumite-corner2-name').value.trim(),
                corner2Color: document.getElementById('kumite-corner2-color').value
            };
        } else if (baseType === 'kata-flags') {
            config.settings = {
                judges: parseInt(document.getElementById('kata-flags-judges').value),
                // bestOf removed - kata flags is ALWAYS single round (WKF/AAU rule)
                tiebreaker: document.getElementById('kata-flags-tiebreaker').value,
                corner1Name: document.getElementById('kata-flags-corner1-name').value.trim(),
                corner1Color: document.getElementById('kata-flags-corner1-color').value,
                corner2Name: document.getElementById('kata-flags-corner2-name').value.trim(),
                corner2Color: document.getElementById('kata-flags-corner2-color').value
            };
        } else if (baseType === 'kata-points') {
            config.settings = {
                judges: parseInt(document.getElementById('kata-points-judges').value),
                minScore: parseFloat(document.getElementById('kata-points-min-score').value),
                maxScore: parseFloat(document.getElementById('kata-points-max-score').value),
                increment: parseFloat(document.getElementById('kata-points-increment').value),
                dropScores: document.getElementById('kata-points-drop-scores').checked, // Customizable (WKF/AAU recommended: true)
                scoringMethod: document.getElementById('kata-points-scoring-method').value, // Customizable (WKF/AAU recommended: 'average')
                corner1Name: document.getElementById('kata-points-corner1-name').value.trim(),
                corner1Color: document.getElementById('kata-points-corner1-color').value,
                corner2Name: document.getElementById('kata-points-corner2-name').value.trim(),
                corner2Color: document.getElementById('kata-points-corner2-color').value
            };
        } else if (baseType === 'kobudo') {
            config.settings = {
                judges: parseInt(document.getElementById('kobudo-judges').value),
                minScore: parseFloat(document.getElementById('kobudo-min-score').value),
                maxScore: parseFloat(document.getElementById('kobudo-max-score').value),
                increment: parseFloat(document.getElementById('kobudo-increment').value),
                dropScores: document.getElementById('kobudo-drop-scores').checked, // Customizable (recommended: true)
                scoringMethod: document.getElementById('kobudo-scoring-method').value, // Customizable (recommended: 'average')
                corner1Name: document.getElementById('kobudo-corner1-name').value.trim(),
                corner1Color: document.getElementById('kobudo-corner1-color').value,
                corner2Name: document.getElementById('kobudo-corner2-name').value.trim(),
                corner2Color: document.getElementById('kobudo-corner2-color').value
            };
        }

        // Save to localStorage
        db.add('scoreboardConfigs', config);
        showMessage('Scoreboard configuration saved successfully!');
        hideScoreboardForm();
        loadScoreboardConfigs();
    });
}

function loadScoreboardConfigs() {
    const configs = db.load('scoreboardConfigs');
    const container = document.getElementById('scoreboards-container');

    if (!container) return;

    container.innerHTML = '';

    if (configs.length === 0) {
        container.innerHTML = '<p class="hint">No scoreboard configurations yet. Click "Create Scoreboard Config" to get started.</p>';
        return;
    }

    configs.forEach(config => {
        const card = document.createElement('div');
        card.className = 'event-card';

        const baseTypeLabels = {
            'kumite': 'Kumite (Sparring)',
            'kata-flags': 'Kata - Flags',
            'kata-points': 'Kata - Points',
            'kobudo': 'Kobudo'
        };

        // Build settings summary
        let settingsSummary = '';
        if (config.baseType === 'kumite') {
            settingsSummary = `
                <div class="event-detail"><strong>Duration:</strong> ${config.settings.matchDuration} min</div>
                <div class="event-detail"><strong>Points to Win:</strong> ${config.settings.pointsToWin}</div>
                <div class="event-detail"><strong>Judges:</strong> ${config.settings.cornerJudges}</div>
                ${config.settings.corner1Name ? `<div class="event-detail"><strong>Corners:</strong> <span style="color: ${config.settings.corner1Color};">●</span> ${config.settings.corner1Name} vs <span style="color: ${config.settings.corner2Color};">●</span> ${config.settings.corner2Name}</div>` : ''}
            `;
        } else if (config.baseType === 'kata-flags') {
            settingsSummary = `
                <div class="event-detail"><strong>Judges:</strong> ${config.settings.judges}</div>
                <div class="event-detail"><strong>Best of:</strong> ${config.settings.bestOf} flags</div>
                ${config.settings.corner1Name ? `<div class="event-detail"><strong>Corners:</strong> <span style="color: ${config.settings.corner1Color};">●</span> ${config.settings.corner1Name} vs <span style="color: ${config.settings.corner2Color};">●</span> ${config.settings.corner2Name}</div>` : ''}
            `;
        } else {
            // Kata-Points or Kobudo
            settingsSummary = `
                <div class="event-detail"><strong>Judges:</strong> ${config.settings.judges}</div>
                <div class="event-detail"><strong>Range:</strong> ${config.settings.minScore} - ${config.settings.maxScore}</div>
                <div class="event-detail"><strong>Increment:</strong> ${config.settings.increment}</div>
                ${config.settings.corner1Name ? `<div class="event-detail"><strong>Corners:</strong> <span style="color: ${config.settings.corner1Color};">●</span> ${config.settings.corner1Name} vs <span style="color: ${config.settings.corner2Color};">●</span> ${config.settings.corner2Name}</div>` : ''}
            `;
        }

        card.innerHTML = `
            <h3>${config.name}</h3>
            <div class="event-detail"><strong>Type:</strong> ${baseTypeLabels[config.baseType]}</div>
            ${settingsSummary}
            <div class="event-actions">
                <button class="btn btn-small btn-danger" onclick="deleteScoreboardConfig(${config.id})">Delete</button>
            </div>
        `;

        container.appendChild(card);
    });
}

function deleteScoreboardConfig(id) {
    if (confirm('Are you sure you want to delete this scoreboard configuration?')) {
        db.delete('scoreboardConfigs', id);
        loadScoreboardConfigs();
        showMessage('Scoreboard configuration deleted successfully!');
    }
}

function loadScoreboardConfigsDropdown() {
    const dropdown = document.getElementById('template-scoreboard-type');
    if (!dropdown) return;

    dropdown.innerHTML = '<option value="">Select Scoreboard Type</option>';

    const unified = getUnifiedScoreboardConfig();

    if (!unified) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '(No config — set up scoreboards in Scoreboard Setup tab)';
        opt.disabled = true;
        dropdown.appendChild(opt);
        return;
    }

    const types = [
        { value: 'kumite',      label: 'Kumite (Sparring)',       key: 'kumite'     },
        { value: 'kata-flags',  label: 'Kata – Flags',            key: 'kataFlags'  },
        { value: 'kata-points', label: 'Kata – Points',           key: 'kataPoints' },
        { value: 'kobudo',      label: 'Kobudo (Weapons Kata)',   key: 'kobudo'     },
    ];

    types.forEach(({ value, label, key }) => {
        if (unified[key]) {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = label;
            opt.setAttribute('data-base-type', value);
            dropdown.appendChild(opt);
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED SCOREBOARD CONFIG
// ═══════════════════════════════════════════════════════════════════════════
//
// Single-config-per-tournament system replacing the old named-config array.
// Key: 'scoreboardConfig' (singular) in localStorage.
// Structure:
//   { org, tournamentId, updatedAt, kumite:{...}, kataFlags:{...},
//     kataPoints:{...}, kobudo:{...} }
//
// Functions:
//   getUnifiedScoreboardConfig()         → reads localStorage
//   saveUnifiedScoreboardConfig()        → reads form, writes localStorage
//   loadUnifiedScoreboardConfig()        → writes form from localStorage
//   applyOrgDefaults(org)               → stamps form with WKF/AAU/custom defaults
//   resetScoreboardConfig()             → re-applies current org defaults
//   updateScoreboardConfigStatus()      → refreshes badge in header
//   autoGenerateScoreboardConfig(org)   → called on tournament create
//
// Last Updated: 2026-03-01
// ═══════════════════════════════════════════════════════════════════════════

function getUnifiedScoreboardConfig() {
    try { return JSON.parse(localStorage.getItem(_scopedKey('scoreboardConfig')) || 'null'); } catch { return null; }
}

// Returns '#ffffff' for dark backgrounds, '#000000' for light backgrounds (like white)
function getCornerTextColor(bgColor) {
    if (!bgColor) return '#ffffff';
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    // Luminance formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#000000' : '#ffffff';
}

// Tiny helpers to safely set form values
function _scVal(id, v) { const el = document.getElementById(id); if (el) el.value = v; }
function _scChk(id, v) { const el = document.getElementById(id); if (el) el.checked = !!v; }

function saveUnifiedScoreboardConfig() {
    const activeOrg = document.querySelector('.sc-org-pill.active');
    const org = activeOrg ? activeOrg.dataset.org : 'custom';

    const config = {
        org: org,
        tournamentId: currentTournamentId,
        updatedAt: new Date().toISOString(),
        kumite: {
            corner1Name:      (document.getElementById('sc-kumite-c1-name')?.value  || 'AKA').trim().toUpperCase(),
            corner1Color:      document.getElementById('sc-kumite-c1-color')?.value  || '#e8403a',
            corner2Name:      (document.getElementById('sc-kumite-c2-name')?.value  || 'AO').trim().toUpperCase(),
            corner2Color:      document.getElementById('sc-kumite-c2-color')?.value  || '#0a84ff',
            matchDuration:   parseInt(document.getElementById('sc-kumite-duration')?.value)  || 120,
            ipponValue:    org === 'aau' ? 1.0 : 3,
            wazaAriValue:  org === 'aau' ? 0.5 : 2,
            yukoValue:     org === 'aau' ? null : 1,
            matchFormat:   org === 'aau' ? (document.getElementById('sc-kumite-match-format')?.value || 'shobu-sanbon') : null,
            penaltySystem: org === 'aau' ? 'three-track' : 'two-track',
            pointsToWin:     parseInt(document.getElementById('sc-kumite-ptw')?.value)        || 8,
            senshu:          !!(document.getElementById('sc-kumite-senshu')?.checked),
            penaltiesEnabled:!!(document.getElementById('sc-kumite-penalties')?.checked),
            overtimeEnabled: !!(document.getElementById('sc-kumite-overtime')?.checked),
            overtimeDuration: 60,
        },
        kataFlags: {
            corner1Name:      (document.getElementById('sc-kataflags-c1-name')?.value || 'AKA').trim().toUpperCase(),
            corner1Color:      document.getElementById('sc-kataflags-c1-color')?.value || '#e8403a',
            corner2Name:      (document.getElementById('sc-kataflags-c2-name')?.value || 'AO').trim().toUpperCase(),
            corner2Color:      document.getElementById('sc-kataflags-c2-color')?.value || '#0a84ff',
            judges:          parseInt(document.getElementById('sc-kataflags-judges')?.value)     || 5,
            tiebreaker:       document.getElementById('sc-kataflags-tiebreaker')?.value || 'judges-decision',
        },
        kataPoints: {
            judges:          parseInt(document.getElementById('sc-katapoints-judges')?.value)   || 5,
            minScore:       parseFloat(document.getElementById('sc-katapoints-min')?.value)     || 5.0,
            maxScore:       parseFloat(document.getElementById('sc-katapoints-max')?.value)     || 10.0,
            increment:      parseFloat(document.getElementById('sc-katapoints-inc')?.value)     || 0.1,
            dropScores:      !!(document.getElementById('sc-katapoints-drop')?.checked),
            scoringMethod:    document.getElementById('sc-katapoints-method')?.value || 'average',
        },
        kobudo: {
            judges:          parseInt(document.getElementById('sc-kobudo-judges')?.value)       || 5,
            minScore:       parseFloat(document.getElementById('sc-kobudo-min')?.value)         || 5.0,
            maxScore:       parseFloat(document.getElementById('sc-kobudo-max')?.value)         || 10.0,
            increment:      parseFloat(document.getElementById('sc-kobudo-inc')?.value)         || 0.1,
            dropScores:      !!(document.getElementById('sc-kobudo-drop')?.checked),
            scoringMethod:    document.getElementById('sc-kobudo-method')?.value   || 'average',
        },
    };

    localStorage.setItem(_scopedKey('scoreboardConfig'), JSON.stringify(config));

    // Mirror corner names/colors into legacy scoreboardSettings so legacy paths still work
    localStorage.setItem(_scopedKey('scoreboardSettings'), JSON.stringify({
        corner1Name:   config.kumite.corner1Name,
        corner2Name:   config.kumite.corner2Name,
        corner1Custom: config.kumite.corner1Color,
        corner2Custom: config.kumite.corner2Color,
    }));

    updateScoreboardConfigStatus();
    showMessage('Scoreboard configuration saved!');
}

function loadUnifiedScoreboardConfig() {
    const config = getUnifiedScoreboardConfig();
    updateScoreboardConfigStatus();

    if (!config) return;

    // Activate org pill
    document.querySelectorAll('.sc-org-pill').forEach(p => {
        p.classList.toggle('active', p.dataset.org === config.org);
    });

    // Kumite
    if (config.kumite) {
        const k = config.kumite;
        _scVal('sc-kumite-c1-name',   k.corner1Name);
        _scVal('sc-kumite-c1-color',  k.corner1Color);
        _scVal('sc-kumite-c2-name',   k.corner2Name);
        _scVal('sc-kumite-c2-color',  k.corner2Color);
        _scVal('sc-kumite-duration',  String(k.matchDuration || 120));
        _scVal('sc-kumite-ptw',       String(k.pointsToWin  || 8));
        _scChk('sc-kumite-senshu',    k.senshu);
        _scChk('sc-kumite-penalties', k.penaltiesEnabled);
        _scChk('sc-kumite-overtime',  k.overtimeEnabled);
        if (k.matchFormat) _scVal('sc-kumite-match-format', k.matchFormat);
    }

    // Apply org-aware UI updates (scoring chips, format row, labels)
    const org = config.org || 'wkf';
    const isWKF = org === 'wkf';
    const isAAU = org === 'aau';

    // Show/hide match format selector
    const formatRow = document.getElementById('sc-kumite-format-row');
    if (formatRow) formatRow.style.display = isAAU ? '' : 'none';

    // Update scoring chips
    const chipsEl = document.getElementById('sc-kumite-scoring-chips');
    if (chipsEl) {
        if (isAAU) {
            chipsEl.innerHTML = `<span class="sc-chip">Ippon&nbsp;<b>1.0</b></span><span class="sc-chip">Waza-ari&nbsp;<b>0.5</b></span>`;
        } else {
            chipsEl.innerHTML = `<span class="sc-chip">Ippon&nbsp;<b>3</b></span><span class="sc-chip">Waza-ari&nbsp;<b>2</b></span><span class="sc-chip">Yuko&nbsp;<b>1</b></span>`;
        }
    }

    // Disable Senshu for AAU
    const senshuToggle = document.getElementById('sc-kumite-senshu');
    if (senshuToggle) senshuToggle.disabled = isAAU;

    // Update penalty label
    const penaltyRow = document.getElementById('sc-kumite-penalties')?.closest('.sc-row');
    const penaltyLabel = penaltyRow?.querySelector('.sc-label');
    if (penaltyLabel) {
        penaltyLabel.textContent = isWKF ? 'Penalties (C1 / C2 Tracks)' : isAAU ? 'Penalties (Hansoku / Mubobi / Jogai)' : 'Penalties';
    }

    // Update overtime label
    const overtimeRow = document.getElementById('sc-kumite-overtime')?.closest('.sc-row');
    const overtimeLabel = overtimeRow?.querySelector('.sc-label');
    if (overtimeLabel) {
        overtimeLabel.textContent = isAAU ? 'Overtime (Sai Shiai / Encho-Sen)' : 'Overtime (Encho-Sen)';
    }

    // Hide Point Lead to Win for AAU
    const ptwRow = document.getElementById('sc-kumite-ptw')?.closest('.sc-row');
    if (ptwRow) ptwRow.style.display = isAAU ? 'none' : '';

    // Kata Flags
    if (config.kataFlags) {
        const kf = config.kataFlags;
        _scVal('sc-kataflags-c1-name',    kf.corner1Name);
        _scVal('sc-kataflags-c1-color',   kf.corner1Color);
        _scVal('sc-kataflags-c2-name',    kf.corner2Name);
        _scVal('sc-kataflags-c2-color',   kf.corner2Color);
        _scVal('sc-kataflags-judges',     String(kf.judges || 5));
        _scVal('sc-kataflags-tiebreaker', kf.tiebreaker || 'judges-decision');
    }

    // Kata Points
    if (config.kataPoints) {
        const kp = config.kataPoints;
        _scVal('sc-katapoints-judges', String(kp.judges   || 5));
        _scVal('sc-katapoints-min',    String(kp.minScore || 5.0));
        _scVal('sc-katapoints-max',    String(kp.maxScore || 10.0));
        _scVal('sc-katapoints-inc',    String(kp.increment || 0.1));
        _scChk('sc-katapoints-drop',   kp.dropScores);
        _scVal('sc-katapoints-method', kp.scoringMethod || 'average');
    }

    // Kobudo
    if (config.kobudo) {
        const kb = config.kobudo;
        _scVal('sc-kobudo-judges', String(kb.judges    || 5));
        _scVal('sc-kobudo-min',    String(kb.minScore  || 5.0));
        _scVal('sc-kobudo-max',    String(kb.maxScore  || 10.0));
        _scVal('sc-kobudo-inc',    String(kb.increment || 0.1));
        _scChk('sc-kobudo-drop',   kb.dropScores);
        _scVal('sc-kobudo-method', kb.scoringMethod || 'average');
    }
}

function applyOrgDefaults(org) {
    // Activate pill
    document.querySelectorAll('.sc-org-pill').forEach(p => {
        p.classList.toggle('active', p.dataset.org === org);
    });

    const isWKF = org === 'wkf';
    const isAAU = org === 'aau';

    const c1Name  = 'AKA';
    const c1Color = '#e8403a';
    const c2Name  = isWKF ? 'AO' : isAAU ? 'SHIRO' : 'BLUE';
    const c2Color = isWKF ? '#0a84ff' : isAAU ? '#ffffff' : '#0a84ff';
    const dur     = isWKF ? '180' : '120';

    // Kumite
    _scVal('sc-kumite-c1-name',   c1Name);
    _scVal('sc-kumite-c1-color',  c1Color);
    _scVal('sc-kumite-c2-name',   c2Name);
    _scVal('sc-kumite-c2-color',  c2Color);
    _scVal('sc-kumite-duration',  dur);
    _scVal('sc-kumite-ptw',       '8');
    _scChk('sc-kumite-senshu',    isWKF);      // WKF = Senshu, AAU = Hantei
    _scChk('sc-kumite-penalties', true);
    _scChk('sc-kumite-overtime',  true);

    // Show/hide match format selector (AAU only)
    const formatRow = document.getElementById('sc-kumite-format-row');
    if (formatRow) formatRow.style.display = isAAU ? '' : 'none';
    if (isAAU) _scVal('sc-kumite-match-format', 'shobu-sanbon');

    // Update scoring chips display
    const chipsEl = document.getElementById('sc-kumite-scoring-chips');
    if (chipsEl) {
        if (isAAU) {
            chipsEl.innerHTML = `
                <span class="sc-chip">Ippon&nbsp;<b>1.0</b></span>
                <span class="sc-chip">Waza-ari&nbsp;<b>0.5</b></span>
            `;
        } else {
            chipsEl.innerHTML = `
                <span class="sc-chip">Ippon&nbsp;<b>3</b></span>
                <span class="sc-chip">Waza-ari&nbsp;<b>2</b></span>
                <span class="sc-chip">Yuko&nbsp;<b>1</b></span>
            `;
        }
    }

    // Disable Senshu toggle for AAU
    const senshuToggle = document.getElementById('sc-kumite-senshu');
    if (senshuToggle) senshuToggle.disabled = isAAU;

    // Update penalty label
    const penaltyRow = document.getElementById('sc-kumite-penalties')?.closest('.sc-row');
    const penaltyLabel = penaltyRow?.querySelector('.sc-label');
    if (penaltyLabel) {
        penaltyLabel.textContent = isWKF
            ? 'Penalties (C1 / C2 Tracks)'
            : isAAU ? 'Penalties (Hansoku / Mubobi / Jogai)' : 'Penalties';
    }

    // Update overtime label
    const overtimeRow = document.getElementById('sc-kumite-overtime')?.closest('.sc-row');
    const overtimeLabel = overtimeRow?.querySelector('.sc-label');
    if (overtimeLabel) {
        overtimeLabel.textContent = isAAU ? 'Overtime (Sai Shiai / Encho-Sen)' : 'Overtime (Encho-Sen)';
    }

    // Hide Point Lead to Win for AAU (uses format-based win conditions instead)
    const ptwRow = document.getElementById('sc-kumite-ptw')?.closest('.sc-row');
    if (ptwRow) ptwRow.style.display = isAAU ? 'none' : '';

    // Kata Flags
    _scVal('sc-kataflags-c1-name',    c1Name);
    _scVal('sc-kataflags-c1-color',   c1Color);
    _scVal('sc-kataflags-c2-name',    c2Name);
    _scVal('sc-kataflags-c2-color',   c2Color);
    _scVal('sc-kataflags-judges',     '5');
    _scVal('sc-kataflags-tiebreaker', 'judges-decision');
}

function resetScoreboardConfig() {
    const config = getUnifiedScoreboardConfig();
    const org = config?.org ||
        document.querySelector('.sc-org-pill.active')?.dataset?.org || 'wkf';
    applyOrgDefaults(org);
}

function updateScoreboardConfigStatus() {
    const badge = document.getElementById('scoreboard-config-status');
    if (!badge) return;
    const config = getUnifiedScoreboardConfig();
    if (config && config.kumite) {
        const orgLabel = config.org === 'wkf' ? 'WKF' : config.org === 'aau' ? 'AAU' : 'Custom';
        badge.textContent = `✓ Configured (${orgLabel})`;
        badge.className = 'sc-status-badge sc-status-ok';
    } else {
        badge.textContent = 'Not Configured';
        badge.className = 'sc-status-badge sc-status-none';
    }
}

// Called automatically when a tournament is created
function autoGenerateScoreboardConfig(sanctioningBody) {
    const isWKF = sanctioningBody === 'wkf';
    const isAAU = sanctioningBody === 'aau';

    const c1Name  = 'AKA';
    const c1Color = '#e8403a';
    const c2Name  = isWKF ? 'AO' : isAAU ? 'SHIRO' : 'BLUE';
    const c2Color = isWKF ? '#0a84ff' : isAAU ? '#ffffff' : '#0a84ff';
    const matchDuration = isWKF ? 180 : 120;

    const config = {
        org: sanctioningBody,
        tournamentId: currentTournamentId,
        updatedAt: new Date().toISOString(),
        kumite: {
            corner1Name: c1Name,   corner1Color: c1Color,
            corner2Name: c2Name,   corner2Color: c2Color,
            matchDuration,
            ipponValue: isAAU ? 1.0 : 3,
            wazaAriValue: isAAU ? 0.5 : 2,
            yukoValue: isAAU ? null : 1,
            matchFormat: isAAU ? 'shobu-sanbon' : null,
            penaltySystem: isAAU ? 'three-track' : 'two-track',
            pointsToWin: 8,
            senshu: isWKF,
            penaltiesEnabled: true,
            overtimeEnabled: true, overtimeDuration: isAAU ? 60 : 60,
        },
        kataFlags: {
            corner1Name: c1Name,   corner1Color: c1Color,
            corner2Name: c2Name,   corner2Color: c2Color,
            judges: 5, tiebreaker: 'judges-decision',
        },
        kataPoints: {
            judges: 5, minScore: 5.0, maxScore: 10.0,
            increment: 0.1, dropScores: true, scoringMethod: 'average',
        },
        kobudo: {
            judges: 5, minScore: 5.0, maxScore: 10.0,
            increment: 0.1, dropScores: true, scoringMethod: 'average',
        },
    };

    localStorage.setItem(_scopedKey('scoreboardConfig'), JSON.stringify(config));

    // Mirror into legacy scoreboardSettings for backward compat
    localStorage.setItem(_scopedKey('scoreboardSettings'), JSON.stringify({
        corner1Name:   config.kumite.corner1Name,
        corner2Name:   config.kumite.corner2Name,
        corner1Custom: config.kumite.corner1Color,
        corner2Custom: config.kumite.corner2Color,
    }));

    console.log(`Auto-generated scoreboard config for ${sanctioningBody}:`, config);
}

function loadDivisionTemplate() {
    const selector = document.getElementById('division-event-selector');
    const container = document.getElementById('division-template-container');

    if (!selector || !container) return;

    const eventId = selector.value;

    if (!eventId) {
        container.classList.add('hidden');
        return;
    }

    // Show the division template container
    container.classList.remove('hidden');

    // Load templates list for this event
    loadTemplatesList();

    // Load existing divisions if any
    const divisions = db.load('divisions');
    const eventData = divisions[eventId];

    if (eventData && eventData.generated) {
        // Load existing divisions
        loadDivisions();
    }
}

// Template Management
function loadTemplateSelector() {
    const templates = db.load('templates');
    const selector = document.getElementById('template-selector');

    if (!selector) return; // Element doesn't exist on this page

    const currentValue = selector.value;

    selector.innerHTML = '<option value="">-- Select Template --</option>';
    templates.forEach(template => {
        const option = document.createElement('option');
        option.value = template.id;
        option.textContent = template.name;
        selector.appendChild(option);
    });

    selector.value = currentValue;
}

function showTemplateBuilder() {
    document.getElementById('template-builder').classList.remove('hidden');
    currentTemplate = {
        name: '',
        criteria: []
    };
    document.getElementById('template-name').value = '';
    document.getElementById('criteria-list').innerHTML = '';
    criteriaCounter = 0;
}

function hideTemplateBuilder() {
    document.getElementById('template-builder').classList.add('hidden');
    currentTemplate = null;
}

function loadTemplate() {
    const selector = document.getElementById('template-selector');
    const templateId = parseInt(selector.value);

    if (!templateId) {
        currentTemplate = null;
        return;
    }

    const templates = db.load('templates');
    const template = templates.find(t => t.id === templateId);

    if (template) {
        currentTemplate = { ...template };
        showMessage(`Loaded template: ${template.name}`);
    }
}

// Dead deleteTemplate() (no-arg, legacy) removed - using the parameterized version in division management

function addCriteria() {
    criteriaCounter++;
    const criteriaList = document.getElementById('criteria-list');

    const criteriaDiv = document.createElement('div');
    criteriaDiv.className = 'criteria-item';
    criteriaDiv.dataset.index = criteriaCounter;

    criteriaDiv.innerHTML = `
        <div class="criteria-header">
            <h5>Criteria ${criteriaCounter}</h5>
            <div class="criteria-controls">
                <button type="button" class="btn btn-small btn-secondary" onclick="moveCriteriaUp(${criteriaCounter})">↑</button>
                <button type="button" class="btn btn-small btn-secondary" onclick="moveCriteriaDown(${criteriaCounter})">↓</button>
                <button type="button" class="btn btn-small btn-danger" onclick="removeCriteria(${criteriaCounter})">Remove</button>
            </div>
        </div>
        <div class="criteria-type">
            <div class="form-group">
                <label>Criteria Type</label>
                <select id="criteria-type-${criteriaCounter}" class="criteria-type-select" onchange="updateCriteriaRanges(${criteriaCounter})">
                    <option value="">Select Type</option>
                    <option value="age">Age</option>
                    <option value="gender">Gender</option>
                    <option value="weight">Weight</option>
                    <option value="rank">Rank</option>
                    <option value="experience">Experience</option>
                </select>
            </div>
        </div>
        <div class="ranges-container" id="ranges-${criteriaCounter}"></div>
    `;

    criteriaList.appendChild(criteriaDiv);
}

function removeCriteria(index) {
    const criteria = document.querySelector(`[data-index="${index}"]`);
    if (criteria) {
        criteria.remove();
    }
}

function moveCriteriaUp(index) {
    const criteria = document.querySelector(`[data-index="${index}"]`);
    const prev = criteria.previousElementSibling;
    if (prev) {
        criteria.parentNode.insertBefore(criteria, prev);
    }
}

function moveCriteriaDown(index) {
    const criteria = document.querySelector(`[data-index="${index}"]`);
    const next = criteria.nextElementSibling;
    if (next) {
        criteria.parentNode.insertBefore(next, criteria);
    }
}

function updateCriteriaRanges(index) {
    const criteriaItem = document.querySelector(`[data-index="${index}"]`);
    const typeSelect = criteriaItem.querySelector('.criteria-type-select');
    const rangesContainer = document.getElementById(`ranges-${index}`);
    const type = typeSelect.value;

    rangesContainer.innerHTML = '';

    if (!type) return;

    if (type === 'gender') {
        rangesContainer.innerHTML = `
            <p style="color: var(--text-secondary); font-size: 14px;">
                Divisions will be split by: Male, Female
            </p>
        `;
        return;
    }

    if (type === 'rank') {
        rangesContainer.innerHTML = `<div class="rank-ranges-list"></div>
            <button type="button" class="btn btn-small btn-secondary" onclick="addRankRange(${index})">+ Add Rank Range</button>`;
        addRankRange(index);
        return;
    }

    const addRangeBtn = document.createElement('button');
    addRangeBtn.type = 'button';
    addRangeBtn.className = 'btn btn-small btn-secondary add-range-btn';
    addRangeBtn.textContent = '+ Add Range';
    addRangeBtn.onclick = () => addRange(index, type);

    rangesContainer.appendChild(addRangeBtn);
    addRange(index, type);
}

function addRange(criteriaIndex, type) {
    const rangesContainer = document.getElementById(`ranges-${criteriaIndex}`);
    const rangeCount = rangesContainer.querySelectorAll('.range-item').length;

    const rangeDiv = document.createElement('div');
    rangeDiv.className = 'range-item';

    let placeholder1, placeholder2, label;

    switch(type) {
        case 'age':
            placeholder1 = 'Min age';
            placeholder2 = 'Max age';
            label = 'Name (e.g., Youth)';
            break;
        case 'weight':
            placeholder1 = 'Min kg';
            placeholder2 = 'Max kg';
            label = 'Name (e.g., Lightweight)';
            break;
        case 'experience':
            placeholder1 = 'Min years';
            placeholder2 = 'Max years';
            label = 'Name (e.g., Beginner)';
            break;
        case 'rank':
            placeholder1 = 'Enter rank';
            placeholder2 = '';
            label = 'Group name';
            break;
    }

    if (type === 'rank') {
        rangeDiv.innerHTML = `
            <input type="text" placeholder="${placeholder1}" class="rank-value">
            <input type="text" placeholder="${label}">
            <button type="button" class="btn btn-small btn-danger" onclick="this.parentElement.remove()">×</button>
        `;
    } else {
        rangeDiv.innerHTML = `
            <input type="number" placeholder="${placeholder1}" step="0.1">
            <input type="number" placeholder="${placeholder2}" step="0.1">
            <input type="text" placeholder="${label}">
            <button type="button" class="btn btn-small btn-danger" onclick="this.parentElement.remove()">×</button>
        `;
    }

    const addBtn = rangesContainer.querySelector('.add-range-btn');
    if (addBtn) {
        rangesContainer.insertBefore(rangeDiv, addBtn);
    } else {
        rangesContainer.appendChild(rangeDiv);
    }
}

// Kyu/Dan rank labels for the template builder dropdowns
const RANK_SELECT_OPTIONS = [
    { val: '10th kyu', label: '10th Kyu' },
    { val: '9th kyu',  label: '9th Kyu' },
    { val: '8th kyu',  label: '8th Kyu' },
    { val: '7th kyu',  label: '7th Kyu' },
    { val: '6th kyu',  label: '6th Kyu' },
    { val: '5th kyu',  label: '5th Kyu' },
    { val: '4th kyu',  label: '4th Kyu' },
    { val: '3rd kyu',  label: '3rd Kyu' },
    { val: '2nd kyu',  label: '2nd Kyu' },
    { val: '1st kyu',  label: '1st Kyu' },
    { val: '1st dan',  label: '1st Dan' },
    { val: '2nd dan',  label: '2nd Dan' },
    { val: '3rd dan',  label: '3rd Dan' },
    { val: '4th dan',  label: '4th Dan' },
    { val: '5th dan',  label: '5th Dan' },
    { val: '6th dan',  label: '6th Dan' },
    { val: '7th dan',  label: '7th Dan' },
    { val: '8th dan',  label: '8th Dan' },
    { val: '9th dan',  label: '9th Dan' },
    { val: '10th dan', label: '10th Dan' },
];

function addRankRange(criteriaIndex, savedMin, savedMax, savedLabel) {
    const rangesList = document.querySelector(`#ranges-${criteriaIndex} .rank-ranges-list`);
    if (!rangesList) return;

    const rankOptions = RANK_SELECT_OPTIONS
        .map(r => `<option value="${r.val}">${r.label}</option>`)
        .join('');

    const div = document.createElement('div');
    div.className = 'range-item rank-range-item';
    div.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;';
    div.innerHTML = `
        <select class="rank-min-select" style="flex:1;min-width:130px;">${rankOptions}</select>
        <span style="white-space:nowrap;">to</span>
        <select class="rank-max-select" style="flex:1;min-width:130px;">${rankOptions}</select>
        <input type="text" class="rank-label" placeholder="Label (e.g., Kyu)" style="flex:2;min-width:110px;">
        <button type="button" class="btn btn-small btn-danger" onclick="this.parentElement.remove()">×</button>
    `;

    const minSelect = div.querySelector('.rank-min-select');
    const maxSelect = div.querySelector('.rank-max-select');
    const labelInp  = div.querySelector('.rank-label');

    if (savedMin) minSelect.value = savedMin;
    if (savedMax) maxSelect.value = savedMax;
    else maxSelect.value = '1st kyu'; // default: White → 1st Kyu range
    if (savedLabel) labelInp.value = savedLabel;

    rangesList.appendChild(div);
}

function saveTemplate() {
    const name = document.getElementById('template-name').value.trim();

    if (!name) {
        showMessage('Please enter a template name', 'error');
        return;
    }

    const criteriaItems = document.querySelectorAll('.criteria-item');
    const criteria = [];

    criteriaItems.forEach(item => {
        const typeSelect = item.querySelector('.criteria-type-select');
        const type = typeSelect.value;

        if (!type) return;

        const criteriaObj = { type, ranges: [] };

        if (type === 'gender') {
            criteriaObj.ranges = [
                { value: 'Male', label: 'Male' },
                { value: 'Female', label: 'Female' },
                { value: 'Open', label: 'Open' }
            ];
        } else if (type === 'rank') {
            const rangeItems = item.querySelectorAll('.range-item');
            rangeItems.forEach(range => {
                const inputs = range.querySelectorAll('input');
                if (inputs[0].value.trim()) {
                    criteriaObj.ranges.push({
                        value: inputs[0].value.trim(),
                        label: inputs[1].value.trim() || inputs[0].value.trim()
                    });
                }
            });
        } else {
            const rangeItems = item.querySelectorAll('.range-item');
            rangeItems.forEach(range => {
                const inputs = range.querySelectorAll('input');
                const min = parseFloat(inputs[0].value);
                const max = parseFloat(inputs[1].value);
                const label = inputs[2].value.trim();

                if (!isNaN(min) && !isNaN(max)) {
                    criteriaObj.ranges.push({ min, max, label: label || `${min}-${max}` });
                }
            });
        }

        if (criteriaObj.ranges.length > 0) {
            criteria.push(criteriaObj);
        }
    });

    if (criteria.length === 0) {
        showMessage('Please add at least one criteria with ranges', 'error');
        return;
    }

    const template = {
        name,
        criteria
    };

    db.add('templates', template);
    showMessage('Template saved successfully!');
    hideTemplateBuilder();
    loadTemplateSelector();
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DIVISION MANAGEMENT - CRITICAL SECTION ⚠️
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ROUTE: Divisions tab → Select Event → "Configure Division Criteria"
 *
 * FLOW:
 * 1. User selects event type from dropdown
 * 2. loadDivisionTemplate() - Shows builder container
 * 3. showDivisionBuilder() - Reveals criteria builder + loads existing criteria ✅ FIXED
 * 4. loadExistingCriteria() - Populates builder with saved criteria ✅ NEW
 * 5. User adds/modifies criteria (age, gender, weight, rank, experience)
 * 6. saveDivisionTemplate() - Saves criteria to divisions[eventId] (preserves generated)
 * 7. generateDivisions() - Applies criteria to competitors, creates divisions (preserves criteria)
 * 8. loadDivisions() - Displays generated divisions in UI
 *
 * DATA STRUCTURE:
 * divisions = {
 *   "eventId": {
 *     criteria: [
 *       {type: 'age', ranges: [{min, max, label}]},
 *       {type: 'gender', ranges: [{value, label}]},
 *       {type: 'weight', ranges: [{min, max, label}]}
 *     ],
 *     generated: {
 *       "8-10 | Male | 30-40kg": [competitor1, competitor2, ...],
 *       "8-10 | Female | 30-40kg": [competitor3, ...]
 *     },
 *     updatedAt: "ISO timestamp"
 *   }
 * }
 *
 * ✅ FIXED BUGS (2026-02-13 Debugging Session):
 * 1. ✅ Bug #1: saveDivisionTemplate() now preserves existing generated divisions
 * 2. ✅ Bug #8: showDivisionBuilder() now loads existing criteria for editing
 * 3. ✅ Bug #2: Schema standardized throughout (criteria + generated always preserved)
 *
 * 🆕 MAJOR ENHANCEMENT (2026-02-13 - Age Calculation):
 * - generateDivisions() now calculates age dynamically from dateOfBirth
 * - Respects tournament's ageCalculationMethod setting:
 *   - "event-date": Uses tournament date for age calculation
 *   - "registration-date": Uses current date for age calculation
 * - Legacy support: Falls back to comp.age if dateOfBirth missing
 * - Age added to competitor objects before filtering (non-mutating)
 *
 * AGE CRITERIA FILTERING:
 * When criteria includes age ranges (e.g., 10-12):
 * 1. Load tournament settings to get ageCalculationMethod
 * 2. Determine reference date (event date vs registration date)
 * 3. Calculate age for each competitor: calculateAge(dob, referenceDate)
 * 4. Add calculated age to competitor object
 * 5. Filter competitors by age range using calculated age
 * 6. Result: Competitors placed in correct age divisions
 *
 * ⚠️ REMAINING KNOWN ISSUES:
 * 1. No validation before saving (can save empty criteria) - Bug #9
 * 2. clearAllCompetitors() wipes entire divisions object - Bug #3
 * 3. Race conditions between save/generate operations - Bug #10
 * 4. No tournament scoping (data is global) - Bug #4
 *
 * 📝 NOTE TO FUTURE DEVELOPERS:
 * This section was the MOST BUGGY part of the codebase. Recent fixes (2026-02-13):
 * - Added loadExistingCriteria() to enable editing
 * - saveDivisionTemplate() preserves existingGenerated
 * - generateDivisions() preserves criteria
 * - Added dynamic age calculation from dateOfBirth
 *
 * When modifying:
 * 1. Test with existing divisions data
 * 2. Test saving criteria multiple times
 * 3. Test generating → editing criteria → regenerating
 * 4. Check that generated divisions persist after save
 * 5. Check that criteria persist after generating
 * 6. Test age calculation with different tournament dates
 * 7. Test with competitors who have birthdays between registration and event
 * 8. Update this comment with any structural changes
 * 9. Update AUDIT_REPORT.md if fixing bugs
 *
 * Last Updated: 2026-02-14 (Added WKF/AAU division presets)
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * WKF & AAU DIVISION PRESETS
 * Pre-defined division templates for quick tournament setup
 */
const DIVISION_PRESETS = {
    // WKF KUMITE DIVISIONS
    'wkf-kumite-cadet-male': {
        name: 'WKF Kumite - Cadet Male (14-15)',
        description: 'WKF standard weight categories for Cadet males',
        criteria: [
            {
                type: 'age',
                ranges: [{min: 14, max: 15, label: '14-15'}]
            },
            {
                type: 'gender',
                ranges: [{value: 'Male', label: 'Male'}]
            },
            {
                type: 'weight',
                ranges: [
                    {min: 0, max: 52, label: '-52kg'},
                    {min: 52.01, max: 57, label: '-57kg'},
                    {min: 57.01, max: 63, label: '-63kg'},
                    {min: 63.01, max: 70, label: '-70kg'},
                    {min: 70.01, max: 999, label: '+70kg'}
                ]
            }
        ]
    },
    'wkf-kumite-cadet-female': {
        name: 'WKF Kumite - Cadet Female (14-15)',
        description: 'WKF standard weight categories for Cadet females',
        criteria: [
            {
                type: 'age',
                ranges: [{min: 14, max: 15, label: '14-15'}]
            },
            {
                type: 'gender',
                ranges: [{value: 'Female', label: 'Female'}]
            },
            {
                type: 'weight',
                ranges: [
                    {min: 0, max: 47, label: '-47kg'},
                    {min: 47.01, max: 54, label: '-54kg'},
                    {min: 54.01, max: 999, label: '+54kg'}
                ]
            }
        ]
    },
    'wkf-kumite-junior-male': {
        name: 'WKF Kumite - Junior Male (16-17)',
        description: 'WKF standard weight categories for Junior males',
        criteria: [
            {
                type: 'age',
                ranges: [{min: 16, max: 17, label: '16-17'}]
            },
            {
                type: 'gender',
                ranges: [{value: 'Male', label: 'Male'}]
            },
            {
                type: 'weight',
                ranges: [
                    {min: 0, max: 55, label: '-55kg'},
                    {min: 55.01, max: 61, label: '-61kg'},
                    {min: 61.01, max: 68, label: '-68kg'},
                    {min: 68.01, max: 76, label: '-76kg'},
                    {min: 76.01, max: 999, label: '+76kg'}
                ]
            }
        ]
    },
    'wkf-kumite-junior-female': {
        name: 'WKF Kumite - Junior Female (16-17)',
        description: 'WKF standard weight categories for Junior females',
        criteria: [
            {
                type: 'age',
                ranges: [{min: 16, max: 17, label: '16-17'}]
            },
            {
                type: 'gender',
                ranges: [{value: 'Female', label: 'Female'}]
            },
            {
                type: 'weight',
                ranges: [
                    {min: 0, max: 48, label: '-48kg'},
                    {min: 48.01, max: 53, label: '-53kg'},
                    {min: 53.01, max: 59, label: '-59kg'},
                    {min: 59.01, max: 999, label: '+59kg'}
                ]
            }
        ]
    },
    'wkf-kumite-senior-male': {
        name: 'WKF Kumite - Senior Male (18+)',
        description: 'WKF standard weight categories for Senior males',
        criteria: [
            {
                type: 'age',
                ranges: [{min: 18, max: 99, label: '18+'}]
            },
            {
                type: 'gender',
                ranges: [{value: 'Male', label: 'Male'}]
            },
            {
                type: 'weight',
                ranges: [
                    {min: 0, max: 60, label: '-60kg'},
                    {min: 60.01, max: 67, label: '-67kg'},
                    {min: 67.01, max: 75, label: '-75kg'},
                    {min: 75.01, max: 84, label: '-84kg'},
                    {min: 84.01, max: 999, label: '+84kg'}
                ]
            }
        ]
    },
    'wkf-kumite-senior-female': {
        name: 'WKF Kumite - Senior Female (18+)',
        description: 'WKF standard weight categories for Senior females',
        criteria: [
            {
                type: 'age',
                ranges: [{min: 18, max: 99, label: '18+'}]
            },
            {
                type: 'gender',
                ranges: [{value: 'Female', label: 'Female'}]
            },
            {
                type: 'weight',
                ranges: [
                    {min: 0, max: 50, label: '-50kg'},
                    {min: 50.01, max: 55, label: '-55kg'},
                    {min: 55.01, max: 61, label: '-61kg'},
                    {min: 61.01, max: 68, label: '-68kg'},
                    {min: 68.01, max: 999, label: '+68kg'}
                ]
            }
        ]
    },
    // AAU KUMITE DIVISIONS (Simplified - age and gender based)
    'aau-youth-male': {
        name: 'AAU Kumite - Youth Male (12-13)',
        description: 'AAU youth division with flexible weight categories',
        criteria: [
            {
                type: 'age',
                ranges: [{min: 12, max: 13, label: '12-13'}]
            },
            {
                type: 'gender',
                ranges: [{value: 'Male', label: 'Male'}]
            },
            {
                type: 'weight',
                ranges: [
                    {min: 0, max: 45, label: 'Light (Under 45kg)'},
                    {min: 45.01, max: 55, label: 'Medium (45-55kg)'},
                    {min: 55.01, max: 999, label: 'Heavy (Over 55kg)'}
                ]
            }
        ]
    },
    'aau-youth-female': {
        name: 'AAU Kumite - Youth Female (12-13)',
        description: 'AAU youth division with flexible weight categories',
        criteria: [
            {
                type: 'age',
                ranges: [{min: 12, max: 13, label: '12-13'}]
            },
            {
                type: 'gender',
                ranges: [{value: 'Female', label: 'Female'}]
            },
            {
                type: 'weight',
                ranges: [
                    {min: 0, max: 40, label: 'Light (Under 40kg)'},
                    {min: 40.01, max: 50, label: 'Medium (40-50kg)'},
                    {min: 50.01, max: 999, label: 'Heavy (Over 50kg)'}
                ]
            }
        ]
    }
};

// Load division preset into the criteria builder
function loadDivisionPreset() {
    const selector = document.getElementById('preset-selector');
    const presetKey = selector.value;

    if (!presetKey || !DIVISION_PRESETS[presetKey]) {
        return;
    }

    const preset = DIVISION_PRESETS[presetKey];

    // Confirm with user before clearing existing criteria
    const criteriaList = document.getElementById('criteria-list');
    if (criteriaList.children.length > 0) {
        if (!confirm('Loading a preset will clear any existing criteria. Continue?')) {
            selector.value = ''; // Reset selector
            return;
        }
    }

    // Set template name if empty
    const templateNameInput = document.getElementById('template-name');
    if (!templateNameInput.value) {
        templateNameInput.value = preset.name;
    }

    // Clear existing criteria
    criteriaList.innerHTML = '';
    criteriaCounter = 0;

    // Load criteria from preset
    preset.criteria.forEach(criterion => {
        addCriteria();

        const criteriaItem = document.querySelector(`[data-index="${criteriaCounter}"]`);
        if (!criteriaItem) return;

        const typeSelect = criteriaItem.querySelector('.criteria-type-select');
        typeSelect.value = criterion.type;
        updateCriteriaRanges(criteriaCounter);

        const rangesContainer = document.getElementById(`ranges-${criteriaCounter}`);

        // For gender, select the appropriate checkbox
        if (criterion.type === 'gender') {
            criterion.ranges.forEach(range => {
                const checkbox = rangesContainer.querySelector(`input[value="${range.value}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                }
            });
        }
        // For age, weight, experience, rank - add custom ranges
        else {
            // Clear default ranges first
            rangesContainer.innerHTML = '';

            criterion.ranges.forEach(range => {
                addRange(criteriaCounter, criterion.type);
                const rangeItems = rangesContainer.querySelectorAll('.range-item');
                const lastRange = rangeItems[rangeItems.length - 1];
                const inputs = lastRange.querySelectorAll('input');

                if (criterion.type === 'rank') {
                    // Rank uses single value field
                    if (inputs.length >= 1) {
                        inputs[0].value = range.value || '';
                    }
                } else {
                    // Age, weight, experience use min/max/label
                    if (inputs.length >= 3) {
                        inputs[0].value = range.min !== undefined ? range.min : '';
                        inputs[1].value = range.max !== undefined ? range.max : '';
                        inputs[2].value = range.label || '';
                    }
                }
            });
        }
    });

    // Reset selector after loading
    selector.value = '';

    // Show success message
    showToast(`Loaded preset: ${preset.name} — customize as needed before saving`, 'success');
}

// Global variable to track current template being edited
let currentTemplateId = null;

// Division Size Validation
function validateDivisionSizes(divisions, template) {
    const divisionNames = Object.keys(divisions);
    const warnings = [];
    const info = [];

    // Define thresholds based on bracket type
    // Generic size thresholds (bracket type is chosen later, at bracket generation stage)
    const minViable = 2;
    const minRecommended = 3;
    const maxRecommended = 32;

    // Check each division
    divisionNames.forEach(divisionName => {
        const competitors = divisions[divisionName];
        const count = competitors.length;

        if (count === 0) {
            info.push(`• "${divisionName}": No competitors (will be hidden by default)`);
        } else if (count === 1) {
            warnings.push(`• "${divisionName}": Only 1 competitor - cannot run bracket (needs at least ${minViable})`);
        } else if (count < minRecommended) {
            warnings.push(`• "${divisionName}": ${count} competitors - viable but small (recommended: ${minRecommended}+ for better competition)`);
        } else if (count > maxRecommended) {
            warnings.push(`• "${divisionName}": ${count} competitors - very large division (may require extended time, recommended: ${maxRecommended} or fewer)`);
        } else {
            info.push(`• "${divisionName}": ${count} competitors ✓`);
        }
    });

    // Display summary
    const totalDivisions = divisionNames.length;
    const emptyDivisions = divisionNames.filter(name => divisions[name].length === 0).length;
    const viableDivisions = divisionNames.filter(name => divisions[name].length >= minViable).length;

    console.log('=== DIVISION VALIDATION ===');
    console.log(`Total divisions: ${totalDivisions}`);
    console.log(`Empty divisions: ${emptyDivisions}`);
    console.log(`Viable divisions: ${viableDivisions}`);
    console.log('Warnings:', warnings);
    console.log('Info:', info);

    // Show user feedback if there are warnings
    if (warnings.length > 0) {
        const warningMessage = [
            `⚠️ Division Size Warnings (${warnings.length} issue${warnings.length !== 1 ? 's' : ''}):`,
            '',
            ...warnings,
            '',
            `✓ Viable divisions: ${viableDivisions}/${totalDivisions}`,
            '',
            'You can still proceed, but consider:',
            '• Combining small divisions',
            '• Adjusting criteria ranges',
            '• Using presets (WKF/AAU) for standard categories'
        ].join('\n');

        showToast(`Division size warnings: ${warnings.length} issue(s). ${viableDivisions}/${totalDivisions} viable. Consider combining small divisions.`, 'warning', 6000);
    } else if (viableDivisions > 0) {
        showMessage(`✓ ${viableDivisions} viable division${viableDivisions !== 1 ? 's' : ''} generated successfully!`, 'success');
    }
}

// Division Builder Functions
function showDivisionBuilder(templateId = null) {
    const builder = document.getElementById('division-builder');
    const builderTitle = document.getElementById('builder-title');

    if (!builder) return;

    // Clear form
    document.getElementById('template-name').value = '';
    document.getElementById('template-match-duration').value = '';

    // Clear criteria
    const criteriaList = document.getElementById('criteria-list');
    criteriaList.innerHTML = '';
    criteriaCounter = 0;

    if (templateId) {
        // Editing existing template
        currentTemplateId = templateId;
        builderTitle.textContent = 'Edit Division Template';
        loadTemplateForEditing(templateId);
    } else {
        // Creating new template
        currentTemplateId = null;
        builderTitle.textContent = 'New Division Template';
    }

    builder.classList.remove('hidden');
}

function loadTemplateForEditing(templateId) {
    const eventSelector = document.getElementById('division-event-selector');
    const eventId = eventSelector?.value;
    if (!eventId) return;

    const allDivisions = db.load('divisions');
    const eventData = allDivisions[eventId];

    if (!eventData || !eventData.templates) return;

    const template = eventData.templates.find(t => t.id === templateId);
    if (!template) return;

    // Populate template fields
    document.getElementById('template-name').value = template.name || '';
    document.getElementById('template-match-duration').value = template.matchDuration ? (template.matchDuration / 60) : '';

    // Load criteria
    if (template.criteria && template.criteria.length > 0) {
        template.criteria.forEach((criterion) => {
            addCriteria();

            const criteriaItem = document.querySelector(`[data-index="${criteriaCounter}"]`);
            const typeSelect = criteriaItem.querySelector('.criteria-type-select');

            typeSelect.value = criterion.type;
            updateCriteriaRanges(criteriaCounter);

            // Populate ranges
            const rangesContainer = document.getElementById(`ranges-${criteriaCounter}`);

            if (criterion.type === 'gender') {
                return;
            }

            if (criterion.type === 'rank') {
                // Populate Kyu/Dan range selectors from saved rankMin/rankMax
                criterion.ranges.forEach((range, i) => {
                    if (i === 0) {
                        // First range was already created by updateCriteriaRanges
                        const firstItem = rangesContainer.querySelector('.rank-range-item');
                        if (firstItem) {
                            const minSel = firstItem.querySelector('.rank-min-select');
                            const maxSel = firstItem.querySelector('.rank-max-select');
                            const labelInp = firstItem.querySelector('.rank-label');
                            if (minSel) minSel.value = range.rankMin || '10th kyu';
                            if (maxSel) maxSel.value = range.rankMax || '1st kyu';
                            if (labelInp) labelInp.value = range.label || '';
                        }
                    } else {
                        addRankRange(criteriaCounter, range.rankMin, range.rankMax, range.label);
                    }
                });
                return;
            }

            criterion.ranges.forEach(range => {
                addRange(criteriaCounter, criterion.type);
                const rangeItems = rangesContainer.querySelectorAll('.range-item');
                const lastRange = rangeItems[rangeItems.length - 1];
                const inputs = lastRange.querySelectorAll('input');

                if (inputs.length >= 3) {
                    inputs[0].value = range.min;
                    inputs[1].value = range.max;
                    inputs[2].value = range.label;
                }
            });
        });
    }
}

function loadTemplatesList() {
    const eventSelector = document.getElementById('division-event-selector');
    const eventId = eventSelector?.value;
    const container = document.getElementById('templates-list');

    if (!container || !eventId) return;

    const allDivisions = db.load('divisions');
    const eventData = allDivisions[eventId];

    if (!eventData || !eventData.templates || eventData.templates.length === 0) {
        container.innerHTML = '<p class="hint">No templates created yet. Click "New Template" to get started.</p>';
        return;
    }

    container.innerHTML = '';

    eventData.templates.forEach(template => {
        const templateCard = document.createElement('div');
        templateCard.className = 'event-card';
        templateCard.style.cssText = 'margin-bottom: 12px;';

        // Summarize criteria types
        const criteriaTypes = (template.criteria || []).map(c => c.type).join(', ') || 'None';
        const durationInfo = template.matchDuration
            ? `<div class="event-detail"><strong>Match Duration:</strong> ${template.matchDuration / 60} min</div>`
            : '';

        templateCard.innerHTML = `
            <h4>${template.name}</h4>
            <div class="event-detail"><strong>Criteria:</strong> ${criteriaTypes}</div>
            ${durationInfo}
            <div class="event-actions">
                <button class="btn btn-small btn-secondary" onclick="showDivisionBuilder(${template.id})">Edit</button>
                <button class="btn btn-small btn-danger" onclick="deleteTemplate(${template.id})">Delete</button>
            </div>
        `;

        container.appendChild(templateCard);
    });
}

function loadExistingCriteria() {
    const eventSelector = document.getElementById('division-event-selector');
    const eventId = eventSelector?.value;

    if (!eventId) return;

    const allDivisions = db.load('divisions');
    const eventData = allDivisions[eventId];

    if (!eventData || !eventData.criteria || eventData.criteria.length === 0) {
        // No existing criteria, start fresh
        return;
    }

    // Clear existing criteria in the builder
    const criteriaList = document.getElementById('criteria-list');
    criteriaList.innerHTML = '';
    criteriaCounter = 0;

    // Load each criterion from saved data
    eventData.criteria.forEach((criterion, idx) => {
        addCriteria(); // Creates the UI structure

        // Get the newly created criteria item
        const criteriaItem = document.querySelector(`[data-index="${criteriaCounter}"]`);
        const typeSelect = criteriaItem.querySelector('.criteria-type-select');
        const scoreboardTypeSelect = criteriaItem.querySelector('.criteria-scoreboard-type-select');
        const bracketTypeSelect = criteriaItem.querySelector('.criteria-bracket-type-select');

        // Set the criteria type
        typeSelect.value = criterion.type;

        // Set the scoreboard type if it exists
        if (scoreboardTypeSelect && criterion.scoreboardType) {
            scoreboardTypeSelect.value = criterion.scoreboardType;
        }

        // Set the bracket type if it exists
        if (bracketTypeSelect && criterion.bracketType) {
            bracketTypeSelect.value = criterion.bracketType;
        }

        // Trigger range UI update
        updateCriteriaRanges(criteriaCounter);

        // Populate ranges
        const rangesContainer = document.getElementById(`ranges-${criteriaCounter}`);

        if (criterion.type === 'gender') {
            return;
        }

        if (criterion.type === 'rank') {
            criterion.ranges.forEach((range, i) => {
                if (i === 0) {
                    const firstItem = rangesContainer.querySelector('.rank-range-item');
                    if (firstItem) {
                        const minSel = firstItem.querySelector('.rank-min-select');
                        const maxSel = firstItem.querySelector('.rank-max-select');
                        const labelInp = firstItem.querySelector('.rank-label');
                        if (minSel) minSel.value = range.rankMin || '10th kyu';
                        if (maxSel) maxSel.value = range.rankMax || '1st kyu';
                        if (labelInp) labelInp.value = range.label || '';
                    }
                } else {
                    addRankRange(criteriaCounter, range.rankMin, range.rankMax, range.label);
                }
            });
            return;
        }

        // For age, weight, experience - populate the range inputs
        criterion.ranges.forEach(range => {
            addRange(criteriaCounter, criterion.type);

            // Get the last added range item (the one we just created)
            const rangeItems = rangesContainer.querySelectorAll('.range-item');
            const lastRange = rangeItems[rangeItems.length - 1];
            const inputs = lastRange.querySelectorAll('input');

            if (inputs.length >= 3) {
                inputs[0].value = range.min;
                inputs[1].value = range.max;
                inputs[2].value = range.label;
            }
        });
    });

    showMessage('Loaded existing criteria for editing', 'success');
}

function hideDivisionBuilder() {
    const builder = document.getElementById('division-builder');
    if (builder) {
        builder.classList.add('hidden');
    }
    currentTemplateId = null;
}

function deleteTemplate(templateId) {
    const eventSelector = document.getElementById('division-event-selector');
    const eventId = eventSelector?.value;

    if (!eventId) return;

    const divisions = db.load('divisions');
    const eventData = divisions[eventId];

    if (!eventData || !eventData.templates) return;

    const template = eventData.templates.find(t => t.id === templateId);
    if (!template) return;

    if (confirm(`Are you sure you want to delete the template "${template.name}"?\n\nThis will not affect already generated divisions.`)) {
        eventData.templates = eventData.templates.filter(t => t.id !== templateId);
        localStorage.setItem(_scopedKey('divisions'), JSON.stringify(divisions));
        loadTemplatesList();
        showMessage('Template deleted successfully!');
    }
}

function saveDivisionTemplate() {
    const eventSelector = document.getElementById('division-event-selector');
    if (!eventSelector || !eventSelector.value) {
        showMessage('Please select an event type first', 'error');
        return;
    }

    const eventId = eventSelector.value;

    // Get template-level settings
    const templateName = document.getElementById('template-name').value.trim();

    if (!templateName) {
        showMessage('Please enter a template name', 'error');
        return;
    }

    // Get criteria from the criteria builder
    const criteriaElements = document.querySelectorAll('.criteria-item');
    const criteria = [];

    criteriaElements.forEach(item => {
        const typeSelect = item.querySelector('[id^="criteria-type-"]');
        if (!typeSelect || !typeSelect.value) return;

        const criteriaType = typeSelect.value;
        const criteriaObj = { type: criteriaType, ranges: [] };

        // Handle gender criteria (predefined splits)
        if (criteriaType === 'gender') {
            criteriaObj.ranges = [
                { value: 'Male', label: 'Male' },
                { value: 'Female', label: 'Female' },
                { value: 'Open', label: 'Open' }
            ];
            criteria.push(criteriaObj);
            return;
        }

        // Handle rank criteria — read Kyu/Dan ranges from the UI
        if (criteriaType === 'rank') {
            item.querySelectorAll('.rank-range-item').forEach(rangeItem => {
                const minSel   = rangeItem.querySelector('.rank-min-select');
                const maxSel   = rangeItem.querySelector('.rank-max-select');
                const labelInp = rangeItem.querySelector('.rank-label');
                if (minSel && maxSel && minSel.value && maxSel.value) {
                    criteriaObj.ranges.push({
                        rankMin: minSel.value,
                        rankMax: maxSel.value,
                        label: labelInp?.value.trim() || `${minSel.value} – ${maxSel.value}`
                    });
                }
            });
            if (criteriaObj.ranges.length > 0) criteria.push(criteriaObj);
            return;
        }

        // Get ranges for numeric criteria (age, weight, experience)
        const rangeItems = item.querySelectorAll('.range-item');
        rangeItems.forEach(rangeItem => {
            const inputs = rangeItem.querySelectorAll('input');
            if (inputs.length >= 2) {
                const min = parseFloat(inputs[0].value);
                const max = parseFloat(inputs[1].value);
                const label = inputs[2]?.value.trim() || `${min}-${max}`;

                if (!isNaN(min) && !isNaN(max)) {
                    criteriaObj.ranges.push({ min, max, label });
                }
            }
        });

        if (criteriaObj.ranges.length > 0) {
            criteria.push(criteriaObj);
        }
    });

    if (criteria.length === 0) {
        showMessage('Please add at least one criteria', 'error');
        return;
    }

    // Read match duration (stored in seconds, input in minutes)
    const matchDurationMinutes = parseFloat(document.getElementById('template-match-duration').value);

    // Create template object
    const template = {
        id: currentTemplateId || generateUniqueId(),
        name: templateName,
        criteria: criteria,
        matchDuration: matchDurationMinutes ? Math.round(matchDurationMinutes * 60) : null,
        createdAt: currentTemplateId ? undefined : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    // Save template for this event
    const divisions = db.load('divisions');

    // Initialize event data if it doesn't exist
    if (!divisions[eventId]) {
        divisions[eventId] = {
            templates: [],
            generated: {}
        };
    }

    // Ensure templates array exists
    if (!divisions[eventId].templates) {
        divisions[eventId].templates = [];
    }

    if (currentTemplateId) {
        // Update existing template
        const index = divisions[eventId].templates.findIndex(t => t.id === currentTemplateId);
        if (index !== -1) {
            // Preserve createdAt
            template.createdAt = divisions[eventId].templates[index].createdAt;
            divisions[eventId].templates[index] = template;
        }
    } else {
        // Add new template
        divisions[eventId].templates.push(template);
    }

    localStorage.setItem(_scopedKey('divisions'), JSON.stringify(divisions));

    // Sync templates to server (debounced)
    const syncEventId = eventId;
    const syncTemplates = divisions[eventId]?.templates || [];
    _debouncedSync(`templates_${syncEventId}`, () => _syncTemplateToServer(syncEventId, syncTemplates), 1000);

    showMessage(currentTemplateId ? 'Template updated successfully!' : 'Template created successfully!');

    hideDivisionBuilder();
    loadTemplatesList();
}

// Division Generation
function generateDivisions() {
    console.log('=== GENERATE DIVISIONS CALLED ===');

    const eventSelector = document.getElementById('division-event-selector');
    const eventId = eventSelector?.value;
    console.log('Event ID:', eventId);

    if (!eventId) {
        console.error('No event ID');
        showMessage('⚠️ Please select an event type from the dropdown above first', 'error');
        // Highlight the dropdown to draw attention
        eventSelector.style.border = '2px solid #ef4444';
        setTimeout(() => {
            eventSelector.style.border = '';
        }, 2000);
        return;
    }

    // Get the division template for this event
    const allDivisions = JSON.parse(localStorage.getItem(_scopedKey('divisions')) || '{}');
    console.log('All divisions before generation:', allDivisions);

    const eventData = allDivisions[eventId];
    console.log('Event data:', eventData);

    if (!eventData || !eventData.templates || eventData.templates.length === 0) {
        console.error('No templates configured');
        showMessage('Please configure division criteria first (click "Configure Division Criteria")', 'error');
        return;
    }

    console.log('Templates:', eventData.templates);

    // Get tournament-scoped competitors
    const allCompetitors = db.load('competitors');
    const competitors = currentTournamentId
        ? allCompetitors.filter(c => c.tournamentId === currentTournamentId)
        : allCompetitors;

    console.log('Competitors count:', competitors.length);
    console.log('Tournament ID:', currentTournamentId);

    if (competitors.length === 0) {
        console.error('No competitors for this tournament');
        showMessage('No competitors registered for this tournament yet!', 'error');
        return;
    }

    // Calculate age for each competitor based on tournament settings
    const tournaments = db.load('tournaments');
    const currentTournament = tournaments.find(t => t.id === currentTournamentId);
    const ageCalculationMethod = currentTournament?.ageCalculationMethod || 'aau-standard';
    const eventDate = currentTournament?.date || new Date();

    // Add calculated age to each competitor (for division filtering)
    const competitorsWithAge = competitors.map(comp => ({
        ...comp,
        age: comp.dateOfBirth ? calculateAge(comp.dateOfBirth, ageCalculationMethod, eventDate) : (comp.age || 0)
    }));

    // Warn about competitors with invalid/missing DOB that won't match any age range
    const invalidAgeComps = competitorsWithAge.filter(c => isNaN(c.age) || c.age < 0);
    if (invalidAgeComps.length > 0) {
        const names = invalidAgeComps.map(c => `${c.firstName} ${c.lastName}`).join(', ');
        showMessage(`⚠️ ${invalidAgeComps.length} competitor(s) have an invalid date of birth and won't be placed in age-based divisions: ${names}. Please fix their DOB.`, 'error');
    }

    // Generate divisions for each template (AAU has multiple age-tier templates)
    console.log('Generating divisions for all templates...');

    const generatedDivisions = {};
    eventData.templates.forEach(template => {
        console.log('Using template:', template.name || template.id);
        const result = buildDivisions(competitorsWithAge, template.criteria);
        Object.assign(generatedDivisions, result);
    });

    console.log('Generated divisions:', generatedDivisions);
    console.log('Generated division keys:', Object.keys(generatedDivisions));

    // Validate division sizes and warn user
    validateDivisionSizes(generatedDivisions, eventData.templates[0]);

    // Store the generated divisions under this event (preserve templates)
    allDivisions[eventId] = {
        templates: eventData.templates, // Preserve templates
        generated: generatedDivisions,
        updatedAt: new Date().toISOString()
    };

    console.log('Saving to localStorage:', allDivisions[eventId]);
    localStorage.setItem(_scopedKey('divisions'), JSON.stringify(allDivisions));

    // Sync generated divisions to server (debounced)
    _debouncedSync('divisions', _syncDivisionsToServer, 2000);

    console.log('Calling loadDivisions...');
    loadDivisions();
    loadDashboard();
    console.log('=== GENERATE DIVISIONS COMPLETE ===');
    showMessage('Divisions generated successfully!');
}

function buildDivisions(competitors, criteria, prefix = '', index = 0) {
    console.log(`buildDivisions called - Index: ${index}, Prefix: "${prefix}", Competitors: ${competitors.length}`);

    if (index >= criteria.length) {
        console.log(`  → Final division: "${prefix.trim()}" with ${competitors.length} competitors`);
        return { [prefix.trim()]: competitors };
    }

    const currentCriteria = criteria[index];
    console.log(`  → Processing criteria type: ${currentCriteria.type}, Ranges:`, currentCriteria.ranges);
    const divisions = {};

    currentCriteria.ranges.forEach((range, rangeIdx) => {
        console.log(`    → Range ${rangeIdx}:`, range);
        let filtered;

        switch(currentCriteria.type) {
            case 'age':
                filtered = competitors.filter(c => c.age >= range.min && c.age <= range.max);
                console.log(`      → Age filter (${range.min}-${range.max}): ${filtered.length} matches`);
                break;
            case 'gender':
                filtered = competitors.filter(c => c.gender === range.value);
                console.log(`      → Gender filter (${range.value}): ${filtered.length} matches`);
                if (filtered.length === 0 && competitors.length > 0) {
                    console.log(`      → Sample competitor gender:`, competitors[0].gender);
                }
                break;
            case 'weight':
                filtered = competitors.filter(c => c.weight >= range.min && c.weight <= range.max);
                console.log(`      → Weight filter (${range.min}-${range.max}): ${filtered.length} matches`);
                break;
            case 'rank':
                // Normalize rank values from both old (belt colors) and new (Kyu/Dan) formats
                // to match RANK_ORDER entries (lowercase, e.g. '10th kyu', '1st dan').
                const normalizeRank = r => {
                    const s = (r || '').toLowerCase().replace(/ belt$/i, '').trim();
                    // Map old belt-color values → Kyu equivalents for backwards compatibility
                    const colorToKyu = {
                        'white': '10th kyu', 'yellow': '9th kyu', 'orange': '8th kyu',
                        'green': '7th kyu',  'blue':   '6th kyu', 'purple': '5th kyu',
                        'brown': '3rd kyu',  'black':  '1st dan',
                    };
                    return colorToKyu[s] || s;
                };
                if (range.rankMin !== undefined && range.rankMax !== undefined) {
                    // Grouped belt range (WKF/AAU style)
                    const minIdx = RANK_ORDER.indexOf(normalizeRank(range.rankMin));
                    const maxIdx = RANK_ORDER.indexOf(normalizeRank(range.rankMax));
                    filtered = competitors.filter(c => {
                        const cIdx = RANK_ORDER.indexOf(normalizeRank(c.rank));
                        return cIdx >= minIdx && cIdx <= maxIdx;
                    });
                    console.log(`      → Rank range filter (${range.rankMin}-${range.rankMax}): ${filtered.length} matches`);
                } else {
                    filtered = competitors.filter(c => normalizeRank(c.rank) === normalizeRank(range.value));
                    console.log(`      → Rank filter (${range.value}): ${filtered.length} matches`);
                }
                break;
            case 'experience':
                // DEBUG: Check what experience values we're working with
                if (competitors.length > 0 && rangeIdx === 0) {
                    console.log(`      → DEBUG: Sample experience values:`, competitors.slice(0, 5).map(c => ({
                        name: `${c.firstName} ${c.lastName}`,
                        experience: c.experience,
                        type: typeof c.experience
                    })));
                }
                filtered = competitors.filter(c => c.experience >= range.min && c.experience <= range.max);
                console.log(`      → Experience filter (${range.min}-${range.max}): ${filtered.length} matches`);
                if (filtered.length === 0 && competitors.length > 0) {
                    console.log(`      → DEBUG: First competitor experience value:`, competitors[0].experience, `(type: ${typeof competitors[0].experience})`);
                }
                break;
        }

        if (filtered.length > 0) {
            const newPrefix = prefix ? `${prefix} | ${range.label}` : range.label;
            console.log(`      → Creating sub-divisions with prefix: "${newPrefix}"`);
            const subDivisions = buildDivisions(filtered, criteria, newPrefix, index + 1);
            Object.assign(divisions, subDivisions);
        } else {
            console.log(`      → Skipping - no competitors matched`);
        }
    });

    return divisions;
}

function renderDivisions() {
    loadDivisions();
}

function loadDivisions() {
    console.log('=== LOAD DIVISIONS START ===');

    const allDivisions = JSON.parse(localStorage.getItem(_scopedKey('divisions')) || '{}');
    console.log('All divisions from localStorage:', allDivisions);

    const container = document.getElementById('divisions-container');
    console.log('Container element:', container);

    const hideEmpty = document.getElementById('hide-empty-divisions')?.checked || false;
    console.log('Hide empty checkbox:', hideEmpty);

    const eventSelector = document.getElementById('division-event-selector');
    const eventId = eventSelector?.value;
    console.log('Event selector:', eventSelector, 'Event ID:', eventId);

    if (!container) {
        console.error('Container not found!');
        return;
    }

    container.innerHTML = '';

    if (!eventId) {
        console.log('No event ID selected');
        container.innerHTML = '<p style="color: var(--text-secondary);">Select an event type to view divisions.</p>';
        return;
    }

    const eventData = allDivisions[eventId];
    console.log('Event data for', eventId, ':', eventData);

    if (!eventData || !eventData.generated) {
        // Auto-generate from existing competitors before giving up
        const allCompetitors = db.load('competitors');
        const competitors = currentTournamentId
            ? allCompetitors.filter(c => c.tournamentId === currentTournamentId && c.events && c.events.includes(eventId))
            : allCompetitors.filter(c => c.events && c.events.includes(eventId));

        if (competitors.length > 0) {
            const tournaments = db.load('tournaments');
            const currentTournament = tournaments.find(t => t.id === currentTournamentId);
            const ageCalc = currentTournament?.ageCalculationMethod || 'aau-standard';
            const eventDate = currentTournament?.date || new Date();
            const freshDivisions = JSON.parse(localStorage.getItem(_scopedKey('divisions')) || '{}');
            if (!freshDivisions[eventId]) freshDivisions[eventId] = { templates: [], generated: {} };
            if (!freshDivisions[eventId].generated) freshDivisions[eventId].generated = {};

            competitors.forEach(comp => {
                const age = comp.dateOfBirth ? calculateAge(comp.dateOfBirth, ageCalc, eventDate) : (comp.age || 0);
                const divName = buildAutoSingleDivisionName(comp, age);
                if (!freshDivisions[eventId].generated[divName]) freshDivisions[eventId].generated[divName] = [];
                if (!freshDivisions[eventId].generated[divName].find(c => c.id === comp.id)) {
                    freshDivisions[eventId].generated[divName].push(comp);
                }
            });
            localStorage.setItem(_scopedKey('divisions'), JSON.stringify(freshDivisions));
            // Re-read
            const updated = freshDivisions[eventId];
            if (updated && updated.generated && Object.keys(updated.generated).length > 0) {
                const divisions = updated.generated;
                const divisionKeys = Object.keys(divisions).sort();
                const clubsFallback = db.load('clubs');
                const getCountryFallback = (comp) => {
                    if (comp.country) return comp.country;
                    const club = clubsFallback.find(c => c.name === comp.club);
                    return club?.country || '-';
                };
                divisionKeys.forEach(divisionName => {
                    const divCompetitors = divisions[divisionName];
                    if (!Array.isArray(divCompetitors) || (hideEmpty && divCompetitors.length === 0)) return;
                    const sheet = document.createElement('div');
                    sheet.className = 'division-sheet';
                    const tableRows = divCompetitors.map(comp => `
                        <tr>
                            <td>${comp.firstName || '?'} ${comp.lastName || '?'}</td>
                            <td>${getDisplayAge(comp)}</td>
                            <td>${comp.gender || '-'}</td>
                            <td>${comp.weight !== undefined ? comp.weight + ' kg' : '-'}</td>
                            <td>${comp.rank || '-'}</td>
                            <td>${comp.club || '-'}</td>
                            <td>${getCountryFallback(comp)}</td>
                        </tr>`).join('');
                    sheet.innerHTML = `
                        <div class="division-header">${divisionName} (${divCompetitors.length} competitor${divCompetitors.length !== 1 ? 's' : ''})</div>
                        <div class="division-content">
                            <table class="division-table">
                                <thead><tr><th>Name</th><th>Age</th><th>Gender</th><th>Weight</th><th>Rank</th><th>Dojo</th><th>Country</th></tr></thead>
                                <tbody>${tableRows}</tbody>
                            </table>
                        </div>`;
                    container.appendChild(sheet);
                });
                return;
            }
        }

        console.log('No event data or generated divisions');
        container.innerHTML = '<p style="color: var(--text-secondary);">No competitors registered for this event yet.</p>';
        return;
    }

    const divisions = eventData.generated;
    const divisionKeys = Object.keys(divisions).sort();
    console.log('Division keys:', divisionKeys);
    console.log('Number of divisions:', divisionKeys.length);

    if (divisionKeys.length === 0) {
        console.log('No division keys found');
        container.innerHTML = '<p style="color: var(--text-secondary);">No divisions yet. Add competitors to see divisions appear automatically.</p>';
        return;
    }

    // Load clubs once for live country lookup
    const clubsForDivision = db.load('clubs');
    const getCompetitorCountry = (comp) => {
        if (comp.country) return comp.country;
        const club = clubsForDivision.find(c => c.name === comp.club);
        return club?.country || '-';
    };

    let displayedCount = 0;

    divisionKeys.forEach((divisionName, index) => {
        console.log(`Processing division ${index + 1}:`, divisionName);
        const competitors = divisions[divisionName];
        console.log(`  - Competitors:`, competitors);
        console.log(`  - Is array:`, Array.isArray(competitors));
        console.log(`  - Length:`, competitors?.length);

        if (!Array.isArray(competitors)) {
            console.log(`  - SKIPPED: Not an array`);
            return; // Skip if not an array
        }

        if (hideEmpty && competitors.length === 0) {
            console.log(`  - SKIPPED: Empty and hideEmpty is true`);
            return;
        }

        displayedCount++;
        console.log(`  - DISPLAYING (count: ${displayedCount})`);

        const sheet = document.createElement('div');
        sheet.className = 'division-sheet';

        let tableRows = competitors.map(comp => `
            <tr>
                <td>${comp.firstName || '?'} ${comp.lastName || '?'}</td>
                <td>${getDisplayAge(comp)}</td>
                <td>${comp.gender || '-'}</td>
                <td>${comp.weight !== undefined ? comp.weight + ' kg' : '-'}</td>
                <td>${comp.rank || '-'}</td>
                <td>${comp.club || '-'}</td>
                <td>${getCompetitorCountry(comp)}</td>
            </tr>
        `).join('');

        sheet.innerHTML = `
            <div class="division-header">
                ${divisionName} (${competitors.length} competitor${competitors.length !== 1 ? 's' : ''})
            </div>
            <div class="division-content">
                <table class="division-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Age</th>
                            <th>Gender</th>
                            <th>Weight</th>
                            <th>Rank</th>
                            <th>Dojo</th>
                            <th>Country</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
        `;
        console.log(`  - Appending sheet to container`);
        container.appendChild(sheet);
    });

    console.log('Total displayed:', displayedCount);

    if (displayedCount === 0 && hideEmpty) {
        console.log('No divisions displayed - all empty');
        container.innerHTML = '<p style="color: var(--text-secondary);">All divisions are empty. Uncheck "Show only divisions with competitors" to see all divisions.</p>';
    }

    console.log('Container children count:', container.children.length);
    console.log('=== LOAD DIVISIONS END ===');
}

function exportDivisions() {
    const divisions = db.load('divisions');
    const competitors = db.load('competitors');
    const eventTypes = db.load('eventTypes');

    if (Object.keys(divisions).length === 0) {
        showMessage('No divisions to export!', 'error');
        return;
    }

    let csvContent = 'Event,Division,Name,Age,Gender,Weight,Rank,Dojo,Country\n';
    let totalCompetitors = 0;

    Object.keys(divisions).forEach(eventId => {
        const eventData = divisions[eventId];
        if (!eventData || !eventData.generated) return;

        const event = eventTypes.find(e => String(e.id) === String(eventId));
        const eventName = event ? event.name : `Event ${eventId}`;

        Object.keys(eventData.generated).forEach(divisionName => {
            const competitorIds = eventData.generated[divisionName];
            if (!Array.isArray(competitorIds) || competitorIds.length === 0) return;

            competitorIds.forEach(compId => {
                const comp = competitors.find(c => c.id === compId);
                if (!comp) return;

                csvContent += [
                    escapeCSV(eventName),
                    escapeCSV(divisionName),
                    escapeCSV(`${comp.firstName} ${comp.lastName}`),
                    getDisplayAge(comp),
                    escapeCSV(comp.gender || '-'),
                    comp.weight || '',
                    escapeCSV(comp.rank || '-'),
                    escapeCSV(comp.club || '-'),
                    escapeCSV(comp.country || '-')
                ].join(',') + '\n';
                totalCompetitors++;
            });
        });
    });

    if (totalCompetitors === 0) {
        showMessage('No competitors found in generated divisions!', 'error');
        return;
    }

    downloadCSV(csvContent, 'divisions.csv');
    showMessage(`Exported ${totalCompetitors} competitors across all divisions.`);
}

// Helper to properly escape a value for CSV
function escapeCSV(value) {
    if (value == null) return '';
    const str = String(value);
    // If the value contains commas, quotes, or newlines, wrap in quotes and escape internal quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DELETE DIVISIONS FUNCTION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * FUNCTION: deleteDivisions()
 * PURPOSE: Safely delete all divisions for a selected event with two-stage confirmation
 *
 * FLOW:
 * 1. User selects event from division-event-selector
 * 2. User clicks "Delete Divisions" button
 * 3. FIRST WARNING: Shows division count and asks for confirmation
 * 4. If confirmed, shows SECOND WARNING with stronger language
 * 5. If confirmed again, deletes all divisions for the event
 * 6. Clears display and shows success message
 *
 * SAFETY FEATURES:
 * - Two-stage confirmation dialog to prevent accidental deletion
 * - Shows exact count of divisions to be deleted
 * - Shows event name in warning dialogs
 * - Warns that action is irreversible
 * - User can cancel at either confirmation stage
 *
 * ✅ FEATURES (2026-02-13):
 * 1. ✅ Two-stage confirmation system
 * 2. ✅ Detailed warning messages
 * 3. ✅ Shows division count before deletion
 * 4. ✅ Clears display after deletion
 * 5. ✅ Success message with count of deleted divisions
 * 6. ✅ Preserves division criteria/templates (only deletes generated divisions)
 *
 * ⚠️ KNOWN ISSUES:
 * 1. Doesn't delete associated brackets (leaves orphaned brackets)
 * 2. Doesn't clean up mat schedules referencing deleted divisions
 * 3. No undo functionality
 *
 * 📝 TODO:
 * - Add cascade delete for brackets
 * - Clean up mat schedules when divisions deleted
 * - Add undo/restore functionality
 * - Add option to archive instead of delete
 *
 * Last Updated: 2026-02-13
 * ═══════════════════════════════════════════════════════════════════════════
 */

function deleteDivisions() {
    const eventSelector = document.getElementById('division-event-selector');
    const eventId = eventSelector?.value;

    if (!eventId) {
        showMessage('Please select an event type first', 'error');
        return;
    }

    // Get event name for the warning messages
    const eventTypes = JSON.parse(localStorage.getItem(_scopedKey('eventTypes')) || '[]');
    const eventType = eventTypes.find(e => e.id == eventId);
    const eventName = eventType ? eventType.name : 'this event';

    // Get divisions to show count
    const allDivisions = JSON.parse(localStorage.getItem(_scopedKey('divisions')) || '{}');
    const eventData = allDivisions[eventId];

    if (!eventData || !eventData.generated) {
        showMessage('No divisions found for this event', 'error');
        return;
    }

    const divisionCount = Object.keys(eventData.generated).length;

    // FIRST WARNING
    const firstConfirm = confirm(
        `⚠️ DELETE GENERATED DIVISIONS?\n\n` +
        `Event: ${eventName}\n` +
        `Divisions to delete: ${divisionCount}\n\n` +
        `This will delete:\n` +
        `✓ All generated divisions (competitor assignments)\n\n` +
        `This will NOT delete:\n` +
        `✓ Division criteria/templates (age, gender, weight ranges)\n` +
        `✓ You can regenerate divisions from criteria after deletion\n\n` +
        `Note: Associated brackets and schedules will remain but may become invalid.\n\n` +
        `Are you sure you want to continue?`
    );

    if (!firstConfirm) {
        return; // User cancelled
    }

    // SECOND WARNING (more severe)
    const secondConfirm = confirm(
        `🚨 FINAL WARNING - THIS CANNOT BE UNDONE!\n\n` +
        `You are about to permanently delete ${divisionCount} generated divisions from "${eventName}".\n\n` +
        `Your criteria template will be preserved and you can regenerate divisions later.\n\n` +
        `Click OK to DELETE GENERATED DIVISIONS.\n` +
        `Click Cancel to keep your divisions.`
    );

    if (!secondConfirm) {
        showMessage('Division deletion cancelled', 'error');
        return; // User cancelled
    }

    // User confirmed twice - proceed with deletion
    // Only delete the generated divisions, preserve criteria/templates
    delete eventData.generated;
    eventData.updatedAt = new Date().toISOString();
    localStorage.setItem(_scopedKey('divisions'), JSON.stringify(allDivisions));

    // Clear the display
    renderDivisions();

    showMessage(`Deleted ${divisionCount} generated divisions from ${eventName}. Criteria preserved.`);
}

function deleteCriteria() {
    const eventSelector = document.getElementById('division-event-selector');
    const eventId = eventSelector?.value;

    if (!eventId) {
        showMessage('Please select an event type first', 'error');
        return;
    }

    // Get event name for the warning messages
    const eventTypes = JSON.parse(localStorage.getItem(_scopedKey('eventTypes')) || '[]');
    const eventType = eventTypes.find(e => e.id == eventId);
    const eventName = eventType ? eventType.name : 'this event';

    // Get divisions to check if criteria exists
    const allDivisions = JSON.parse(localStorage.getItem(_scopedKey('divisions')) || '{}');
    const eventData = allDivisions[eventId];

    if (!eventData || !eventData.criteria || eventData.criteria.length === 0) {
        showMessage('No criteria template found for this event', 'error');
        return;
    }

    const criteriaCount = eventData.criteria.length;
    const hasGeneratedDivisions = eventData.generated && Object.keys(eventData.generated).length > 0;

    // FIRST WARNING
    const firstConfirm = confirm(
        `⚠️ DELETE CRITERIA TEMPLATE?\n\n` +
        `Event: ${eventName}\n` +
        `Criteria to delete: ${criteriaCount} rule(s)\n\n` +
        `This will delete:\n` +
        `✗ All division criteria (age, gender, weight ranges)\n` +
        `✗ Bracket type overrides per criteria\n\n` +
        (hasGeneratedDivisions ?
            `⚠️ WARNING: You have ${Object.keys(eventData.generated).length} generated divisions.\n` +
            `Deleting criteria will make it impossible to regenerate them!\n\n` : '') +
        `You will need to reconfigure criteria from scratch.\n\n` +
        `Are you sure you want to continue?`
    );

    if (!firstConfirm) {
        return; // User cancelled
    }

    // SECOND WARNING (more severe)
    const secondConfirm = confirm(
        `🚨 FINAL WARNING - THIS CANNOT BE UNDONE!\n\n` +
        `You are about to permanently delete the division criteria template for "${eventName}".\n\n` +
        `This action is IRREVERSIBLE.\n\n` +
        `Click OK to DELETE CRITERIA TEMPLATE.\n` +
        `Click Cancel to keep your criteria.`
    );

    if (!secondConfirm) {
        showMessage('Criteria deletion cancelled', 'error');
        return; // User cancelled
    }

    // User confirmed twice - proceed with deletion
    // Delete criteria, preserve generated divisions
    delete eventData.criteria;
    eventData.updatedAt = new Date().toISOString();
    localStorage.setItem(_scopedKey('divisions'), JSON.stringify(allDivisions));

    // Hide the criteria builder if shown
    const builder = document.getElementById('division-builder');
    if (builder) {
        builder.classList.add('hidden');
    }

    showMessage(`Deleted criteria template for ${eventName}. Generated divisions preserved.`);
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BRACKET MANAGEMENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ROUTE: Divisions tab → "Generate Brackets" button → Brackets tab
 *
 * FLOW:
 * 1. showBracketGenerator() - Opens modal from Divisions tab
 * 2. Auto-populates bracket type and seeding method from event defaults
 * 3. User can override defaults or select division
 * 4. generateBrackets() - Creates bracket structure
 * 5. Bracket saved to brackets[bracketId]
 * 6. loadBrackets() - Displays all brackets in Brackets tab
 *
 * BRACKET TYPES:
 * - single-elimination: One loss and you're out
 * - double-elimination: Winners + Losers brackets
 * - round-robin: Everyone fights everyone
 * - kata-flags: Judges vote with flags (best of 3/5)
 * - kata-points: Judges score 0-10, highest total wins
 *
 * SEEDING OPTIONS:
 * - random: Shuffled randomly
 * - ordered: By registration order
 * - rank: Higher belts seeded first (2nd Dan → White Belt)
 * - age: Younger competitors seeded first
 *
 * DATA STRUCTURE:
 * brackets = {
 *   "bracketId": {
 *     id: timestamp,
 *     type: 'single-elimination',
 *     division: "8-10 Male 30-40kg",
 *     eventId: "1234567890",
 *     rounds: 3,
 *     createdAt: "ISO timestamp",
 *     matches: [
 *       {id, round, position, competitor1, competitor2, winner, score1, score2, status}
 *     ]
 *   }
 * }
 *
 * ✅ FEATURES (2026-02-13):
 * 1. ✅ Auto-populates bracket type from eventType.bracketType
 * 2. ✅ Auto-populates seeding method from eventType.seedingMethod
 * 3. ✅ Defaults can be overridden in bracket generator modal
 * 4. ✅ Event types store default bracketType and seedingMethod
 * 5. ✅ Integrated with operator scoreboard for auto-loading competitors
 *
 * ⚠️ KNOWN ISSUES:
 * 1. Brackets use shallow copy of competitors (stale data risk)
 * 2. viewBracket() not implemented (just shows alert)
 * 3. No bracket visual tree display
 *
 * 📝 TODO:
 * - Implement visual bracket tree display
 * - Link brackets to mat schedule
 * - Add bracket editing/seeding adjustments
 * - Deep copy competitors to avoid stale data
 *
 * Last Updated: 2026-02-13
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Bracket Management
function showBracketGenerator() {
    console.log('=== SHOW BRACKET GENERATOR ===');
    const modal = document.getElementById('bracket-generator-modal');
    const select = document.getElementById('bracket-division-select');
    const eventSelector = document.getElementById('division-event-selector');
    const eventId = eventSelector?.value;

    console.log('Modal:', modal);
    console.log('Event selector:', eventSelector);
    console.log('Event ID:', eventId);

    if (!eventId) {
        console.error('No event ID selected');
        showMessage('Please select an event type first', 'error');
        return;
    }

    // Load divisions for selected event
    const allDivisions = JSON.parse(localStorage.getItem(_scopedKey('divisions')) || '{}');
    const eventData = allDivisions[eventId];

    if (!eventData || !eventData.generated) {
        showMessage('Please generate divisions first', 'error');
        return;
    }

    // Get event type to pre-populate defaults
    const eventTypes = JSON.parse(localStorage.getItem(_scopedKey('eventTypes')) || '[]');
    const eventType = eventTypes.find(e => e.id == eventId);

    // Populate scoreboard dropdown from unified config
    const scoreboardTypeSelect = document.getElementById('bracket-scoreboard-type');
    const unifiedScConfig = getUnifiedScoreboardConfig();

    if (scoreboardTypeSelect) {
        scoreboardTypeSelect.innerHTML = '<option value="">Select Scoreboard Type</option>';
        if (!unifiedScConfig) {
            const warnOpt = document.createElement('option');
            warnOpt.value = '';
            warnOpt.textContent = '⚠ No config — go to Scoreboard Setup first';
            warnOpt.disabled = true;
            scoreboardTypeSelect.appendChild(warnOpt);
        } else {
            const types = [
                { value: 'kumite',      label: 'Kumite (Sparring)',     key: 'kumite'     },
                { value: 'kata-flags',  label: 'Kata – Flags',          key: 'kataFlags'  },
                { value: 'kata-points', label: 'Kata – Points',         key: 'kataPoints' },
                { value: 'kobudo',      label: 'Kobudo (Weapons Kata)', key: 'kobudo'     },
            ];
            types.forEach(({ value, label, key }) => {
                if (unifiedScConfig[key]) {
                    const opt = document.createElement('option');
                    opt.value = value;
                    opt.textContent = label;
                    opt.setAttribute('data-base-type', value);
                    scoreboardTypeSelect.appendChild(opt);
                }
            });

            // Auto-select scoreboard type based on event name keywords
            if (eventType) {
                const name = (eventType.name || '').toLowerCase();
                let suggestedType = '';
                // Kobudo / weapons first (most specific)
                if (name.includes('kobudo') || name.includes('weapon') ||
                    name.includes('nunchaku') || name.includes('kama') ||
                    name.includes(' sai') || name.includes('tonfa') ||
                    /\bbo\b/.test(name)) {
                    suggestedType = 'kobudo';
                // Kata variants
                } else if (name.includes('kata') &&
                           (name.includes('point') || name.includes('score') || name.includes('panel'))) {
                    suggestedType = 'kata-points';
                } else if (name.includes('kata') &&
                           (name.includes('flag') || name.includes('head-to-head') || name.includes('h2h'))) {
                    suggestedType = 'kata-flags';
                } else if (name.includes('kata')) {
                    suggestedType = 'kata-flags'; // generic kata → flags (head-to-head) by default
                // Kumite / sparring
                } else if (name.includes('kumite') || name.includes('sparring') ||
                           name.includes('fighting') || name.includes('combat')) {
                    suggestedType = 'kumite';
                }
                // Only apply if that option actually exists in the dropdown
                if (suggestedType && scoreboardTypeSelect.querySelector(`option[value="${suggestedType}"]`)) {
                    scoreboardTypeSelect.value = suggestedType;
                }
            }
        }
    }

    // Initialize bracket type options AFTER scoreboard type is auto-selected
    updateBracketTypeOptions();

    // Auto-populate bracket type and seeding method from event defaults
    if (eventType) {
        const bracketTypeSelect = document.getElementById('bracket-type');
        const seedingMethodSelect = document.getElementById('seeding-method');

        if (bracketTypeSelect && eventType.bracketType) {
            bracketTypeSelect.value = eventType.bracketType;
        }
        if (seedingMethodSelect && eventType.seedingMethod) {
            seedingMethodSelect.value = eventType.seedingMethod;
        }
    }

    // Populate division dropdown
    select.innerHTML = '<option value="">Select a division</option>';
    Object.keys(eventData.generated).forEach(divName => {
        const competitors = eventData.generated[divName];
        if (competitors && competitors.length > 0) {
            const option = document.createElement('option');
            option.value = divName;
            option.textContent = `${divName} (${competitors.length} competitors)`;
            select.appendChild(option);
        }
    });

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    modal.style.zIndex = '10000';

    console.log('Modal should be visible now! Display:', modal.style.display, 'Z-index:', modal.style.zIndex);
}

function hideBracketGenerator() {
    document.getElementById('bracket-generator-modal').classList.add('hidden');
}

function updateBracketTypeOptions() {
    const scoreboardSelect = document.getElementById('bracket-scoreboard-type');
    const bracketTypeSelect = document.getElementById('bracket-type');

    if (!scoreboardSelect || !bracketTypeSelect) return;

    // The selected value is now the base type string directly (e.g. 'kumite', 'kata-flags')
    const baseType = scoreboardSelect.value ||
        scoreboardSelect.selectedOptions[0]?.getAttribute('data-base-type') || '';

    if (!baseType) {
        bracketTypeSelect.innerHTML = `
            <option value="">Select Bracket Type</option>
            <option value="single-elimination">Single Elimination</option>
            <option value="double-elimination">Double Elimination</option>
            <option value="round-robin">Round Robin</option>
            <option value="pool-play">Pool Play</option>
            <option value="ranking-list">Ranking List (Kata/Kobudo)</option>
        `;
        return;
    }

    let options = '';
    if (baseType === 'kumite' || baseType === 'kata-flags') {
        options = `
            <option value="">Select Bracket Type</option>
            <option value="single-elimination">Single Elimination (Recommended)</option>
            <option value="double-elimination">Double Elimination</option>
            <option value="repechage">Repechage</option>
            <option value="round-robin">Round Robin</option>
        `;
    } else if (baseType === 'kata-points' || baseType === 'kobudo') {
        options = `
            <option value="">Select Bracket Type</option>
            <option value="ranking-list">Ranking List (Recommended)</option>
            <option value="round-robin">Round Robin</option>
        `;
    } else {
        options = `
            <option value="">Select Bracket Type</option>
            <option value="single-elimination">Single Elimination</option>
            <option value="double-elimination">Double Elimination</option>
            <option value="round-robin">Round Robin</option>
            <option value="ranking-list">Ranking List</option>
        `;
    }
    bracketTypeSelect.innerHTML = options;
}

function getTemplateDurationForEvent(eventId) {
    // Check event-level match_duration_seconds first (from DB)
    const eventTypes = JSON.parse(localStorage.getItem(_scopedKey('eventTypes')) || '[]');
    const evt = eventTypes.find(e => String(e.id) === String(eventId));
    if (evt?.matchDurationSeconds) {
        return evt.matchDurationSeconds;
    }

    // Fall back to first template's matchDuration
    const allDivisions = JSON.parse(localStorage.getItem(_scopedKey('divisions')) || '{}');
    const eventData = allDivisions[eventId];
    if (eventData?.templates?.[0]?.matchDuration) {
        return eventData.templates[0].matchDuration;
    }
    return null;
}

/**
 * Get match duration for a specific division based on its template.
 * Matches the division name against template age groups to find the right duration.
 */
function getDivisionMatchDuration(divisionName, eventId) {
    const allDivisions = JSON.parse(localStorage.getItem(_scopedKey('divisions')) || '{}');
    const eventData = allDivisions[eventId];
    if (!eventData?.templates) return null;

    // Check each template — if the division name contains the template's age label, use that duration
    for (const tmpl of eventData.templates) {
        if (tmpl.matchDuration && tmpl.criteria) {
            const ageCriteria = tmpl.criteria.find(c => c.type === 'age');
            if (ageCriteria) {
                const matches = ageCriteria.ranges.some(r => divisionName.includes(r.label));
                if (matches) return tmpl.matchDuration;
            }
        }
    }

    // Fall back to event-level duration
    return getTemplateDurationForEvent(eventId);
}

function generateBracketsForAllDivisions() {
    console.log('=== GENERATE BRACKETS FOR ALL DIVISIONS ===');
    const eventSelector = document.getElementById('division-event-selector');
    const eventId = eventSelector?.value;

    console.log('Event ID:', eventId);

    if (!eventId) {
        showMessage('Please select an event type first', 'error');
        return;
    }

    const bracketType = document.getElementById('bracket-type').value;
    const seedingMethod = document.getElementById('seeding-method').value;
    const matchDuration = parseInt(document.getElementById('match-duration').value);
    const scoreboardType = document.getElementById('bracket-scoreboard-type').value;

    console.log('Bracket Type:', bracketType);
    console.log('Seeding Method:', seedingMethod);
    console.log('Match Duration:', matchDuration);
    console.log('Scoreboard Type:', scoreboardType);

    if (!scoreboardType) {
        showMessage('Please select a scoreboard configuration', 'error');
        return;
    }

    // Get scoreboard configuration — try unified config first, fall back to legacy named configs
    const unifiedCfg = getUnifiedScoreboardConfig();
    const typeKeyMap = { 'kumite': 'kumite', 'kata-flags': 'kataFlags', 'kata-points': 'kataPoints', 'kobudo': 'kobudo' };
    const typeKey = typeKeyMap[scoreboardType];
    let scoreboardConfig = null;

    if (unifiedCfg && typeKey && unifiedCfg[typeKey]) {
        scoreboardConfig = {
            id: 'unified-' + scoreboardType,
            name: scoreboardType,
            baseType: scoreboardType,
            settings: unifiedCfg[typeKey]
        };
    } else {
        // Legacy fallback: try old named scoreboardConfigs array
        const scoreboardConfigs = db.load('scoreboardConfigs');
        scoreboardConfig = scoreboardConfigs.find(c => c.id == scoreboardType);
    }

    if (!scoreboardConfig) {
        if (!unifiedCfg) {
            showMessage('No scoreboard configured — go to the Scoreboard Setup tab first.', 'error');
        } else {
            showMessage('Scoreboard type not configured. Check Scoreboard Setup.', 'error');
        }
        return;
    }

    // Get all divisions for this event
    const allDivisions = JSON.parse(localStorage.getItem(_scopedKey('divisions')) || '{}');
    const eventData = allDivisions[eventId];

    if (!eventData || !eventData.generated) {
        showMessage('No divisions found for this event', 'error');
        return;
    }

    const divisionNames = Object.keys(eventData.generated);

    if (divisionNames.length === 0) {
        showMessage('No divisions found for this event', 'error');
        return;
    }

    if (!confirm(`Generate ${bracketType} brackets for all ${divisionNames.length} divisions in this event?`)) {
        return;
    }

    let successCount = 0;
    let skippedCount = 0;

    divisionNames.forEach(divisionName => {
        let competitors = [...(eventData.generated[divisionName] || [])];

        // Deduplicate competitors by ID
        const seenIds = new Set();
        competitors = competitors.filter(c => {
            if (!c || !c.id) return false;
            if (seenIds.has(c.id)) return false;
            seenIds.add(c.id);
            return true;
        });

        if (competitors.length < 2) {
            skippedCount++;
            return; // Skip divisions with less than 2 competitors
        }

        // Apply seeding
        competitors = seedCompetitors(competitors, seedingMethod);

        // Generate bracket structure
        let bracket = null;
        if (bracketType === 'single-elimination') {
            bracket = generateSingleEliminationBracket(competitors, divisionName, eventId, matchDuration);
        } else if (bracketType === 'double-elimination') {
            bracket = generateDoubleEliminationBracket(competitors, divisionName, eventId, matchDuration);
        } else if (bracketType === 'repechage') {
            bracket = generateRepechageBracket(competitors, divisionName, eventId, matchDuration);
        } else if (bracketType === 'round-robin') {
            bracket = generateRoundRobinBracket(competitors, divisionName, eventId, matchDuration);
        } else if (bracketType === 'pool-play') {
            bracket = generatePoolPlayBracket(competitors, divisionName, eventId, matchDuration);
        } else if (bracketType === 'ranking-list') {
            bracket = generateRankingListBracket(competitors, divisionName, eventId);
        }

        if (bracket) {
            // Add scoreboard configuration
            bracket.scoreboardConfigId = scoreboardType;
            bracket.scoreboardConfig = scoreboardConfig;

            // Store match duration on bracket (seconds)
            // Priority: form override > per-division template duration > event-level duration
            const formDuration = parseInt(document.getElementById('match-duration').value);
            const divisionDuration = getDivisionMatchDuration(divisionName, eventId);
            const eventDuration = getTemplateDurationForEvent(eventId);
            bracket.matchDuration = (formDuration ? formDuration * 60 : null) || divisionDuration || eventDuration || null;

            // Save bracket
            const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
            const bracketId = `${eventId}_${divisionName}_${generateUniqueId()}`;
            brackets[bracketId] = bracket;
            saveBrackets(brackets);
            successCount++;
        }
    });

    // Sync all brackets to server (debounced)
    _debouncedSync('brackets', _syncBracketsToServer, 2000);

    hideBracketGenerator();
    showMessage(`Generated ${successCount} brackets successfully! ${skippedCount > 0 ? `(Skipped ${skippedCount} divisions with less than 2 competitors)` : ''}`);

    // Navigate to schedule view so the user can immediately see unassigned divisions
    document.querySelector('[data-view="schedule"]')?.click();
}

function generateBrackets(event) {
    console.log('=== GENERATE BRACKETS CALLED ===');
    event.preventDefault();

    const divisionName = document.getElementById('bracket-division-select').value;
    const bracketType = document.getElementById('bracket-type').value;
    const scoreboardType = document.getElementById('bracket-scoreboard-type').value;
    const seedingMethod = document.getElementById('seeding-method').value;
    const matchDuration = parseInt(document.getElementById('match-duration').value) || 2;
    const matAssignment = document.getElementById('mat-assignment')?.value || null;
    const eventSelector = document.getElementById('division-event-selector');
    const eventId = eventSelector?.value;

    console.log('Division:', divisionName);
    console.log('Bracket Type:', bracketType);
    console.log('Scoreboard Type:', scoreboardType);
    console.log('Event ID:', eventId);

    if (!divisionName || !eventId) {
        console.error('Missing division or event ID');
        showMessage('Please select a division', 'error');
        return;
    }

    // Validate required fields
    if (!bracketType) {
        showMessage('Please select a bracket type', 'error');
        return;
    }

    if (!scoreboardType) {
        showMessage('Please select a scoreboard type', 'error');
        return;
    }

    // Get scoreboard configuration — prefer unified config, fall back to legacy named configs
    const unifiedCfg = getUnifiedScoreboardConfig();

    if (!unifiedCfg) {
        showMessage('Please configure your scoreboards first in the Scoreboard Setup tab.', 'error');
        return;
    }

    const typeKeyMap = { 'kumite': 'kumite', 'kata-flags': 'kataFlags', 'kata-points': 'kataPoints', 'kobudo': 'kobudo' };
    const typeKey = typeKeyMap[scoreboardType];

    let scoreboardConfig = null;
    let baseType = scoreboardType; // scoreboardType IS the base type now

    if (typeKey && unifiedCfg[typeKey]) {
        // Build a synthetic config object compatible with downstream code
        scoreboardConfig = {
            id:       'unified-' + scoreboardType,
            name:      scoreboardType,
            baseType:  scoreboardType,
            settings:  unifiedCfg[typeKey],
        };
    } else {
        // Legacy fallback: try old named scoreboardConfigs array
        const scoreboardConfigs = db.load('scoreboardConfigs');
        const legacyCfg = scoreboardConfigs.find(c => c.id == scoreboardType);
        if (legacyCfg) {
            scoreboardConfig = legacyCfg;
            baseType = legacyCfg.baseType;
        }
    }

    if (!scoreboardConfig) {
        showMessage('Scoreboard type not configured. Please set up scoreboards first.', 'error');
        return;
    }

    // Validate bracket type compatibility with scoreboard
    if ((baseType === 'kata-points' || baseType === 'kobudo') &&
        (bracketType === 'single-elimination' || bracketType === 'double-elimination')) {
        showMessage('Point-based scoring (Kata Points/Kobudo) works best with Ranking List or Round Robin formats', 'error');
        return;
    }

    // Get competitors for this division
    const allDivisions = JSON.parse(localStorage.getItem(_scopedKey('divisions')) || '{}');
    const eventData = allDivisions[eventId];
    let competitors = [...(eventData.generated[divisionName] || [])];

    // Deduplicate competitors by ID
    const seenIds = new Set();
    competitors = competitors.filter(c => {
        if (!c || !c.id) return false;
        if (seenIds.has(c.id)) return false;
        seenIds.add(c.id);
        return true;
    });

    if (competitors.length < 2) {
        showMessage('Need at least 2 competitors to create a bracket', 'error');
        return;
    }

    // Apply seeding
    competitors = seedCompetitors(competitors, seedingMethod);

    // Generate bracket structure
    let bracket = null;
    if (bracketType === 'single-elimination') {
        bracket = generateSingleEliminationBracket(competitors, divisionName, eventId);
    } else if (bracketType === 'double-elimination') {
        bracket = generateDoubleEliminationBracket(competitors, divisionName, eventId);
    } else if (bracketType === 'repechage') {
        bracket = generateRepechageBracket(competitors, divisionName, eventId);
    } else if (bracketType === 'round-robin') {
        bracket = generateRoundRobinBracket(competitors, divisionName, eventId);
    } else if (bracketType === 'pool-play') {
        bracket = generatePoolPlayBracket(competitors, divisionName, eventId);
    } else if (bracketType === 'ranking-list') {
        bracket = generateRankingListBracket(competitors, divisionName, eventId);
    }

    // Add scoreboard configuration to bracket
    if (scoreboardType) {
        bracket.scoreboardConfigId = scoreboardType;
        bracket.scoreboardConfig = scoreboardConfig;
    }

    // Store match duration on bracket (seconds)
    const templateDuration = getTemplateDurationForEvent(eventId);
    bracket.matchDuration = templateDuration || null;

    // Calculate and add timing estimates
    const timing = calculateBracketTiming(bracket, scoreboardConfig);
    bracket.timing = timing;
    bracket.seedingMethod = seedingMethod;
    bracket.matAssignment = matAssignment;

    // Save bracket
    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
    const bracketId = `${eventId}_${divisionName}_${generateUniqueId()}`;
    brackets[bracketId] = bracket;
    saveBrackets(brackets);

    // If a mat was assigned, auto-add this division to the mat schedule
    if (matAssignment) {
        const matSchedule = loadMatScheduleData();
        if (!matSchedule[matAssignment]) matSchedule[matAssignment] = [];
        // Remove any existing slot for this division on any mat (avoid duplicates)
        Object.keys(matSchedule).forEach(mid => {
            matSchedule[mid] = (matSchedule[mid] || []).filter(s => s.division !== divisionName);
        });
        // Add to the selected mat
        matSchedule[matAssignment].push({
            order: matSchedule[matAssignment].length,
            division: divisionName,
            eventId: eventId,
            estimatedDuration: estimateDivisionDuration(divisionName, eventId),
            durationOverride: null,
            estimatedStartTime: null,
            estimatedEndTime: null,
            actualStartTime: null,
            actualEndTime: null,
            status: 'upcoming'
        });
        saveMatScheduleData(matSchedule);
    }

    hideBracketGenerator();
    showMessage('Bracket generated successfully!');

    // Navigate to schedule view so the user can immediately see the division
    document.querySelector('[data-view="schedule"]')?.click();
}

function seedCompetitors(competitors, method) {
    let seeded = [...competitors];

    // First, apply the sorting/randomization method
    switch (method) {
        case 'random':
            // Shuffle randomly
            for (let i = seeded.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [seeded[i], seeded[j]] = [seeded[j], seeded[i]];
            }
            break;

        case 'ordered':
            // Keep registration order (already in order)
            break;

        case 'rank':
            // Seed by belt rank (highest first)
            const rankOrder = ['3rd Dan', '2nd Dan', '1st Dan', 'Brown', 'Purple', 'Blue', 'Green', 'Orange', 'Yellow', 'White'];
            seeded.sort((a, b) => {
                const aRank = rankOrder.indexOf(a.rank);
                const bRank = rankOrder.indexOf(b.rank);
                // Handle ranks not in the list
                const aIndex = aRank === -1 ? 999 : aRank;
                const bIndex = bRank === -1 ? 999 : bRank;
                return aIndex - bIndex; // Lower index = higher rank
            });
            break;

        case 'age':
            // Seed by age (younger first)
            seeded.sort((a, b) => a.age - b.age);
            break;

        case 'country':
            // Seed by country (alphabetically), then randomize within country
            seeded.sort((a, b) => {
                const countryCompare = (a.country || 'Unknown').localeCompare(b.country || 'Unknown');
                if (countryCompare !== 0) return countryCompare;
                return Math.random() - 0.5; // Randomize within same country
            });
            break;

        case 'club':
            // Seed by club (alphabetically), then randomize within club
            seeded.sort((a, b) => {
                const clubCompare = (a.club || 'Unknown').localeCompare(b.club || 'Unknown');
                if (clubCompare !== 0) return clubCompare;
                return Math.random() - 0.5; // Randomize within same club
            });
            break;
    }

    // For competitive seeding methods (rank, ordered), apply tournament bracket seeding
    // This ensures #1 seed meets #2 seed in finals (if both win)
    if (method === 'rank' || method === 'ordered') {
        seeded = applyTournamentBracketSeeding(seeded);
    }

    return seeded;
}

// Apply proper tournament bracket seeding (1 vs 16, 8 vs 9, 5 vs 12, etc.)
function applyTournamentBracketSeeding(competitors) {
    if (competitors.length <= 2) {
        return competitors;
    }

    const n = competitors.length;
    const rounds = Math.ceil(Math.log2(n));
    const bracketSize = Math.pow(2, rounds);

    // Standard tournament seeding order for power-of-2 bracket sizes
    // This ensures #1 seed can't meet #2 seed until finals
    const seedOrder = generateTournamentSeedOrder(bracketSize);

    // Map competitors to bracket positions
    const bracketPositions = new Array(bracketSize).fill(null);

    for (let i = 0; i < n; i++) {
        // Place competitor at their seeded position
        const seedPosition = seedOrder[i];
        bracketPositions[seedPosition] = competitors[i];
    }

    // Return only non-null positions (actual competitors)
    return bracketPositions.filter(c => c !== null);
}

// Generate standard tournament seed order (e.g., for 16: [1,16,8,9,5,12,4,13,3,14,6,11,7,10,2,15])
function generateTournamentSeedOrder(size) {
    if (size === 1) return [0];
    if (size === 2) return [0, 1];

    // Recursive generation of tournament seeding
    const half = generateTournamentSeedOrder(size / 2);
    const order = [];

    for (let i = 0; i < half.length; i++) {
        order.push(half[i]); // Top half seed
        order.push(size - 1 - half[i]); // Bottom half seed (complement)
    }

    return order;
}

// Calculate match timing estimates for bracket
function calculateBracketTiming(bracket, scoreboardConfig) {
    const baseType = scoreboardConfig?.baseType || 'kumite';

    // Get match duration and buffer from scoreboard config
    const matchDuration = scoreboardConfig?.settings?.matchDuration || 2; // minutes
    const bufferTime = (scoreboardConfig?.settings?.bufferTime || 60) / 60; // convert seconds to minutes

    let totalMatches = 0;
    let completedMatches = 0;

    if (bracket.type === 'single-elimination' || bracket.type === 'repechage') {
        totalMatches = bracket.matches.filter(m => m.status !== 'empty').length
            + (bracket.repechageA || []).filter(m => m.status !== 'empty').length
            + (bracket.repechageB || []).filter(m => m.status !== 'empty').length;
        completedMatches = bracket.matches.filter(m => m.status === 'completed' || m.status === 'bye').length
            + (bracket.repechageA || []).filter(m => m.status === 'completed' || m.status === 'bye').length
            + (bracket.repechageB || []).filter(m => m.status === 'completed' || m.status === 'bye').length;
    } else if (bracket.type === 'double-elimination') {
        totalMatches = bracket.winners.filter(m => m.status !== 'empty').length +
                      (bracket.losers?.length || 0) +
                      (bracket.finals ? 1 : 0);
        completedMatches = bracket.winners.filter(m => m.status === 'completed' || m.status === 'bye').length +
                          (bracket.losers?.filter(m => m.status === 'completed' || m.status === 'bye').length || 0);
    } else if (bracket.type === 'round-robin') {
        totalMatches = bracket.matches.length;
        completedMatches = bracket.matches.filter(m => m.status === 'completed').length;
    }

    const remainingMatches = totalMatches - completedMatches;

    // Calculate time per match (including buffer)
    const timePerMatch = matchDuration + bufferTime;

    // Estimate total time
    const estimatedTotalMinutes = totalMatches * timePerMatch;
    const estimatedRemainingMinutes = remainingMatches * timePerMatch;

    // Format time
    const formatTime = (minutes) => {
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }
        return `${mins}m`;
    };

    return {
        totalMatches,
        completedMatches,
        remainingMatches,
        matchDuration,
        bufferTime: bufferTime * 60, // convert back to seconds for display
        timePerMatch,
        estimatedTotalMinutes,
        estimatedRemainingMinutes,
        estimatedTotalTime: formatTime(estimatedTotalMinutes),
        estimatedRemainingTime: formatTime(estimatedRemainingMinutes),
        progressPercent: totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0
    };
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function generateSingleEliminationBracket(competitors, divisionName, eventId) {
    const rounds = Math.ceil(Math.log2(competitors.length));
    const totalSlots = Math.pow(2, rounds);

    // Create bracket structure
    const bracket = {
        id: generateUniqueId(),
        type: 'single-elimination',
        division: divisionName,
        divisionName: divisionName,
        eventId: eventId,
        rounds: rounds,
        competitors: competitors,
        createdAt: new Date().toISOString(),
        matches: []
    };

    // First round matches
    let matchId = 1;
    const byeAdvances = []; // Track who advances via bye

    for (let i = 0; i < totalSlots / 2; i++) {
        const comp1 = competitors[i * 2] || null;
        const comp2 = competitors[i * 2 + 1] || null;

        // Determine match status
        let status, winner;
        if (comp1 && comp2) {
            status = 'pending';
            winner = null;
        } else if (comp1 || comp2) {
            // Bye - automatically advance the present competitor
            status = 'bye';
            winner = comp1 || comp2;
            byeAdvances.push({ round: 2, position: Math.floor(i / 2), competitor: winner, fromEvenPos: i % 2 === 0 });
        } else {
            status = 'empty';
            winner = null;
        }

        bracket.matches.push({
            id: matchId++,
            round: 1,
            position: i,
            redCorner: comp1,
            blueCorner: comp2,
            winner: winner,
            score1: comp1 && !comp2 ? 'BYE' : null,
            score2: comp2 && !comp1 ? 'BYE' : null,
            status: status
        });
    }

    // Subsequent rounds (empty placeholders, but populate byes with cascading)
    for (let round = 2; round <= rounds; round++) {
        const matchesInRound = Math.pow(2, rounds - round);
        for (let i = 0; i < matchesInRound; i++) {
            // Check if anyone advanced to this match via bye
            // Even-position BYE → redCorner, odd-position BYE → blueCorner
            const byeRed = byeAdvances.find(b => b.round === round && b.position === i && b.fromEvenPos);
            const byeBlue = byeAdvances.find(b => b.round === round && b.position === i && !b.fromEvenPos);

            let redCorner = byeRed ? byeRed.competitor : null;
            let blueCorner = byeBlue ? byeBlue.competitor : null;
            let status = 'pending';
            let winner = null;
            let score1 = null;
            let score2 = null;

            // Check feeder matches from previous round to detect cascading BYEs
            const redFeeder = bracket.matches.find(m => m.round === round - 1 && m.position === i * 2);
            const blueFeeder = bracket.matches.find(m => m.round === round - 1 && m.position === i * 2 + 1);
            const redFeederEmpty = !redFeeder || redFeeder.status === 'empty' || redFeeder.status === 'bye';
            const blueFeederEmpty = !blueFeeder || blueFeeder.status === 'empty' || blueFeeder.status === 'bye';

            if (redCorner && !blueCorner && blueFeederEmpty) {
                // Red corner filled via BYE, blue corner feeder is empty/bye — cascading BYE
                status = 'bye';
                winner = redCorner;
                score1 = 'BYE';
                if (round < rounds) {
                    byeAdvances.push({ round: round + 1, position: Math.floor(i / 2), competitor: winner, fromEvenPos: i % 2 === 0 });
                }
            } else if (!redCorner && blueCorner && redFeederEmpty) {
                // Blue corner filled via BYE, red corner feeder is empty/bye — cascading BYE
                status = 'bye';
                winner = blueCorner;
                score2 = 'BYE';
                if (round < rounds) {
                    byeAdvances.push({ round: round + 1, position: Math.floor(i / 2), competitor: winner, fromEvenPos: i % 2 === 0 });
                }
            } else if (!redCorner && !blueCorner && redFeederEmpty && blueFeederEmpty) {
                // Both feeders empty/bye and no competitors — empty match
                status = 'empty';
            }

            bracket.matches.push({
                id: matchId++,
                round: round,
                position: i,
                redCorner: redCorner,
                blueCorner: blueCorner,
                winner: winner,
                score1: score1,
                score2: score2,
                status: status
            });
        }
    }

    return bracket;
}

function generateRepechageBracket(competitors, divisionName, eventId) {
    // Generate main bracket identical to single-elimination
    const mainBracket = generateSingleEliminationBracket(competitors, divisionName, eventId);

    return {
        id: generateUniqueId(),
        type: 'repechage',
        division: divisionName,
        divisionName: divisionName,
        eventId: eventId,
        rounds: mainBracket.rounds,
        competitors: competitors,
        createdAt: new Date().toISOString(),
        matches: mainBracket.matches,
        repechageA: [],
        repechageB: [],
        repechageGenerated: false
    };
}

// Called when both finalists are determined (final match has both corners filled)
function generateRepechageBrackets(bracket) {
    if (bracket.repechageGenerated) return;

    const finalMatch = bracket.matches.find(m => m.round === bracket.rounds);
    if (!finalMatch || !finalMatch.redCorner || !finalMatch.blueCorner) return;

    const finalistA = finalMatch.redCorner;  // From top half
    const finalistB = finalMatch.blueCorner; // From bottom half

    // Trace each finalist's path to collect their defeated opponents
    function getDefeatedOpponents(finalist) {
        const losers = [];
        // Sort matches by round ascending so we get opponents in chronological order
        const sortedMatches = bracket.matches
            .filter(m => m.round < bracket.rounds) // Exclude the final itself
            .sort((a, b) => a.round - b.round);

        for (const match of sortedMatches) {
            if (match.winner && match.winner.id === finalist.id) {
                const loser = match.redCorner?.id === finalist.id ? match.blueCorner : match.redCorner;
                if (loser) losers.push(loser);
            }
        }
        return losers; // Ordered earliest-round to latest (SF loser is last)
    }

    const losersA = getDefeatedOpponents(finalistA);
    const losersB = getDefeatedOpponents(finalistB);

    // Generate mini single-elimination repechage bracket for a set of losers
    // Seeding: SF loser (most recent) gets top seed / bye advantage
    // Losers are ordered earliest→latest, so reverse for seeding (latest = top seed)
    function generateMiniRepechage(losers, startId) {
        if (losers.length === 0) return [];
        if (losers.length === 1) {
            // Only one loser — they get bronze automatically
            return [{
                id: startId,
                round: 1,
                position: 0,
                redCorner: losers[0],
                blueCorner: null,
                winner: losers[0],
                score1: 'BYE',
                score2: null,
                status: 'bye'
            }];
        }

        // Reverse so most recent loser (SF loser) is first = top seed
        const seeded = [...losers].reverse();
        const rounds = Math.ceil(Math.log2(seeded.length));
        const totalSlots = Math.pow(2, rounds);
        const matches = [];
        let matchId = startId;
        const byeAdvances = [];

        // First round
        for (let i = 0; i < totalSlots / 2; i++) {
            const comp1 = seeded[i * 2] || null;
            const comp2 = seeded[i * 2 + 1] || null;

            let status, winner, score1 = null, score2 = null;
            if (comp1 && comp2) {
                status = 'pending';
                winner = null;
            } else if (comp1 || comp2) {
                status = 'bye';
                winner = comp1 || comp2;
                score1 = comp1 && !comp2 ? 'BYE' : null;
                score2 = comp2 && !comp1 ? 'BYE' : null;
                byeAdvances.push({ round: 2, position: Math.floor(i / 2), competitor: winner, fromEvenPos: i % 2 === 0 });
            } else {
                status = 'empty';
                winner = null;
            }

            matches.push({
                id: matchId++,
                round: 1,
                position: i,
                redCorner: comp1,
                blueCorner: comp2,
                winner: winner,
                score1: score1,
                score2: score2,
                status: status
            });
        }

        // Subsequent rounds with cascading BYEs
        for (let round = 2; round <= rounds; round++) {
            const matchesInRound = Math.pow(2, rounds - round);
            for (let i = 0; i < matchesInRound; i++) {
                const byeRed = byeAdvances.find(b => b.round === round && b.position === i && b.fromEvenPos);
                const byeBlue = byeAdvances.find(b => b.round === round && b.position === i && !b.fromEvenPos);

                let redCorner = byeRed ? byeRed.competitor : null;
                let blueCorner = byeBlue ? byeBlue.competitor : null;
                let status = 'pending';
                let winner = null;
                let score1 = null, score2 = null;

                const redFeeder = matches.find(m => m.round === round - 1 && m.position === i * 2);
                const blueFeeder = matches.find(m => m.round === round - 1 && m.position === i * 2 + 1);
                const redFeederEmpty = !redFeeder || redFeeder.status === 'empty' || redFeeder.status === 'bye';
                const blueFeederEmpty = !blueFeeder || blueFeeder.status === 'empty' || blueFeeder.status === 'bye';

                if (redCorner && !blueCorner && blueFeederEmpty) {
                    status = 'bye';
                    winner = redCorner;
                    score1 = 'BYE';
                    if (round < rounds) {
                        byeAdvances.push({ round: round + 1, position: Math.floor(i / 2), competitor: winner, fromEvenPos: i % 2 === 0 });
                    }
                } else if (!redCorner && blueCorner && redFeederEmpty) {
                    status = 'bye';
                    winner = blueCorner;
                    score2 = 'BYE';
                    if (round < rounds) {
                        byeAdvances.push({ round: round + 1, position: Math.floor(i / 2), competitor: winner, fromEvenPos: i % 2 === 0 });
                    }
                } else if (!redCorner && !blueCorner && redFeederEmpty && blueFeederEmpty) {
                    status = 'empty';
                }

                matches.push({
                    id: matchId++,
                    round: round,
                    position: i,
                    redCorner: redCorner,
                    blueCorner: blueCorner,
                    winner: winner,
                    score1: score1,
                    score2: score2,
                    status: status
                });
            }
        }

        return matches;
    }

    bracket.repechageA = generateMiniRepechage(losersA, 20000);
    bracket.repechageB = generateMiniRepechage(losersB, 21000);
    bracket.repechageGenerated = true;
}

function generateDoubleEliminationBracket(competitors, divisionName, eventId) {
    const winnersRounds = Math.ceil(Math.log2(competitors.length));

    const bracket = {
        id: generateUniqueId(),
        type: 'double-elimination',
        division: divisionName,
        divisionName: divisionName,
        eventId: eventId,
        competitors: competitors,
        rounds: winnersRounds,
        createdAt: new Date().toISOString(),
        winners: [],
        losers: [],
        finals: null,
        reset: null
    };

    // Create winners bracket (same as single elimination)
    const winnersBracket = generateSingleEliminationBracket(competitors, divisionName, eventId);
    bracket.winners = winnersBracket.matches;

    // Pre-generate losers bracket structure
    // For W winners rounds, losers bracket has 2*(W-1) rounds
    // Odd rounds = reduction (LB survivors play each other)
    // Even rounds = drop-down (WB losers enter against LB survivors)
    let losersMatchId = 10000;
    const losersRoundCount = 2 * (winnersRounds - 1);

    if (losersRoundCount > 0) {
        for (let lr = 1; lr <= losersRoundCount; lr++) {
            // Match count formula: each pair of rounds halves
            // LR1: 2^(W-2) matches, LR2: 2^(W-2), LR3: 2^(W-3), LR4: 2^(W-3), etc.
            const pairIndex = Math.ceil(lr / 2); // 1,1,2,2,3,3,...
            const matchesInRound = Math.max(1, Math.pow(2, winnersRounds - 1 - pairIndex));
            const isDropDown = (lr % 2 === 0); // even rounds are drop-down

            for (let pos = 0; pos < matchesInRound; pos++) {
                bracket.losers.push({
                    id: losersMatchId++,
                    round: lr,
                    position: pos,
                    roundType: isDropDown ? 'drop-down' : 'reduction',
                    redCorner: null,
                    blueCorner: null,
                    winner: null,
                    score1: null,
                    score2: null,
                    status: 'pending'
                });
            }
        }
    }

    // Pre-generate grand finals match
    bracket.finals = {
        id: losersMatchId++,
        round: 'finals',
        position: 0,
        redCorner: null,
        blueCorner: null,
        winner: null,
        score1: null,
        score2: null,
        status: 'pending'
    };

    // Handle BYEs: WR1 bye matches don't produce a loser, so corresponding LR1 slots need adjustment
    const wr1Matches = bracket.winners.filter(m => m.round === 1);
    const lr1Matches = bracket.losers.filter(m => m.round === 1);

    // For LR1, WR1 positions pair up: WR1 pos 0&1 -> LR1 pos 0, WR1 pos 2&3 -> LR1 pos 1, etc.
    lr1Matches.forEach((lMatch, pos) => {
        const wr1Even = wr1Matches.find(m => m.position === pos * 2);
        const wr1Odd = wr1Matches.find(m => m.position === pos * 2 + 1);
        const evenIsBye = !wr1Even || wr1Even.status === 'bye' || wr1Even.status === 'empty';
        const oddIsBye = !wr1Odd || wr1Odd.status === 'bye' || wr1Odd.status === 'empty';

        if (evenIsBye && oddIsBye) {
            // Both feeders are byes - no losers from either
            lMatch.status = 'empty';
        } else if (evenIsBye || oddIsBye) {
            // Only one feeder produces a loser - mark as bye, will be filled at runtime
            // The loser will auto-advance when they arrive
            lMatch.status = 'bye-pending';
        }
    });

    // Cascade bye-pending through losers bracket
    _cascadeLosersByes(bracket);

    return bracket;
}

// Cascade bye/empty status through pre-generated losers bracket
function _cascadeLosersByes(bracket) {
    const losers = bracket.losers || [];
    const maxLR = losers.length > 0 ? Math.max(...losers.map(m => m.round)) : 0;

    for (let lr = 1; lr <= maxLR; lr++) {
        const roundMatches = losers.filter(m => m.round === lr);
        const isDropDown = (lr % 2 === 0);

        roundMatches.forEach(lMatch => {
            if (lMatch.status === 'empty') {
                // Propagate empty status to next round
                const nextLR = lr + 1;
                if (nextLR <= maxLR) {
                    const nextPos = isDropDown ? Math.floor(lMatch.position / 2) : lMatch.position;
                    const nextMatch = losers.find(m => m.round === nextLR && m.position === (isDropDown ? Math.floor(lMatch.position / 2) : lMatch.position));
                    if (nextMatch && nextMatch.status === 'pending') {
                        // Mark as bye-pending since one feeder is empty
                        nextMatch.status = 'bye-pending';
                    }
                }
            }
        });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// DOUBLE-ELIMINATION ADVANCEMENT HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function advanceInWinnersBracket(bracket, match, winner) {
    const matchPool = bracket.winners || [];
    let advanceMatch = match;
    let advanceWinner = winner;

    while (true) {
        const nextRound = advanceMatch.round + 1;
        const nextPosition = Math.floor(advanceMatch.position / 2);
        const nextMatch = matchPool.find(m => m.round === nextRound && m.position === nextPosition);

        if (!nextMatch) {
            // Winner of final winners bracket match -> goes to grand finals as redCorner
            if (bracket.finals && !bracket.finals.redCorner) {
                bracket.finals.redCorner = advanceWinner;
            }
            break;
        }

        if (advanceMatch.position % 2 === 0) {
            if (!nextMatch.redCorner) nextMatch.redCorner = advanceWinner;
            else nextMatch.blueCorner = advanceWinner;
        } else {
            if (!nextMatch.blueCorner) nextMatch.blueCorner = advanceWinner;
            else nextMatch.redCorner = advanceWinner;
        }

        // Check for cascading BYE
        if (nextMatch.redCorner && !nextMatch.blueCorner) {
            const blueFeeder = matchPool.find(m => m.round === nextMatch.round - 1 && m.position === nextMatch.position * 2 + 1);
            if (blueFeeder && (blueFeeder.status === 'empty' || blueFeeder.status === 'bye')) {
                nextMatch.status = 'bye';
                nextMatch.winner = nextMatch.redCorner;
                nextMatch.score1 = 'BYE';
                // Loser from a bye doesn't drop to losers bracket
                advanceMatch = nextMatch;
                advanceWinner = nextMatch.redCorner;
                continue;
            }
        } else if (!nextMatch.redCorner && nextMatch.blueCorner) {
            const redFeeder = matchPool.find(m => m.round === nextMatch.round - 1 && m.position === nextMatch.position * 2);
            if (redFeeder && (redFeeder.status === 'empty' || redFeeder.status === 'bye')) {
                nextMatch.status = 'bye';
                nextMatch.winner = nextMatch.blueCorner;
                nextMatch.score2 = 'BYE';
                advanceMatch = nextMatch;
                advanceWinner = nextMatch.blueCorner;
                continue;
            }
        }
        break;
    }
}

function dropToLosersBracket(bracket, match, loser) {
    const losers = bracket.losers || [];
    if (losers.length === 0) return;

    const winnersRound = match.round;
    const winnersPos = match.position;

    // Mapping: WR(k) losers go to LR 2*(k-1) for k>=2, WR1 losers go to LR1
    let targetLR, targetPos, targetCorner;

    if (winnersRound === 1) {
        // WR1 losers go to LR1
        // WR1 positions pair up: pos 0&1 -> LR1 pos 0, pos 2&3 -> LR1 pos 1
        targetLR = 1;
        targetPos = Math.floor(winnersPos / 2);
        targetCorner = (winnersPos % 2 === 0) ? 'red' : 'blue';
    } else {
        // WR(k) losers go to LR 2*(k-1) (drop-down round)
        targetLR = 2 * (winnersRound - 1);
        targetPos = winnersPos;
        targetCorner = 'blue'; // Drop-down competitors go to blueCorner
    }

    const targetMatch = losers.find(m => m.round === targetLR && m.position === targetPos);
    if (!targetMatch) return;

    if (targetCorner === 'red') {
        targetMatch.redCorner = loser;
    } else {
        targetMatch.blueCorner = loser;
    }

    // Clear bye-pending status if it was set during generation
    if (targetMatch.status === 'bye-pending' || targetMatch.status === 'empty') {
        targetMatch.status = 'pending';
    }

    // Check if this match now has only one competitor and the other feeder can't provide one
    _checkLosersBracketByeAdvance(bracket, targetMatch);
}

function _checkLosersBracketByeAdvance(bracket, match) {
    const losers = bracket.losers || [];

    if (match.redCorner && match.blueCorner) return; // Both filled, normal match
    if (!match.redCorner && !match.blueCorner) return; // Neither filled, wait

    const isDropDown = (match.round % 2 === 0);
    const competitor = match.redCorner || match.blueCorner;

    // For reduction rounds (odd): feeders are from previous round at position*2 and position*2+1
    // For drop-down rounds (even): one feeder is from previous LR, other is from WB
    // We can check if the match is in bye-pending state (set during generation)
    if (match.status === 'bye-pending') {
        match.status = 'bye';
        match.winner = competitor;
        if (match.redCorner) match.score1 = 'BYE';
        else match.score2 = 'BYE';

        // Advance this winner in losers bracket
        advanceInLosersBracket(bracket, match, competitor);
    }
}

function advanceInLosersBracket(bracket, match, winner) {
    const losers = bracket.losers || [];
    const maxLR = losers.length > 0 ? Math.max(...losers.map(m => m.round)) : 0;

    if (match.round >= maxLR) {
        // Winner of final losers round -> goes to grand finals as blueCorner
        if (bracket.finals) {
            bracket.finals.blueCorner = winner;
        }
        return;
    }

    const currentLR = match.round;
    const isCurrentReduction = (currentLR % 2 !== 0); // odd = reduction
    const nextLR = currentLR + 1;

    let nextPos, nextCorner;

    if (isCurrentReduction) {
        // Reduction round winner -> next drop-down round
        // Position stays the same (drop-down round has same count)
        nextPos = match.position;
        nextCorner = 'red'; // LB survivor goes to redCorner, WB drop-down goes to blueCorner
    } else {
        // Drop-down round winner -> next reduction round
        // Position halves: pos 0&1 -> 0, pos 2&3 -> 1
        nextPos = Math.floor(match.position / 2);
        nextCorner = (match.position % 2 === 0) ? 'red' : 'blue';
    }

    const nextMatch = losers.find(m => m.round === nextLR && m.position === nextPos);
    if (!nextMatch) {
        // No next match means this is the final losers round
        if (bracket.finals) {
            bracket.finals.blueCorner = winner;
        }
        return;
    }

    if (nextCorner === 'red') {
        nextMatch.redCorner = winner;
    } else {
        nextMatch.blueCorner = winner;
    }

    if (nextMatch.status === 'bye-pending' || nextMatch.status === 'empty') {
        nextMatch.status = 'pending';
    }

    // Check for bye advance in next match
    _checkLosersBracketByeAdvance(bracket, nextMatch);
}

function handleDoubleElimWinnerDeclaration(bracket, match, winner, loser) {
    const isWinnersMatch = (bracket.winners || []).some(m => m.id === match.id);
    const isLosersMatch = (bracket.losers || []).some(m => m.id === match.id);
    const isFinalsMatch = bracket.finals && bracket.finals.id === match.id;
    const isResetMatch = bracket.reset && bracket.reset.id === match.id;

    if (isWinnersMatch) {
        // Winner advances in winners bracket
        advanceInWinnersBracket(bracket, match, winner);
        // Loser drops to losers bracket
        dropToLosersBracket(bracket, match, loser);
    } else if (isLosersMatch) {
        // Winner advances in losers bracket (loser is eliminated - second loss)
        advanceInLosersBracket(bracket, match, winner);
    } else if (isFinalsMatch) {
        // Grand finals
        if (bracket.finals.redCorner && winner.id === bracket.finals.redCorner.id) {
            // Winners bracket champion won -> tournament is over
        } else {
            // Losers bracket champion won -> create reset match
            bracket.reset = {
                id: generateUniqueId(),
                round: 'reset',
                position: 0,
                redCorner: bracket.finals.redCorner,
                blueCorner: bracket.finals.blueCorner,
                winner: null,
                score1: null,
                score2: null,
                status: 'pending'
            };
        }
    } else if (isResetMatch) {
        // Reset match decided - winner is tournament champion, nothing more to advance
    }
}

function handleRepechageWinnerDeclaration(bracket, match, winner, loser) {
    const isMainMatch = (bracket.matches || []).some(m => m.id === match.id);
    const isRepechageA = (bracket.repechageA || []).some(m => m.id === match.id);
    const isRepechageB = (bracket.repechageB || []).some(m => m.id === match.id);

    if (isMainMatch) {
        // Standard single-elimination advancement within the main bracket
        let advanceMatch = match;
        let advanceWinner = winner;

        while (true) {
            const nextRound = advanceMatch.round + 1;
            const nextPosition = Math.floor(advanceMatch.position / 2);
            const nextMatch = bracket.matches.find(m => m.round === nextRound && m.position === nextPosition);

            if (!nextMatch) break;

            if (advanceMatch.position % 2 === 0) {
                if (!nextMatch.redCorner) nextMatch.redCorner = advanceWinner;
                else nextMatch.blueCorner = advanceWinner;
            } else {
                if (!nextMatch.blueCorner) nextMatch.blueCorner = advanceWinner;
                else nextMatch.redCorner = advanceWinner;
            }

            // Cascading BYE detection
            if (nextMatch.redCorner && !nextMatch.blueCorner) {
                const blueFeeder = bracket.matches.find(m => m.round === nextMatch.round - 1 && m.position === nextMatch.position * 2 + 1);
                if (blueFeeder && (blueFeeder.status === 'empty' || blueFeeder.status === 'bye')) {
                    nextMatch.status = 'bye';
                    nextMatch.winner = nextMatch.redCorner;
                    nextMatch.score1 = 'BYE';
                    advanceMatch = nextMatch;
                    advanceWinner = nextMatch.redCorner;
                    continue;
                }
            } else if (!nextMatch.redCorner && nextMatch.blueCorner) {
                const redFeeder = bracket.matches.find(m => m.round === nextMatch.round - 1 && m.position === nextMatch.position * 2);
                if (redFeeder && (redFeeder.status === 'empty' || redFeeder.status === 'bye')) {
                    nextMatch.status = 'bye';
                    nextMatch.winner = nextMatch.blueCorner;
                    nextMatch.score2 = 'BYE';
                    advanceMatch = nextMatch;
                    advanceWinner = nextMatch.blueCorner;
                    continue;
                }
            }
            break;
        }

        // Check if the final match now has both corners filled -> trigger repechage generation
        const finalMatch = bracket.matches.find(m => m.round === bracket.rounds);
        if (finalMatch && finalMatch.redCorner && finalMatch.blueCorner && !bracket.repechageGenerated) {
            generateRepechageBrackets(bracket);
        }
    } else if (isRepechageA || isRepechageB) {
        // Advance within the repechage sub-bracket
        const repechageMatches = isRepechageA ? bracket.repechageA : bracket.repechageB;
        let advanceMatch = match;
        let advanceWinner = winner;

        while (true) {
            const nextRound = advanceMatch.round + 1;
            const nextPosition = Math.floor(advanceMatch.position / 2);
            const nextMatch = repechageMatches.find(m => m.round === nextRound && m.position === nextPosition);

            if (!nextMatch) break;

            if (advanceMatch.position % 2 === 0) {
                if (!nextMatch.redCorner) nextMatch.redCorner = advanceWinner;
                else nextMatch.blueCorner = advanceWinner;
            } else {
                if (!nextMatch.blueCorner) nextMatch.blueCorner = advanceWinner;
                else nextMatch.redCorner = advanceWinner;
            }

            // Cascading BYE detection
            if (nextMatch.redCorner && !nextMatch.blueCorner) {
                const blueFeeder = repechageMatches.find(m => m.round === nextMatch.round - 1 && m.position === nextMatch.position * 2 + 1);
                if (blueFeeder && (blueFeeder.status === 'empty' || blueFeeder.status === 'bye')) {
                    nextMatch.status = 'bye';
                    nextMatch.winner = nextMatch.redCorner;
                    nextMatch.score1 = 'BYE';
                    advanceMatch = nextMatch;
                    advanceWinner = nextMatch.redCorner;
                    continue;
                }
            } else if (!nextMatch.redCorner && nextMatch.blueCorner) {
                const redFeeder = repechageMatches.find(m => m.round === nextMatch.round - 1 && m.position === nextMatch.position * 2);
                if (redFeeder && (redFeeder.status === 'empty' || redFeeder.status === 'bye')) {
                    nextMatch.status = 'bye';
                    nextMatch.winner = nextMatch.blueCorner;
                    nextMatch.score2 = 'BYE';
                    advanceMatch = nextMatch;
                    advanceWinner = nextMatch.blueCorner;
                    continue;
                }
            }
            break;
        }
    }
}

function generateRoundRobinBracket(competitors, divisionName, eventId) {
    const bracket = {
        id: generateUniqueId(),
        type: 'round-robin',
        division: divisionName,
        divisionName: divisionName,
        eventId: eventId,
        competitors: competitors,
        createdAt: new Date().toISOString(),
        matches: [],
        standings: competitors.map(c => ({
            competitor: c,
            wins: 0,
            losses: 0,
            points: 0
        }))
    };

    // Generate all possible matchups
    let matchId = 1;
    for (let i = 0; i < competitors.length; i++) {
        for (let j = i + 1; j < competitors.length; j++) {
            bracket.matches.push({
                id: matchId++,
                redCorner: competitors[i],
                blueCorner: competitors[j],
                winner: null,
                score1: null,
                score2: null,
                status: 'pending'
            });
        }
    }

    return bracket;
}

function generatePoolPlayBracket(competitors, divisionName, eventId) {
    // Pool Play: Divide competitors into pools, each pool does round-robin, then finals
    const bracket = {
        id: generateUniqueId(),
        type: 'pool-play',
        division: divisionName,
        divisionName: divisionName,
        eventId: eventId,
        competitors: competitors,
        createdAt: new Date().toISOString(),
        pools: [],
        finals: []
    };

    // Determine optimal pool size (aim for 3-5 competitors per pool)
    const totalCompetitors = competitors.length;
    let numPools = 1;
    let poolSize = totalCompetitors;

    if (totalCompetitors > 12) {
        numPools = 4;
    } else if (totalCompetitors > 8) {
        numPools = 3;
    } else if (totalCompetitors > 5) {
        numPools = 2;
    }

    poolSize = Math.ceil(totalCompetitors / numPools);

    // Distribute competitors into pools (snake draft to balance)
    const pools = Array.from({ length: numPools }, () => []);
    let poolIndex = 0;
    let direction = 1;

    competitors.forEach(competitor => {
        pools[poolIndex].push(competitor);
        poolIndex += direction;
        if (poolIndex >= numPools || poolIndex < 0) {
            direction *= -1;
            poolIndex += direction;
        }
    });

    // Generate matches for each pool (round-robin within pool)
    pools.forEach((poolCompetitors, poolIdx) => {
        const poolMatches = [];
        let matchId = 1;

        for (let i = 0; i < poolCompetitors.length; i++) {
            for (let j = i + 1; j < poolCompetitors.length; j++) {
                poolMatches.push({
                    id: `pool${poolIdx + 1}_match${matchId++}`,
                    redCorner: poolCompetitors[i],
                    blueCorner: poolCompetitors[j],
                    winner: null,
                    score1: null,
                    score2: null,
                    status: 'pending'
                });
            }
        }

        bracket.pools.push({
            poolNumber: poolIdx + 1,
            poolName: String.fromCharCode(65 + poolIdx), // A, B, C, D
            competitors: poolCompetitors,
            matches: poolMatches,
            standings: poolCompetitors.map(c => ({
                competitor: c,
                wins: 0,
                losses: 0,
                points: 0,
                rank: null
            }))
        });
    });

    // Finals will be generated after pool play completes
    // (Top finishers from each pool advance to single-elimination finals)

    return bracket;
}

function generateRankingListBracket(competitors, divisionName, eventId) {
    // Ranking List: Each competitor performs individually and receives a score.
    // No head-to-head matches. Competitors are ranked by their score (highest wins).
    // Used for kata-points and kobudo events.
    const bracket = {
        id: generateUniqueId(),
        type: 'ranking-list',
        division: divisionName,
        divisionName: divisionName,
        eventId: eventId,
        competitors: competitors,
        createdAt: new Date().toISOString(),
        entries: competitors.map((comp, idx) => ({
            competitor: comp,
            performanceOrder: idx + 1,
            score: null,
            rank: null,
            status: 'pending'  // pending | scored
        })),
        matches: [], // Empty — no head-to-head matches in ranking list
        status: 'pending' // pending | in-progress | completed
    };

    return bracket;
}

function generateKataFlagsBracket(competitors, divisionName, eventId) {
    // Kata Flags: Competitors perform kata, judges raise flags for winner (best of 3 or 5 flags)
    const bracket = {
        id: generateUniqueId(),
        type: 'kata-flags',
        division: divisionName,
        eventId: eventId,
        createdAt: new Date().toISOString(),
        rounds: [],
        numJudges: 5 // Configurable: 3, 5, or 7 judges
    };

    // Round 1: All competitors perform, top performers advance
    bracket.rounds.push({
        roundNumber: 1,
        roundName: 'Preliminary Round',
        performances: competitors.map((comp, idx) => ({
            competitor: comp,
            order: idx + 1,
            flags: 0, // Will be filled by judges
            advanced: false
        }))
    });

    return bracket;
}

function generateKataPointsBracket(competitors, divisionName, eventId) {
    // Kata Points: Competitors judged on a point scale (e.g., 0-10)
    const bracket = {
        id: generateUniqueId(),
        type: 'kata-points',
        division: divisionName,
        eventId: eventId,
        createdAt: new Date().toISOString(),
        rounds: [],
        numJudges: 5, // Configurable
        scoringRange: { min: 0, max: 10 } // Configurable
    };

    // Round 1: All competitors perform
    bracket.rounds.push({
        roundNumber: 1,
        roundName: 'Preliminary Round',
        performances: competitors.map((comp, idx) => ({
            competitor: comp,
            order: idx + 1,
            scores: [], // Array of judge scores
            totalScore: 0,
            averageScore: 0,
            rank: null,
            advanced: false
        }))
    });

    return bracket;
}

function loadBrackets() {
    const container = document.getElementById('brackets-container');
    const filterSelect = document.getElementById('bracket-event-filter');

    if (!container) return;

    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');

    // Clean up: Remove any brackets with 0 competitors
    let cleaned = false;
    Object.keys(brackets).forEach(bracketId => {
        if (!brackets[bracketId].competitors || brackets[bracketId].competitors.length === 0) {
            console.log(`Cleaning up empty bracket: ${bracketId}`);
            delete brackets[bracketId];
            cleaned = true;
        }
    });

    // Save if we cleaned anything
    if (cleaned) {
        saveBrackets(brackets);
    }

    const eventTypes = db.load('eventTypes');

    // Populate event filter
    if (filterSelect && filterSelect.options.length === 1) {
        eventTypes.forEach(event => {
            const option = document.createElement('option');
            option.value = event.id;
            option.textContent = event.name;
            filterSelect.appendChild(option);
        });
    }

    const filterId = filterSelect?.value || '';

    container.innerHTML = '';

    const bracketKeys = Object.keys(brackets);

    if (bracketKeys.length === 0) {
        container.innerHTML = '<div class="glass-panel"><p style="color: var(--text-secondary);">No brackets generated yet. Go to Divisions tab and click "Generate Brackets".</p></div>';
        return;
    }

    let displayCount = 0;

    bracketKeys.forEach(bracketId => {
        const bracket = brackets[bracketId];

        // Apply filter
        if (filterId && bracket.eventId != filterId) return;

        // Skip brackets with 0 competitors (shouldn't exist, but safety check)
        if (!bracket.competitors || bracket.competitors.length === 0) {
            console.warn(`Skipping empty bracket: ${bracketId}`);
            return;
        }

        displayCount++;

        const panel = document.createElement('div');
        panel.className = 'glass-panel';
        panel.style.marginBottom = '20px';

        const eventType = eventTypes.find(e => e.id == bracket.eventId);
        const typeLabel = bracket.type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());

        // Get scoreboard configuration name
        let scoreboardLabel = '';
        if (bracket.scoreboardConfig) {
            const baseTypeLabels = {
                'kumite': 'Kumite',
                'kata-flags': 'Kata Flags',
                'kata-points': 'Kata Points',
                'kobudo': 'Kobudo'
            };
            scoreboardLabel = ` • ${bracket.scoreboardConfig.name} (${baseTypeLabels[bracket.scoreboardConfig.baseType]})`;
        }

        // Mat assignment badge
        const matBadge = bracket.matAssignment
            ? `<span style="background: var(--accent); color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-left: 8px;">Mat ${bracket.matAssignment}</span>`
            : '';

        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div>
                    <h3>${bracket.divisionName || bracket.division}${matBadge}</h3>
                    <p style="color: var(--text-secondary); margin-top: 4px;">
                        ${eventType?.name || 'Unknown Event'} • ${typeLabel}${scoreboardLabel}
                    </p>
                    <p style="color: var(--text-tertiary); margin-top: 2px; font-size: 12px;">
                        Created ${new Date(bracket.createdAt).toLocaleDateString()}
                        ${bracket.seedingMethod ? ` • Seeded by: ${bracket.seedingMethod}` : ''}
                    </p>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-primary btn-small" onclick="viewBracket('${bracketId}')">View Bracket</button>
                    <button class="btn btn-danger btn-small" onclick="deleteBracket('${bracketId}')">Delete</button>
                </div>
            </div>
            <div id="bracket-preview-${bracketId}">
                ${renderBracketPreview(bracket)}
            </div>
        `;

        container.appendChild(panel);
    });

    if (displayCount === 0 && filterId) {
        container.innerHTML = '<div class="glass-panel"><p style="color: var(--text-secondary);">No brackets for this event.</p></div>';
    }
}

function renderBracketPreview(bracket) {
    // Ensure matches array exists
    if (!bracket.matches) {
        bracket.matches = [];
    }

    // Calculate timing if not already present
    if (!bracket.timing && bracket.scoreboardConfig) {
        bracket.timing = calculateBracketTiming(bracket, bracket.scoreboardConfig);
    }

    const timing = bracket.timing || {
        estimatedTotalTime: '?',
        estimatedRemainingTime: '?',
        progressPercent: 0
    };

    if (bracket.type === 'pool-play') {
        const numPools = bracket.pools?.length || 0;
        const totalMatches = bracket.pools?.reduce((sum, pool) => sum + pool.matches.length, 0) || 0;
        const completedMatches = bracket.pools?.reduce((sum, pool) =>
            sum + pool.matches.filter(m => m.status === 'completed').length, 0) || 0;

        return `
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; padding: 16px; background: rgba(255,255,255,0.02); border-radius: 8px;">
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Pools</div>
                    <div style="font-size: 24px; font-weight: 700;">${numPools}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Matches</div>
                    <div style="font-size: 24px; font-weight: 700;">${completedMatches}/${totalMatches}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Progress</div>
                    <div style="font-size: 24px; font-weight: 700; color: #22c55e;">${timing.progressPercent}%</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Total Time</div>
                    <div style="font-size: 20px; font-weight: 700;">${timing.estimatedTotalTime}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Remaining</div>
                    <div style="font-size: 20px; font-weight: 700; color: #dc2626;">${timing.estimatedRemainingTime}</div>
                </div>
            </div>
        `;
    } else if (bracket.type === 'ranking-list') {
        const entries = bracket.entries || [];
        const totalEntries = entries.length;
        const scoredEntries = entries.filter(e => e.score !== null && e.score !== undefined).length;
        const progressPercent = totalEntries > 0 ? Math.round((scoredEntries / totalEntries) * 100) : 0;

        return `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; padding: 16px; background: rgba(255,255,255,0.02); border-radius: 8px;">
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Competitors</div>
                    <div style="font-size: 24px; font-weight: 700;">${totalEntries}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Scored</div>
                    <div style="font-size: 24px; font-weight: 700;">${scoredEntries}/${totalEntries}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Progress</div>
                    <div style="font-size: 24px; font-weight: 700; color: #22c55e;">${progressPercent}%</div>
                </div>
            </div>
        `;
    } else if (bracket.type === 'round-robin') {
        const totalMatches = bracket.matches.length;
        const completedMatches = bracket.matches.filter(m => m.status === 'completed').length;

        return `
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; padding: 16px; background: rgba(255,255,255,0.02); border-radius: 8px;">
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Matches</div>
                    <div style="font-size: 24px; font-weight: 700;">${completedMatches}/${totalMatches}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Progress</div>
                    <div style="font-size: 24px; font-weight: 700; color: #22c55e;">${timing.progressPercent}%</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Total Time</div>
                    <div style="font-size: 20px; font-weight: 700;">${timing.estimatedTotalTime}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Remaining</div>
                    <div style="font-size: 20px; font-weight: 700; color: #dc2626;">${timing.estimatedRemainingTime}</div>
                </div>
            </div>
        `;
    } else if (bracket.type === 'double-elimination') {
        const winnersMatches = (bracket.winners || []).filter(m => m.status !== 'empty' && m.status !== 'bye');
        const losersMatches = (bracket.losers || []).filter(m => m.status !== 'empty' && m.status !== 'bye');
        const finalsCount = bracket.finals ? 1 : 0;
        const resetCount = bracket.reset ? 1 : 0;
        const totalMatches = winnersMatches.length + losersMatches.length + finalsCount + resetCount;
        const completedMatches = winnersMatches.filter(m => m.status === 'completed').length
            + losersMatches.filter(m => m.status === 'completed').length
            + (bracket.finals && (bracket.finals.status === 'completed') ? 1 : 0)
            + (bracket.reset && (bracket.reset.status === 'completed') ? 1 : 0);

        return `
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; padding: 16px; background: rgba(255,255,255,0.02); border-radius: 8px;">
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Winners</div>
                    <div style="font-size: 24px; font-weight: 700;">${winnersMatches.length}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Losers</div>
                    <div style="font-size: 24px; font-weight: 700;">${losersMatches.length}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Total Matches</div>
                    <div style="font-size: 24px; font-weight: 700;">${completedMatches}/${totalMatches}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Progress</div>
                    <div style="font-size: 24px; font-weight: 700; color: #22c55e;">${timing.progressPercent}%</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Remaining</div>
                    <div style="font-size: 20px; font-weight: 700; color: #dc2626;">${timing.estimatedRemainingTime}</div>
                </div>
            </div>
        `;
    } else if (bracket.type === 'repechage') {
        const mainMatches = (bracket.matches || []).filter(m => m.status !== 'empty' && m.status !== 'bye');
        const repAMatches = (bracket.repechageA || []).filter(m => m.status !== 'empty' && m.status !== 'bye');
        const repBMatches = (bracket.repechageB || []).filter(m => m.status !== 'empty' && m.status !== 'bye');
        const totalMatches = mainMatches.length + repAMatches.length + repBMatches.length;
        const completedMatches = mainMatches.filter(m => m.status === 'completed').length
            + repAMatches.filter(m => m.status === 'completed').length
            + repBMatches.filter(m => m.status === 'completed').length;
        const repStatus = bracket.repechageGenerated ? `${repAMatches.length + repBMatches.length}` : 'Pending';

        return `
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; padding: 16px; background: rgba(255,255,255,0.02); border-radius: 8px;">
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Main</div>
                    <div style="font-size: 24px; font-weight: 700;">${mainMatches.length}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Repechage</div>
                    <div style="font-size: 24px; font-weight: 700;">${repStatus}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Total Matches</div>
                    <div style="font-size: 24px; font-weight: 700;">${completedMatches}/${totalMatches}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Progress</div>
                    <div style="font-size: 24px; font-weight: 700; color: #22c55e;">${timing.progressPercent}%</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Remaining</div>
                    <div style="font-size: 20px; font-weight: 700; color: #dc2626;">${timing.estimatedRemainingTime}</div>
                </div>
            </div>
        `;
    } else {
        const totalMatches = bracket.matches.length;
        const completedMatches = bracket.matches.filter(m => m.status === 'completed').length;
        const rounds = bracket.rounds;

        return `
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; padding: 16px; background: rgba(255,255,255,0.02); border-radius: 8px;">
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Rounds</div>
                    <div style="font-size: 24px; font-weight: 700;">${rounds}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Matches</div>
                    <div style="font-size: 24px; font-weight: 700;">${completedMatches}/${totalMatches}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Progress</div>
                    <div style="font-size: 24px; font-weight: 700; color: #22c55e;">${timing.progressPercent}%</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Total Time</div>
                    <div style="font-size: 20px; font-weight: 700;">${timing.estimatedTotalTime}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Remaining</div>
                    <div style="font-size: 20px; font-weight: 700; color: #dc2626;">${timing.estimatedRemainingTime}</div>
                </div>
            </div>
        `;
    }
}

// Global variable to track current bracket being viewed
let currentViewingBracket = null;
let bracketEditMode = false;
let originalBracketState = null;

function viewBracket(bracketId) {
    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
    const bracket = brackets[bracketId];

    if (!bracket) {
        showMessage('Bracket not found', 'error');
        return;
    }

    currentViewingBracket = { ...bracket, id: bracketId };
    bracketEditMode = false;

    // Update modal title
    const eventTypes = db.load('eventTypes');
    const eventType = eventTypes.find(e => e.id == bracket.eventId);
    document.getElementById('bracket-viewer-title').textContent = bracket.divisionName || bracket.division;

    // Check if single competitor
    const competitorCount = bracket.competitors ? bracket.competitors.length : 0;
    const subtitle = `${eventType?.name || 'Unknown Event'} • ${bracket.type.replace('-', ' ').toUpperCase()}`;

    if (competitorCount === 1) {
        document.getElementById('bracket-viewer-subtitle').innerHTML = `
            ${subtitle}
            <span style="display: inline-block; margin-left: 12px; padding: 4px 12px; background: rgba(234, 179, 8, 0.2); border: 1px solid #eab308; border-radius: 6px; font-size: 11px; font-weight: 600; color: #eab308;">
                ⚠️ Only 1 Competitor - Cannot Compete
            </span>
        `;
    } else {
        document.getElementById('bracket-viewer-subtitle').textContent = subtitle;
    }

    // Render bracket
    renderBracketView(bracket);

    // Show/hide transfer button based on competitor count
    const transferBtn = document.getElementById('bracket-transfer-btn');
    if (transferBtn) {
        transferBtn.style.display = competitorCount === 1 ? 'block' : 'none';
    }

    // Show modal
    document.getElementById('bracket-viewer-modal').classList.remove('hidden');
}

function closeBracketViewer() {
    if (bracketEditMode) {
        if (!confirm('You have unsaved changes. Close anyway?')) {
            return;
        }
    }
    document.getElementById('bracket-viewer-modal').classList.add('hidden');
    currentViewingBracket = null;
    bracketEditMode = false;
    originalBracketState = null;
}

function toggleBracketEdit() {
    bracketEditMode = true;

    // Save original state for cancel
    originalBracketState = JSON.parse(JSON.stringify(currentViewingBracket));

    // Update UI
    document.getElementById('bracket-edit-btn').style.display = 'none';
    document.getElementById('bracket-save-btn').style.display = 'block';
    document.getElementById('bracket-cancel-btn').style.display = 'block';

    // Re-render with drag-and-drop enabled
    renderBracketView(currentViewingBracket);

    showMessage('Edit mode enabled. Drag competitors to rearrange bracket.', 'info');
}

function cancelBracketEdit() {
    if (!confirm('Discard all changes?')) {
        return;
    }

    bracketEditMode = false;
    currentViewingBracket = originalBracketState;
    originalBracketState = null;

    // Update UI
    document.getElementById('bracket-edit-btn').style.display = 'block';
    document.getElementById('bracket-save-btn').style.display = 'none';
    document.getElementById('bracket-cancel-btn').style.display = 'none';

    // Re-render without drag-and-drop
    renderBracketView(currentViewingBracket);

    showMessage('Changes discarded', 'info');
}

function saveBracketChanges() {
    if (!currentViewingBracket) return;

    // Save to localStorage
    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
    brackets[currentViewingBracket.id] = currentViewingBracket;
    saveBrackets(brackets);

    // Sync to server (debounced)
    _debouncedSync('brackets', _syncBracketsToServer, 2000);

    bracketEditMode = false;
    originalBracketState = null;

    // Update UI
    document.getElementById('bracket-edit-btn').style.display = 'block';
    document.getElementById('bracket-save-btn').style.display = 'none';
    document.getElementById('bracket-cancel-btn').style.display = 'none';

    // Re-render without drag-and-drop
    renderBracketView(currentViewingBracket);

    // Reload brackets list
    loadBrackets();

    showMessage('Bracket updated successfully!', 'success');
}

function renderBracketView(bracket) {
    const container = document.getElementById('bracket-viewer-content');

    // Different bracket types store data differently
    const hasContent = (bracket.matches && bracket.matches.length > 0) ||
                       (bracket.winners && bracket.winners.length > 0) ||
                       (bracket.pools && bracket.pools.length > 0) ||
                       (bracket.entries && bracket.entries.length > 0);

    if (!hasContent) {
        container.innerHTML = '<div class="glass-panel"><p style="color: var(--text-secondary);">No data in this bracket.</p></div>';
        return;
    }

    if (bracket.type === 'round-robin') {
        renderRoundRobinBracket(container, bracket);
    } else if (bracket.type === 'single-elimination') {
        renderSingleEliminationBracket(container, bracket);
    } else if (bracket.type === 'double-elimination') {
        renderDoubleEliminationBracket(container, bracket);
    } else if (bracket.type === 'pool-play') {
        renderPoolPlayBracket(container, bracket);
    } else if (bracket.type === 'ranking-list') {
        renderRankingListBracket(container, bracket);
    } else if (bracket.type === 'repechage') {
        renderRepechageBracket(container, bracket);
    } else {
        container.innerHTML = '<div class="glass-panel"><p style="color: var(--text-secondary);">Bracket type not supported yet.</p></div>';
    }
}

function renderSingleEliminationBracket(container, bracket) {
    // Group matches by round
    const matchesByRound = {};
    bracket.matches.forEach(match => {
        if (!matchesByRound[match.round]) {
            matchesByRound[match.round] = [];
        }
        matchesByRound[match.round].push(match);
    });

    const rounds = Object.keys(matchesByRound).sort((a, b) => parseInt(a) - parseInt(b));

    let html = '<div style="display: flex; gap: 40px; padding: 20px; overflow-x: auto;">';

    rounds.forEach(roundNum => {
        const matches = matchesByRound[roundNum];
        const roundLabel = rounds.length - roundNum == 0 ? 'Final' :
                          rounds.length - roundNum == 1 ? 'Semi-Finals' :
                          rounds.length - roundNum == 2 ? 'Quarter-Finals' :
                          `Round ${roundNum}`;

        html += `
            <div style="min-width: 280px;">
                <h3 style="text-align: center; margin-bottom: 20px; color: var(--accent-color);">${roundLabel}</h3>
                <div style="display: flex; flex-direction: column; gap: 40px;">
        `;

        matches.forEach((match, idx) => {
            html += renderMatchCard(match, idx, roundNum);
        });

        html += `
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;

    // Enable drag-and-drop if in edit mode
    if (bracketEditMode) {
        enableDragAndDrop();
    }
}

function renderRoundRobinBracket(container, bracket) {
    let html = '<div style="padding: 20px;">';
    html += '<h3 style="margin-bottom: 20px; color: var(--accent-color);">All Matches</h3>';
    html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">';

    bracket.matches.forEach((match, idx) => {
        html += renderMatchCard(match, idx, match.round);
    });

    html += '</div></div>';
    container.innerHTML = html;

    // Enable drag-and-drop if in edit mode
    if (bracketEditMode) {
        enableDragAndDrop();
    }
}

function renderPoolPlayBracket(container, bracket) {
    let html = '<div style="padding: 20px;">';

    if (bracket.pools && bracket.pools.length > 0) {
        // Full pool-play structure (from generatePoolPlayBracket)
        bracket.pools.forEach(pool => {
            html += `<h3 style="margin-bottom: 12px; color: var(--accent-color);">Pool ${pool.poolName || pool.poolNumber}</h3>`;

            // Standings table
            if (pool.standings && pool.standings.length > 0) {
                html += '<table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 0.9em;">';
                html += '<thead><tr style="border-bottom: 1px solid var(--glass-border);">';
                html += '<th style="text-align: left; padding: 8px;">Competitor</th>';
                html += '<th style="text-align: center; padding: 8px;">W</th>';
                html += '<th style="text-align: center; padding: 8px;">L</th>';
                html += '<th style="text-align: center; padding: 8px;">Pts</th>';
                html += '</tr></thead><tbody>';
                pool.standings.forEach(s => {
                    const name = s.competitor ? `${s.competitor.firstName} ${s.competitor.lastName}` : 'TBD';
                    html += `<tr style="border-bottom: 1px solid var(--glass-border);">`;
                    html += `<td style="padding: 8px;">${name}</td>`;
                    html += `<td style="text-align: center; padding: 8px;">${s.wins}</td>`;
                    html += `<td style="text-align: center; padding: 8px;">${s.losses}</td>`;
                    html += `<td style="text-align: center; padding: 8px;">${s.points}</td>`;
                    html += '</tr>';
                });
                html += '</tbody></table>';
            }

            // Pool matches
            html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; margin-bottom: 24px;">';
            pool.matches.forEach((match, idx) => {
                html += renderMatchCard(match, idx, pool.poolName || pool.poolNumber);
            });
            html += '</div>';
        });

        // Finals section
        if (bracket.finals && bracket.finals.length > 0) {
            html += '<h3 style="margin-bottom: 12px; color: var(--accent-color);">Finals</h3>';
            html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">';
            bracket.finals.forEach((match, idx) => {
                html += renderMatchCard(match, idx, 'Final');
            });
            html += '</div>';
        }
    } else if (bracket.matches && bracket.matches.length > 0) {
        // Fallback: auto-generated flat matches (from generateMatchesForBracket)
        html += '<h3 style="margin-bottom: 20px; color: var(--accent-color);">All Matches</h3>';
        html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">';
        bracket.matches.forEach((match, idx) => {
            html += renderMatchCard(match, idx, match.round);
        });
        html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;

    if (bracketEditMode) {
        enableDragAndDrop();
    }
}

function renderRankingListBracket(container, bracket) {
    const entries = bracket.entries || [];

    // Sort: scored entries by score (descending), then pending entries by performance order
    const sorted = [...entries].sort((a, b) => {
        if (a.status === 'scored' && b.status === 'scored') return (b.score || 0) - (a.score || 0);
        if (a.status === 'scored') return -1;
        if (b.status === 'scored') return 1;
        return a.performanceOrder - b.performanceOrder;
    });

    const scoredCount = sorted.filter(e => e.status === 'scored').length;
    const totalCount = sorted.length;

    let html = '<div style="padding: 20px;">';
    html += '<h3 style="margin-bottom: 8px; color: var(--accent-color);">Ranking List</h3>';
    html += `<p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 0.9em;">Each competitor performs individually. Ranked by score (highest wins). ${scoredCount}/${totalCount} scored.</p>`;

    html += '<table style="width: 100%; border-collapse: collapse;">';
    html += '<thead><tr style="border-bottom: 2px solid var(--glass-border);">';
    html += '<th style="text-align: center; padding: 10px; width: 50px;">#</th>';
    html += '<th style="text-align: left; padding: 10px;">Competitor</th>';
    html += '<th style="text-align: left; padding: 10px;">Dojo</th>';
    html += '<th style="text-align: center; padding: 10px; width: 100px;">Score</th>';
    html += '<th style="text-align: center; padding: 10px; width: 100px;">Status</th>';
    html += '</tr></thead><tbody>';

    sorted.forEach((entry, idx) => {
        const comp = entry.competitor;
        const name = comp ? `${comp.firstName} ${comp.lastName}` : 'TBD';
        const club = comp?.club || '-';
        const isScored = entry.status === 'scored';
        const rank = isScored ? idx + 1 : '-';
        const scoreDisplay = isScored ? entry.score.toFixed(2) : '-';

        let rankStyle = '';
        if (isScored && idx === 0) rankStyle = 'color: #FFD700; font-weight: 700;'; // Gold
        else if (isScored && idx === 1) rankStyle = 'color: #C0C0C0; font-weight: 700;'; // Silver
        else if (isScored && idx === 2) rankStyle = 'color: #CD7F32; font-weight: 700;'; // Bronze

        const statusBadge = isScored
            ? '<span style="background: rgba(48,209,88,0.15); color: #30d158; padding: 2px 8px; border-radius: 6px; font-size: 0.8em;">Scored</span>'
            : '<span style="background: rgba(234,179,8,0.15); color: #eab308; padding: 2px 8px; border-radius: 6px; font-size: 0.8em;">Pending</span>';

        html += `<tr style="border-bottom: 1px solid var(--glass-border); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">`;
        html += `<td style="text-align: center; padding: 10px; ${rankStyle}">${rank}</td>`;
        html += `<td style="padding: 10px; font-weight: 600;">${name}</td>`;
        html += `<td style="padding: 10px; color: var(--text-secondary);">${club}</td>`;
        html += `<td style="text-align: center; padding: 10px; font-size: 1.1em; font-weight: 600; ${rankStyle}">${scoreDisplay}</td>`;
        html += `<td style="text-align: center; padding: 10px;">${statusBadge}</td>`;
        html += '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function renderDoubleEliminationBracket(container, bracket) {
    let html = '<div style="padding: 20px;">';

    // --- Winners Bracket ---
    const winners = bracket.winners || [];
    if (winners.length > 0) {
        html += '<h2 style="color: var(--accent-color); margin-bottom: 16px;">Winners Bracket</h2>';

        const matchesByRound = {};
        winners.forEach(match => {
            if (!matchesByRound[match.round]) matchesByRound[match.round] = [];
            matchesByRound[match.round].push(match);
        });

        const rounds = Object.keys(matchesByRound).sort((a, b) => parseInt(a) - parseInt(b));

        html += '<div style="display: flex; gap: 40px; overflow-x: auto; padding-bottom: 20px;">';
        rounds.forEach(roundNum => {
            const matches = matchesByRound[roundNum];
            const roundLabel = rounds.length - roundNum == 0 ? 'W Final' :
                              rounds.length - roundNum == 1 ? 'W Semi-Finals' :
                              rounds.length - roundNum == 2 ? 'W Quarter-Finals' :
                              `W Round ${roundNum}`;

            html += `<div style="min-width: 280px;">
                <h3 style="text-align: center; margin-bottom: 20px; color: var(--accent-color);">${roundLabel}</h3>
                <div style="display: flex; flex-direction: column; gap: 40px;">`;

            matches.forEach((match, idx) => {
                html += renderMatchCard(match, idx, roundNum);
            });

            html += '</div></div>';
        });
        html += '</div>';
    }

    // --- Losers Bracket ---
    const losers = (bracket.losers || []).filter(m => m.status !== 'empty');
    if (losers.length > 0) {
        html += '<h2 style="color: #ff9500; margin-bottom: 16px; margin-top: 32px;">Losers Bracket</h2>';

        const losersByRound = {};
        losers.forEach(match => {
            const rnd = match.round || 1;
            if (!losersByRound[rnd]) losersByRound[rnd] = [];
            losersByRound[rnd].push(match);
        });

        const lRounds = Object.keys(losersByRound).sort((a, b) => parseInt(a) - parseInt(b));

        html += '<div style="display: flex; gap: 40px; overflow-x: auto; padding-bottom: 20px;">';
        lRounds.forEach(roundNum => {
            const matches = losersByRound[roundNum];
            const isDropDown = (parseInt(roundNum) % 2 === 0);
            const roundLabel = isDropDown ? `L Round ${roundNum} (Drop-Down)` : `L Round ${roundNum}`;
            html += `<div style="min-width: 280px;">
                <h3 style="text-align: center; margin-bottom: 20px; color: #ff9500;">${roundLabel}</h3>
                <div style="display: flex; flex-direction: column; gap: 40px;">`;

            matches.forEach((match, idx) => {
                html += renderMatchCard(match, idx, 'L' + roundNum);
            });

            html += '</div></div>';
        });
        html += '</div>';
    }

    // --- Grand Finals ---
    if (bracket.finals) {
        html += '<h2 style="color: #ffd60a; margin-bottom: 16px; margin-top: 32px;">Grand Finals</h2>';
        html += '<div style="max-width: 320px;">';
        html += renderMatchCard(bracket.finals, 0, 'Finals');
        html += '</div>';
    }

    // --- Reset Match ---
    if (bracket.reset) {
        html += '<h2 style="color: #ff453a; margin-bottom: 16px; margin-top: 32px;">Reset Match</h2>';
        html += '<div style="max-width: 320px;">';
        html += renderMatchCard(bracket.reset, 0, 'Reset');
        html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;

    if (bracketEditMode) {
        enableDragAndDrop();
    }
}

function renderRepechageBracket(container, bracket) {
    let html = '<div style="padding: 20px;">';

    // --- Main Bracket (same as single-elimination) ---
    html += '<h2 style="color: var(--accent-color); margin-bottom: 16px;">Main Bracket</h2>';

    const matchesByRound = {};
    (bracket.matches || []).forEach(match => {
        if (!matchesByRound[match.round]) matchesByRound[match.round] = [];
        matchesByRound[match.round].push(match);
    });

    const rounds = Object.keys(matchesByRound).sort((a, b) => parseInt(a) - parseInt(b));

    html += '<div style="display: flex; gap: 40px; padding: 20px 0; overflow-x: auto;">';
    rounds.forEach(roundNum => {
        const matches = matchesByRound[roundNum];
        const roundLabel = rounds.length - roundNum == 0 ? 'Final' :
                          rounds.length - roundNum == 1 ? 'Semi-Finals' :
                          rounds.length - roundNum == 2 ? 'Quarter-Finals' :
                          `Round ${roundNum}`;

        html += `<div style="min-width: 280px;">
            <h3 style="text-align: center; margin-bottom: 20px; color: var(--accent-color);">${roundLabel}</h3>
            <div style="display: flex; flex-direction: column; gap: 40px;">`;
        matches.forEach((match, idx) => { html += renderMatchCard(match, idx, roundNum); });
        html += '</div></div>';
    });
    html += '</div>';

    // --- Repechage Brackets ---
    html += '<hr style="border-color: var(--glass-border); margin: 32px 0;">';

    if (!bracket.repechageGenerated || (bracket.repechageA.length === 0 && bracket.repechageB.length === 0)) {
        html += '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">';
        html += '<h3 style="color: var(--accent-color); margin-bottom: 8px;">Repechage</h3>';
        html += '<p>Repechage brackets will be generated once both finalists are determined.</p>';
        html += '</div>';
    } else {
        // Find finalist names for labels
        const finalMatch = bracket.matches.find(m => m.round === bracket.rounds);
        const finalistAName = finalMatch?.redCorner ? `${finalMatch.redCorner.firstName} ${finalMatch.redCorner.lastName}` : 'Finalist A';
        const finalistBName = finalMatch?.blueCorner ? `${finalMatch.blueCorner.firstName} ${finalMatch.blueCorner.lastName}` : 'Finalist B';

        // Repechage A
        if (bracket.repechageA.length > 0) {
            html += `<h2 style="color: #bf5af2; margin-bottom: 8px; margin-top: 24px;">Repechage A <span style="font-size: 14px; color: var(--text-secondary); font-weight: 400;">(losers to ${finalistAName})</span></h2>`;
            html += _renderMiniRepechage(bracket.repechageA);
        }

        // Repechage B
        if (bracket.repechageB.length > 0) {
            html += `<h2 style="color: #bf5af2; margin-bottom: 8px; margin-top: 24px;">Repechage B <span style="font-size: 14px; color: var(--text-secondary); font-weight: 400;">(losers to ${finalistBName})</span></h2>`;
            html += _renderMiniRepechage(bracket.repechageB);
        }
    }

    html += '</div>';
    container.innerHTML = html;

    if (bracketEditMode) {
        enableDragAndDrop();
    }
}

function _renderMiniRepechage(matches) {
    const matchesByRound = {};
    matches.forEach(match => {
        if (match.status === 'empty') return;
        if (!matchesByRound[match.round]) matchesByRound[match.round] = [];
        matchesByRound[match.round].push(match);
    });

    const rounds = Object.keys(matchesByRound).sort((a, b) => parseInt(a) - parseInt(b));
    let html = '<div style="display: flex; gap: 40px; padding: 10px 0; overflow-x: auto;">';

    rounds.forEach(roundNum => {
        const roundMatches = matchesByRound[roundNum];
        const isLast = parseInt(roundNum) === Math.max(...rounds.map(Number));
        const roundLabel = isLast ? 'Bronze Match' : `Round ${roundNum}`;

        html += `<div style="min-width: 280px;">
            <h4 style="text-align: center; margin-bottom: 16px; color: #bf5af2;">${roundLabel}</h4>
            <div style="display: flex; flex-direction: column; gap: 30px;">`;
        roundMatches.forEach((match, idx) => { html += renderMatchCard(match, idx, roundNum); });
        html += '</div></div>';
    });

    html += '</div>';
    return html;
}

function renderMatchCard(match, matchIdx, roundNum) {
    const redCompetitor = match.redCorner;
    const blueCompetitor = match.blueCorner;
    const isBye = match.status === 'bye';
    const isEmpty = match.status === 'empty';
    const isCompleted = match.status === 'completed';

    // Hide completely empty matches (no competitors in either corner, empty status)
    if (isEmpty && !redCompetitor && !blueCompetitor) {
        return '';
    }

    const redName = redCompetitor ? `${redCompetitor.firstName} ${redCompetitor.lastName}` : 'TBD';
    const blueName = blueCompetitor ? `${blueCompetitor.firstName} ${blueCompetitor.lastName}` : 'TBD';
    const redClub = redCompetitor?.club || '';
    const blueClub = blueCompetitor?.club || '';

    // Determine if match can be scored (both corners must be filled, not bye/empty/completed)
    const canScore = !isBye && !isEmpty && !isCompleted && redCompetitor && blueCompetitor;

    const statusColor = isCompleted ? '#22c55e' : isBye ? '#ffd60a' : isEmpty ? '#666' : (!redCompetitor || !blueCompetitor) ? '#f59e0b' : '#64d2ff';
    const statusLabel = isCompleted ? '✓ Completed' : isBye ? 'BYE' : isEmpty ? 'Empty' : (!redCompetitor || !blueCompetitor) ? 'Waiting' : 'Pending';

    const dragAttr = bracketEditMode && redCompetitor ? `draggable="true" ondragstart="handleDragStart(event, ${matchIdx}, 'red', ${roundNum})" ondragend="handleDragEnd(event)" ondragover="handleDragOver(event)" ondrop="handleDrop(event, ${matchIdx}, 'red', ${roundNum})"` : '';
    const dragAttr2 = bracketEditMode && blueCompetitor ? `draggable="true" ondragstart="handleDragStart(event, ${matchIdx}, 'blue', ${roundNum})" ondragend="handleDragEnd(event)" ondragover="handleDragOver(event)" ondrop="handleDrop(event, ${matchIdx}, 'blue', ${roundNum})"` : '';

    const redIsWinner = match.winner && redCompetitor && match.winner.id === redCompetitor.id;
    const blueIsWinner = match.winner && blueCompetitor && match.winner.id === blueCompetitor.id;

    return `
        <div class="glass-panel" style="padding: 16px; background: var(--bg-secondary);">
            <div style="text-align: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--glass-border);">
                <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px;">Match ${match.id}</div>
                <div style="font-size: 10px; color: ${statusColor}; margin-top: 4px;">${statusLabel}</div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
                <div ${dragAttr} class="${bracketEditMode ? 'draggable-competitor' : ''}" style="padding: 12px; background: ${redIsWinner ? 'rgba(255,59,48,0.2)' : 'rgba(255,59,48,0.1)'}; border: 2px solid ${redIsWinner ? '#ff3b30' : 'rgba(255,59,48,0.3)'}; border-radius: 8px; ${bracketEditMode && redCompetitor ? 'cursor: grab;' : ''}">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 8px; height: 8px; background: #ff3b30; border-radius: 50%;"></div>
                        <div style="flex: 1;">
                            <div style="font-weight: ${redIsWinner ? '700' : '600'}; font-size: 14px;">${redName}</div>
                            ${redClub ? `<div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">${redClub}</div>` : ''}
                        </div>
                        ${redIsWinner ? '<div style="color: #22c55e; font-size: 18px;">👑</div>' : ''}
                    </div>
                </div>

                <div style="text-align: center; font-size: 20px; color: var(--text-secondary); font-weight: 300;">vs</div>

                <div ${dragAttr2} class="${bracketEditMode ? 'draggable-competitor' : ''}" style="padding: 12px; background: ${blueIsWinner ? 'rgba(220,38,38,0.2)' : 'rgba(220,38,38,0.1)'}; border: 2px solid ${blueIsWinner ? '#0a84ff' : 'rgba(220,38,38,0.3)'}; border-radius: 8px; ${bracketEditMode && blueCompetitor ? 'cursor: grab;' : ''}">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 8px; height: 8px; background: #dc2626; border-radius: 50%;"></div>
                        <div style="flex: 1;">
                            <div style="font-weight: ${blueIsWinner ? '700' : '600'}; font-size: 14px;">${blueName}</div>
                            ${blueClub ? `<div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">${blueClub}</div>` : ''}
                        </div>
                        ${blueIsWinner ? '<div style="color: #22c55e; font-size: 18px;">👑</div>' : ''}
                    </div>
                </div>
            </div>

            ${canScore ? `
                <button class="btn btn-primary btn-small" style="width: 100%; margin-top: 12px;" onclick="scoreMatch('${currentViewingBracket?.id}', ${match.id})">Score Match</button>
            ` : ''}
        </div>
    `;
}

// Drag and Drop functionality
let draggedData = null;

function enableDragAndDrop() {
    // Add visual feedback styles
    const style = document.createElement('style');
    style.id = 'drag-drop-styles';
    style.textContent = `
        .draggable-competitor:active {
            cursor: grabbing !important;
        }
        .draggable-competitor.dragging {
            opacity: 0.5;
        }
        .draggable-competitor.drag-over {
            border-color: #ffd60a !important;
            box-shadow: 0 0 0 2px rgba(255, 214, 10, 0.3);
        }
    `;
    document.head.appendChild(style);
}

function handleDragStart(event, matchIdx, corner, roundNum) {
    if (!bracketEditMode) return;

    event.target.classList.add('dragging');
    draggedData = {
        matchIdx: matchIdx,
        corner: corner,
        roundNum: roundNum
    };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', ''); // Required for Firefox
}

function handleDragEnd(event) {
    event.target.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function handleDragOver(event) {
    if (!bracketEditMode) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    const target = event.currentTarget;
    if (target && target.classList.contains('draggable-competitor')) {
        target.classList.add('drag-over');
    }
}

function handleDrop(event, targetMatchIdx, targetCorner, targetRoundNum) {
    if (!bracketEditMode || !draggedData) return;

    event.preventDefault();
    event.stopPropagation();

    const target = event.currentTarget;
    target.classList.remove('drag-over');

    // Remove dragging class from all elements
    document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));

    // Find source and target matches by their IDs
    const sourceMatch = currentViewingBracket.matches[draggedData.matchIdx];
    const targetMatch = currentViewingBracket.matches[targetMatchIdx];

    if (!sourceMatch || !targetMatch) {
        showMessage('Error: Could not find matches', 'error');
        draggedData = null;
        return;
    }

    // Don't allow dropping on the same position
    if (draggedData.matchIdx === targetMatchIdx && draggedData.corner === targetCorner) {
        draggedData = null;
        return;
    }

    // Swap competitors
    const sourceCompetitor = draggedData.corner === 'red' ? sourceMatch.redCorner : sourceMatch.blueCorner;
    const targetCompetitor = targetCorner === 'red' ? targetMatch.redCorner : targetMatch.blueCorner;

    if (draggedData.corner === 'red') {
        sourceMatch.redCorner = targetCompetitor;
    } else {
        sourceMatch.blueCorner = targetCompetitor;
    }

    if (targetCorner === 'red') {
        targetMatch.redCorner = sourceCompetitor;
    } else {
        targetMatch.blueCorner = sourceCompetitor;
    }

    // Re-render
    renderBracketView(currentViewingBracket);

    draggedData = null;
}

window.scoreMatch = function(bracketId, matchId) {
    console.log('=== SCORE MATCH ===');
    console.log('Bracket ID:', bracketId);
    console.log('Match ID:', matchId);

    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
    console.log('Available bracket IDs:', Object.keys(brackets));

    const bracket = brackets[bracketId];

    if (!bracket) {
        console.error('Bracket not found! ID:', bracketId);
        console.error('Available brackets:', brackets);
        showMessage('Bracket not found', 'error');
        return;
    }

    // Find the match
    let match = null;
    if (bracket.type === 'single-elimination' || bracket.type === 'round-robin' || bracket.type === 'repechage') {
        match = bracket.matches?.find(m => m.id === matchId);
        if (!match) match = bracket.repechageA?.find(m => m.id === matchId);
        if (!match) match = bracket.repechageB?.find(m => m.id === matchId);
    } else if (bracket.type === 'double-elimination') {
        match = bracket.winners?.find(m => m.id === matchId) ||
                bracket.losers?.find(m => m.id === matchId);
        if (!match && bracket.finals?.id === matchId) match = bracket.finals;
        if (!match && bracket.reset?.id === matchId) match = bracket.reset;
    } else if (bracket.type === 'pool-play') {
        // Pool play has pools array with matches
        for (const pool of bracket.pools || []) {
            match = pool.matches?.find(m => m.id === matchId);
            if (match) break;
        }
    }

    if (!match) {
        showMessage('Match not found', 'error');
        return;
    }

    // Check if match has both competitors
    if (!match.redCorner || !match.blueCorner) {
        showMessage('Match cannot be scored yet - missing competitors', 'error');
        return;
    }

    // Prevent re-scoring completed matches
    if (match.status === 'completed') {
        showMessage('This match has already been completed and cannot be re-scored.', 'warning');
        return;
    }

    // Get scoreboard configuration
    const scoreboardConfigs = JSON.parse(localStorage.getItem(_scopedKey('scoreboardConfigs')) || '[]');
    let scoreboardConfig = null;
    let scoreboardType = 'kumite';

    if (bracket.scoreboardConfigId) {
        scoreboardConfig = scoreboardConfigs.find(s => s.id === bracket.scoreboardConfigId);
        if (scoreboardConfig) {
            scoreboardType = scoreboardConfig.type || scoreboardConfig.baseType || 'kumite';
        } else {
            // scoreboardConfigId may be a raw type string (e.g. 'kata-flags', 'kumite')
            const validTypes = ['kumite', 'kata-flags', 'kata-points', 'kobudo'];
            if (validTypes.includes(bracket.scoreboardConfigId)) {
                scoreboardType = bracket.scoreboardConfigId;
            }
        }
    }

    // Get mat assignment if available
    let matId = bracket.matAssignment || 1;

    // Set current operator state
    currentOperatorMat = matId;
    currentOperatorDivision = bracket.division || bracket.divisionName;
    currentOperatorEventId = bracket.eventId;

    // Navigate to scoreboard view
    navigateTo('scoreboards');

    // Wait for view to load, then open appropriate scoreboard
    setTimeout(() => {
        if (bracket.type === 'ranking-list') {
            openRankingListScoreboard(matId, currentOperatorDivision, currentOperatorEventId, bracket, scoreboardType);
        } else if ((scoreboardType === 'kata-flags' || scoreboardType === 'kata-points') && bracket.rounds && Array.isArray(bracket.rounds)) {
            // Only use kata round scoreboard if bracket has kata round structure
            openKataScoreboard(matId, currentOperatorDivision, currentOperatorEventId, bracket, scoreboardType);
        } else {
            // Head-to-head scoreboard (kumite, or kata-flags/kata-points with elimination bracket)
            // openOperatorScoreboard handles routing to the correct scoreboard type
            window.currentMatchId = match.id;
            window.currentBracketId = bracketId;

            // Store the specific match we want to score (will be read by operator)
            window.forceLoadMatchId = match.id;

            // Auto-lock bracket when first match starts
            autoLockBracketOnMatchStart(bracketId);

            // Open the operator - it will load the specific match
            openOperatorScoreboard(matId, currentOperatorDivision, currentOperatorEventId);

            // Clear the force load flag after opening
            setTimeout(() => {
                delete window.forceLoadMatchId;
            }, 500);
        }
    }, 100);
};

// Division Transfer Functions
function showDivisionTransfer() {
    if (!currentViewingBracket || !currentViewingBracket.competitors || currentViewingBracket.competitors.length !== 1) {
        showMessage('Division transfer is only available for single-competitor brackets', 'error');
        return;
    }

    const competitor = currentViewingBracket.competitors[0];
    const currentDivision = currentViewingBracket.divisionName || currentViewingBracket.division;
    const currentEventId = currentViewingBracket.eventId;

    // Get all divisions for this event
    const allDivisions = JSON.parse(localStorage.getItem(_scopedKey('divisions')) || '{}');
    const eventData = allDivisions[currentEventId];

    if (!eventData || !eventData.generated) {
        showMessage('No divisions available for transfer', 'error');
        return;
    }

    // Get all brackets to show competitor counts
    const allBrackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');

    // Get ALL divisions (not just eligible ones)
    const allDivisionsData = [];

    Object.keys(eventData.generated).forEach(divisionName => {
        if (divisionName === currentDivision) return; // Skip current division

        // Get competitor count from the division data (not bracket)
        const divisionCompetitors = eventData.generated[divisionName] || [];
        const competitorCount = divisionCompetitors.length;

        // Find bracket for this division to check if locked
        const divisionBracket = Object.values(allBrackets).find(b =>
            b.eventId == currentEventId &&
            (b.divisionName === divisionName || b.division === divisionName)
        );

        // Check eligibility and compatibility
        const isEligible = isCompetitorEligibleForDivision(competitor, divisionName);
        const compatibility = getCompatibilityInfo(competitor, divisionName);

        allDivisionsData.push({
            name: divisionName,
            competitorCount: competitorCount,
            bracket: divisionBracket,
            isEligible: isEligible,
            compatibility: compatibility
        });
    });

    // Sort: eligible first, then by competitor count
    allDivisionsData.sort((a, b) => {
        if (a.isEligible && !b.isEligible) return -1;
        if (!a.isEligible && b.isEligible) return 1;
        return b.competitorCount - a.competitorCount;
    });

    // Render transfer modal
    renderDivisionTransferModal(competitor, currentDivision, allDivisionsData, currentEventId);

    // Show transfer modal
    document.getElementById('division-transfer-modal').classList.remove('hidden');
}

function closeDivisionTransfer() {
    document.getElementById('division-transfer-modal').classList.add('hidden');
}

function getCompatibilityInfo(competitor, divisionName) {
    const issues = [];
    const nameLower = divisionName.toLowerCase();

    // Check gender
    if (nameLower.includes('male') && !nameLower.includes('female')) {
        if (competitor.gender !== 'Male') {
            issues.push('Gender mismatch');
        }
    } else if (nameLower.includes('female')) {
        if (competitor.gender !== 'Female') {
            issues.push('Gender mismatch');
        }
    }

    // Check age range - supports formats like "8-9", "U5", "U7", "U11", etc.
    const competitorAge = getDisplayAge(competitor) || 0;

    // Try to match "8-9" format first
    let ageMatch = divisionName.match(/(\d+)-(\d+)/);
    if (ageMatch) {
        const minAge = parseInt(ageMatch[1]);
        const maxAge = parseInt(ageMatch[2]);

        if (competitorAge < minAge || competitorAge > maxAge) {
            issues.push(`Age ${competitorAge} not in ${minAge}-${maxAge}`);
        }
    } else {
        // Try to match "U5", "U7", "U11" format (Under X years)
        ageMatch = divisionName.match(/U(\d+)/i);
        if (ageMatch) {
            const maxAge = parseInt(ageMatch[1]);
            // U5 means under 5 (0-5), U7 means under 7 (0-7), U11 means under 11 (0-11)
            // But typically: U5 = 5 and under, U7 = 6-7, U9 = 8-9, U11 = 10-11
            // Let's use a smarter interpretation:
            let minAge = 0;
            if (maxAge === 5) {
                minAge = 0;
            } else if (maxAge === 7) {
                minAge = 6;
            } else if (maxAge === 9) {
                minAge = 8;
            } else if (maxAge === 11) {
                minAge = 10;
            } else if (maxAge === 13) {
                minAge = 12;
            } else {
                // Default: under X means 0 to X
                minAge = 0;
            }

            if (competitorAge < minAge || competitorAge > maxAge) {
                issues.push(`Age ${competitorAge} not in ${minAge}-${maxAge} range`);
            }
        }
    }

    // Check experience level
    const experienceLevels = ['Beginner', 'Novice', 'Intermediate', 'Advanced'];
    for (const level of experienceLevels) {
        if (nameLower.includes(level.toLowerCase())) {
            const competitorExp = parseFloat(competitor.experience) || 0;

            if (level === 'Beginner' && competitorExp >= 2) {
                issues.push(`Experience ${competitorExp}y too high for Beginner`);
            }
            if (level === 'Novice' && (competitorExp < 2 || competitorExp >= 4)) {
                issues.push(`Experience ${competitorExp}y not in Novice range (2-4y)`);
            }
            if (level === 'Intermediate' && (competitorExp < 4 || competitorExp >= 6)) {
                issues.push(`Experience ${competitorExp}y not in Intermediate range (4-6y)`);
            }
            if (level === 'Advanced' && competitorExp < 6) {
                issues.push(`Experience ${competitorExp}y too low for Advanced`);
            }
        }
    }

    return issues;
}

function isCompetitorEligibleForDivision(competitor, divisionName) {
    const issues = getCompatibilityInfo(competitor, divisionName);
    return issues.length === 0;
}

function renderDivisionTransferModal(competitor, currentDivision, eligibleDivisions, eventId) {
    const container = document.getElementById('division-transfer-content');

    const competitorName = `${competitor.firstName} ${competitor.lastName}`;
    const competitorDetails = `${getDisplayAge(competitor)} years • ${competitor.gender || 'Unknown'} • ${competitor.experience || '?'} years experience`;

    let html = `
        <div class="glass-panel" style="background: rgba(220, 38, 38, 0.1); border: 1px solid rgba(220, 38, 38, 0.3); margin-bottom: 24px;">
            <h3 style="margin-bottom: 8px; color: var(--accent-blue);">Competitor to Transfer</h3>
            <div style="font-size: 18px; font-weight: 600; margin-bottom: 4px;">${competitorName}</div>
            <div style="font-size: 14px; color: var(--text-secondary);">${competitorDetails}</div>
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--glass-border);">
                <div style="font-size: 13px; color: var(--text-secondary);">Current Division</div>
                <div style="font-size: 15px; font-weight: 600; margin-top: 4px;">${currentDivision}</div>
            </div>
        </div>

        <h3 style="margin-bottom: 16px;">Available Divisions</h3>
    `;

    if (eligibleDivisions.length === 0) {
        html += `
            <div class="glass-panel">
                <p style="color: var(--text-secondary); text-align: center;">
                    No divisions found.
                </p>
            </div>
        `;
    } else {
        // Group by eligibility
        const eligible = eligibleDivisions.filter(d => d.isEligible);
        const notEligible = eligibleDivisions.filter(d => !d.isEligible);

        html += '<div style="display: flex; flex-direction: column; gap: 12px;">';

        // Show eligible divisions first
        if (eligible.length > 0) {
            html += '<div style="margin-bottom: 8px; font-size: 13px; font-weight: 600; color: var(--accent-green); text-transform: uppercase; letter-spacing: 1px;">✓ Compatible Divisions</div>';
        }

        eligibleDivisions.forEach(division => {
            const isLocked = division.bracket?.locked || false;
            const statusColor = division.competitorCount === 0 ? '#eab308' :
                              division.competitorCount === 1 ? '#eab308' :
                              '#22c55e';
            const statusText = division.competitorCount === 0 ? 'Empty' :
                             division.competitorCount === 1 ? '1 Competitor' :
                             `${division.competitorCount} Competitors`;

            const hasIssues = division.compatibility && division.compatibility.length > 0;
            const borderColor = hasIssues ? 'rgba(234, 179, 8, 0.5)' : 'var(--glass-border)';
            const bgColor = hasIssues ? 'rgba(234, 179, 8, 0.05)' : 'var(--glass-bg)';

            html += `
                <div class="glass-panel" style="padding: 16px; ${isLocked ? 'opacity: 0.5;' : 'cursor: pointer;'} transition: all 0.2s; border-color: ${borderColor}; background: ${bgColor};"
                     ${!isLocked ? `onclick="transferCompetitor('${division.name}', '${eventId}')"` : ''}>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="flex: 1;">
                            <div style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">
                                ${hasIssues ? '⚠️ ' : ''}${division.name}
                            </div>
                            <div style="font-size: 13px; color: ${statusColor}; margin-bottom: 4px;">
                                ${statusText}
                                ${isLocked ? ' • 🔒 Locked' : ''}
                            </div>
                            ${hasIssues ? `
                                <div style="font-size: 12px; color: #eab308; margin-top: 6px;">
                                    ${division.compatibility.join(' • ')}
                                </div>
                            ` : ''}
                        </div>
                        ${!isLocked ? `
                            <button class="btn ${hasIssues ? 'btn-secondary' : 'btn-primary'} btn-small" onclick="event.stopPropagation(); transferCompetitor('${division.name}', '${eventId}')">
                                Transfer →
                            </button>
                        ` : `
                            <div style="color: var(--text-secondary); font-size: 13px;">🔒 Locked</div>
                        `}
                    </div>
                </div>
            `;
        });

        html += '</div>';
    }

    container.innerHTML = html;
}

function transferCompetitor(targetDivisionName, eventId) {
    if (!currentViewingBracket || !currentViewingBracket.competitors || currentViewingBracket.competitors.length !== 1) {
        showMessage('Error: Invalid bracket state', 'error');
        return;
    }

    const competitor = currentViewingBracket.competitors[0];
    const competitorName = `${competitor.firstName} ${competitor.lastName}`;
    const currentDivision = currentViewingBracket.divisionName || currentViewingBracket.division;

    // Check compatibility
    const compatibility = getCompatibilityInfo(competitor, targetDivisionName);
    const hasIssues = compatibility.length > 0;

    let confirmMessage = `Transfer ${competitorName} from "${currentDivision}" to "${targetDivisionName}"?\n\nThis will:\n• Remove competitor from current bracket\n• Add competitor to target division\n• Regenerate target bracket\n• Delete current bracket (if empty)`;

    if (hasIssues) {
        confirmMessage += `\n\n⚠️ WARNING - Compatibility Issues:\n${compatibility.map(issue => '• ' + issue).join('\n')}\n\nTransfer anyway?`;
    }

    // Confirm transfer
    if (!confirm(confirmMessage)) {
        return;
    }

    try {
        console.log('=== TRANSFER START ===');
        console.log('Competitor:', competitor);
        console.log('From:', currentDivision);
        console.log('To:', targetDivisionName);
        console.log('Event ID:', eventId);

        // Get all data
        const allDivisions = JSON.parse(localStorage.getItem(_scopedKey('divisions')) || '{}');
        const allBrackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
        const eventData = allDivisions[eventId];

        if (!eventData || !eventData.generated) {
            throw new Error('Event data not found');
        }

        console.log('Current division competitors BEFORE:', eventData.generated[currentDivision]?.length);
        console.log('Target division competitors BEFORE:', eventData.generated[targetDivisionName]?.length);

        // Remove from current division
        if (eventData.generated[currentDivision]) {
            eventData.generated[currentDivision] = eventData.generated[currentDivision].filter(c => c.id !== competitor.id);
            console.log('Removed competitor. Remaining:', eventData.generated[currentDivision].length);

            // Clean up: Remove division if now empty
            if (eventData.generated[currentDivision].length === 0) {
                console.log('Division is now empty, removing from divisions');
                delete eventData.generated[currentDivision];
            }
        }

        // Add to target division
        if (!eventData.generated[targetDivisionName]) {
            eventData.generated[targetDivisionName] = [];
        }
        eventData.generated[targetDivisionName].push(competitor);
        console.log('Added competitor. Target now has:', eventData.generated[targetDivisionName].length);

        // Save divisions
        allDivisions[eventId] = eventData;
        localStorage.setItem(_scopedKey('divisions'), JSON.stringify(allDivisions));
        console.log('Divisions saved');

        // Find target bracket before deleting anything
        const targetBracketEntry = Object.entries(allBrackets).find(([id, b]) =>
            b.eventId == eventId &&
            (b.divisionName === targetDivisionName || b.division === targetDivisionName)
        );

        // Check if target is locked
        if (targetBracketEntry && targetBracketEntry[1].locked) {
            throw new Error('Target bracket is locked');
        }

        console.log('Source bracket ID:', currentViewingBracket.id);
        console.log('Target bracket ID:', targetBracketEntry ? targetBracketEntry[0] : 'none');

        // Delete current bracket (source)
        delete allBrackets[currentViewingBracket.id];
        console.log('Deleted source bracket');

        // Delete target bracket if it exists (will be regenerated)
        if (targetBracketEntry) {
            delete allBrackets[targetBracketEntry[0]];
            console.log('Deleted target bracket');
        }

        // Save brackets (with deletions)
        saveBrackets(allBrackets);
        console.log('Brackets saved after deletions');

        console.log('=== TRANSFER COMPLETE ===');

        // Success! Brackets were deleted and need to be regenerated from the Brackets page.
        showMessage(`✓ ${competitorName} transferred from "${currentDivision}" to "${targetDivisionName}". Regenerate brackets from the Brackets page.`, 'success');

        // Close modals and refresh
        closeDivisionTransfer();
        closeBracketViewer();
        loadBrackets();
        loadDivisions();

    } catch (error) {
        console.error('Transfer error:', error);
        showMessage(`Error: ${error.message}`, 'error');
    }
}

function deleteBracket(bracketId) {
    if (!confirm('Delete this bracket? This cannot be undone.')) return;

    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
    const bracket = brackets[bracketId];
    delete brackets[bracketId];
    saveBrackets(brackets);

    // Delete from server (fire-and-forget)
    if (currentTournamentId) {
        fetch(`/api/tournaments/${currentTournamentId}/brackets/${encodeURIComponent(bracketId)}`, {
            method: 'DELETE', credentials: 'include',
        }).catch(err => console.warn('[sync] bracket delete failed:', err.message));
    }

    // Clean orphaned schedule entries for deleted bracket
    if (bracket) {
        const divisionName = bracket.division || bracket.divisionName;
        if (divisionName) {
            removeOrphanScheduleEntry(divisionName);
        }
    }

    loadBrackets();
    showMessage('Bracket deleted');
}

/**
 * DELETE ALL BRACKETS FUNCTION
 *
 * PURPOSE: Delete all brackets for the tournament with two-stage confirmation
 *
 * ANNOTATIONS: Added 2026-02-14
 * - Deletes ALL brackets from localStorage
 * - Two-stage confirmation to prevent accidental deletion
 * - Shows count of brackets to be deleted
 * - Clears mat schedule assignments (brackets no longer exist)
 *
 * FLOW:
 * 1. User clicks "Delete All Brackets" button in Brackets view
 * 2. FIRST WARNING: Shows total bracket count
 * 3. If confirmed, shows SECOND WARNING with stronger language
 * 4. If both confirmed, deletes all brackets and refreshes view
 */

function deleteAllBrackets() {
    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
    const bracketCount = Object.keys(brackets).length;

    if (bracketCount === 0) {
        showMessage('No brackets to delete', 'error');
        return;
    }

    // FIRST WARNING
    const firstConfirm = confirm(
        `⚠️ DELETE ALL BRACKETS?\n\n` +
        `Total brackets: ${bracketCount}\n\n` +
        `This will delete:\n` +
        `✗ All competition brackets\n` +
        `✗ All match pairings and seedings\n` +
        `✗ Mat schedule assignments for these brackets\n\n` +
        `Note: Divisions and competitors will NOT be affected.\n\n` +
        `Are you sure you want to continue?`
    );

    if (!firstConfirm) {
        return; // User cancelled
    }

    // SECOND WARNING
    const secondConfirm = confirm(
        `⚠️⚠️ FINAL WARNING ⚠️⚠️\n\n` +
        `You are about to permanently delete ${bracketCount} bracket(s).\n\n` +
        `THIS CANNOT BE UNDONE!\n\n` +
        `You will need to regenerate all brackets from scratch.\n\n` +
        `Type YES in your mind and click OK to confirm, or Cancel to abort.`
    );

    if (!secondConfirm) {
        return; // User cancelled
    }

    // Delete all brackets
    localStorage.setItem(_scopedKey('brackets'), JSON.stringify({}));

    // Sync deletion to server (debounced)
    _debouncedSync('brackets', _syncBracketsToServer, 1000);

    // Clear mat schedule (brackets no longer exist) - use new scoped system
    cleanOrphanScheduleEntries();

    loadBrackets();
    showMessage(`Successfully deleted ${bracketCount} bracket(s)`, 'success');
}

// Mat Schedule Management
let activeMat = 1;

// ═══════════════════════════════════════════════════════════════════════════
// SCHEDULE SETTINGS
// ═══════════════════════════════════════════════════════════════════════════

function getScheduleSettings() {
    const key = currentTournamentId ? `scheduleSettings_${currentTournamentId}` : 'scheduleSettings';
    const defaults = {
        kumiteDuration: 3,    // minutes per kumite match (including buffer)
        kataDuration: 4,      // minutes per kata performance (including scoring)
        bufferBetween: 5,     // minutes between divisions
        matStartTimes: {},    // { matId: "08:00" }
        divisionOverrides: {} // { divisionName: { duration: X } }
    };
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    return saved ? { ...defaults, ...saved } : defaults;
}

function saveScheduleSettings() {
    const settings = getScheduleSettings();
    settings.kumiteDuration = parseFloat(document.getElementById('schedule-kumite-duration').value) || 3;
    settings.kataDuration = parseFloat(document.getElementById('schedule-kata-duration').value) || 4;
    settings.bufferBetween = parseInt(document.getElementById('schedule-buffer-between').value) || 5;

    // Read mat start times
    const mats = db.load('mats');
    settings.matStartTimes = {};
    mats.forEach(mat => {
        const input = document.getElementById(`mat-start-time-${mat.id}`);
        if (input && input.value) {
            settings.matStartTimes[mat.id] = input.value;
        }
    });

    const key = currentTournamentId ? `scheduleSettings_${currentTournamentId}` : 'scheduleSettings';
    localStorage.setItem(key, JSON.stringify(settings));
    showMessage('Schedule settings saved');
    recalculateScheduleTimes();
    loadScheduleGrid();
    // Sync to server (debounced)
    _debouncedSync('schedule', _syncScheduleToServer, 1500);
}

function resetScheduleSettings() {
    const key = currentTournamentId ? `scheduleSettings_${currentTournamentId}` : 'scheduleSettings';
    localStorage.removeItem(key);
    loadScheduleSettingsUI();
    showMessage('Schedule settings reset to defaults');
    recalculateScheduleTimes();
    loadScheduleGrid();
}

function toggleScheduleSettings() {
    const panel = document.getElementById('schedule-settings-panel');
    const toggle = document.getElementById('schedule-settings-toggle');
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        toggle.textContent = 'Hide Settings';
        loadScheduleSettingsUI();
    } else {
        panel.classList.add('hidden');
        toggle.textContent = 'Show Settings';
    }
}

function loadScheduleSettingsUI() {
    const settings = getScheduleSettings();
    const mats = db.load('mats');

    // Populate timing defaults
    const kumiteInput = document.getElementById('schedule-kumite-duration');
    const kataInput = document.getElementById('schedule-kata-duration');
    const bufferInput = document.getElementById('schedule-buffer-between');

    if (kumiteInput) kumiteInput.value = settings.kumiteDuration;
    if (kataInput) kataInput.value = settings.kataDuration;
    if (bufferInput) bufferInput.value = settings.bufferBetween;

    // Populate mat start times
    const matStartGrid = document.getElementById('mat-start-times-grid');
    if (matStartGrid) {
        matStartGrid.innerHTML = mats.map(mat => `
            <div class="form-group">
                <label for="mat-start-time-${mat.id}">${mat.name} Start Time</label>
                <input type="time" id="mat-start-time-${mat.id}" value="${settings.matStartTimes[mat.id] || '08:00'}" style="padding: 8px; border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--glass-border);">
            </div>
        `).join('');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHEDULE DATA - Tournament-Scoped with Enhanced Structure
// ═══════════════════════════════════════════════════════════════════════════

function getMatScheduleKey() {
    return currentTournamentId ? `matSchedule_${currentTournamentId}` : 'matSchedule';
}

function loadMatScheduleData() {
    const key = getMatScheduleKey();
    let data = JSON.parse(localStorage.getItem(key) || 'null');

    // Migration: check old non-scoped key if no tournament-scoped data exists
    if (!data && currentTournamentId) {
        const oldData = JSON.parse(localStorage.getItem(_scopedKey('matSchedule')) || 'null');
        if (oldData && Object.keys(oldData).length > 0) {
            // Migrate old format to new format under tournament-scoped key
            data = migrateMatScheduleData(oldData);
            localStorage.setItem(key, JSON.stringify(data));
            // Don't delete old key in case user switches tournaments
        }
    }

    return data || {};
}

function saveMatScheduleData(data) {
    const key = getMatScheduleKey();
    localStorage.setItem(key, JSON.stringify(data));
    // Also update the non-scoped key for backward compat with TV displays
    localStorage.setItem(_scopedKey('matSchedule'), JSON.stringify(data));
    // Sync to server (debounced)
    _debouncedSync('schedule', _syncScheduleToServer, 1500);
}

function migrateMatScheduleData(oldData) {
    // Migrate from { matId: [{time, division, eventId}] }
    // to: { matId: [{order, division, eventId, estimatedDuration, status, ...}] }
    const newData = {};
    Object.keys(oldData).forEach(matId => {
        const oldSlots = oldData[matId] || [];
        newData[matId] = oldSlots.map((slot, idx) => ({
            order: idx,
            division: slot.division,
            eventId: slot.eventId,
            estimatedDuration: null,   // Will be calculated
            durationOverride: null,    // Manual override
            estimatedStartTime: null,  // Will be calculated
            estimatedEndTime: null,    // Will be calculated
            actualStartTime: slot.actualStartTime || null,
            actualEndTime: slot.actualEndTime || null,
            status: slot.status || 'upcoming', // upcoming, in-progress, completed, behind, ahead
            // Preserve time as a reference but it's no longer the primary key
            legacyTime: slot.time || null
        }));
    });
    return newData;
}

// Estimate duration for a division based on its bracket
function estimateDivisionDuration(divisionName, eventId) {
    const settings = getScheduleSettings();
    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
    const eventTypes = db.load('eventTypes');
    const event = eventTypes.find(e => e.id == eventId);

    // Check for manual override
    if (settings.divisionOverrides[divisionName]?.duration) {
        return settings.divisionOverrides[divisionName].duration;
    }

    // Find the bracket for this division
    const bracketKey = Object.keys(brackets).find(key => {
        const b = brackets[key];
        return (b.division === divisionName || b.divisionName === divisionName) && b.eventId == eventId;
    });
    const bracket = bracketKey ? brackets[bracketKey] : null;

    if (!bracket) return settings.kumiteDuration * 4; // Default fallback: 4 matches worth

    // Determine if this is kata or kumite
    const isKata = bracket.type === 'ranking-list' ||
                   bracket.scoreboardConfig?.baseType === 'kata-flags' ||
                   bracket.scoreboardConfig?.baseType === 'kata-points' ||
                   event?.scoreboardType === 'kata-flags' ||
                   event?.scoreboardType === 'kata-points';

    const perUnitTime = isKata ? settings.kataDuration : settings.kumiteDuration;

    // Count units (matches or performances)
    let unitCount = 0;
    if (bracket.type === 'ranking-list') {
        unitCount = bracket.entries?.length || bracket.competitors?.length || 4;
    } else if (bracket.type === 'single-elimination' || bracket.type === 'repechage') {
        unitCount = bracket.matches?.filter(m => m.status !== 'empty').length || 4;
    } else if (bracket.type === 'double-elimination') {
        unitCount = (bracket.winners?.filter(m => m.status !== 'empty').length || 0) +
                    (bracket.losers?.length || 0) +
                    (bracket.finals ? 1 : 0);
    } else if (bracket.type === 'round-robin') {
        unitCount = bracket.matches?.length || 4;
    } else if (bracket.type === 'pool-play') {
        let totalMatches = 0;
        bracket.pools?.forEach(pool => {
            const n = pool.competitors?.length || 0;
            totalMatches += (n * (n - 1)) / 2;
        });
        unitCount = totalMatches || 4;
    } else {
        unitCount = bracket.matches?.length || 4;
    }

    return Math.ceil(unitCount * perUnitTime);
}

// Get progress for a division (completed units / total units)
function getDivisionProgress(divisionName, eventId) {
    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');

    // Find bracket for this division
    let bracket = null;
    for (const id in brackets) {
        const b = brackets[id];
        if ((b.division === divisionName || b.divisionName === divisionName) && b.eventId == eventId) {
            bracket = b;
            break;
        }
    }

    if (!bracket) return { completed: 0, total: 0, percent: 0, status: 'no-bracket' };

    let completed = 0;
    let total = 0;

    if (bracket.type === 'ranking-list') {
        // Count scored entries
        const entries = bracket.entries || [];
        total = entries.length;
        completed = entries.filter(e => e.status === 'scored').length;
    } else if (bracket.type === 'single-elimination' || bracket.type === 'round-robin' || bracket.type === 'repechage') {
        const matches = bracket.matches || [];
        // Only count non-empty matches (those with actual competitors)
        const realMatches = matches.filter(m => m.status !== 'empty' && (m.redCorner || m.blueCorner));
        total = realMatches.length;
        completed = realMatches.filter(m => m.status === 'completed' || m.status === 'bye').length;
    } else if (bracket.type === 'double-elimination') {
        const winners = (bracket.winners || []).filter(m => m.status !== 'empty' && (m.redCorner || m.blueCorner));
        const losers = (bracket.losers || []).filter(m => m.status !== 'empty' && m.status !== 'bye-pending' && (m.redCorner || m.blueCorner));
        total = winners.length + losers.length + (bracket.finals && bracket.finals.redCorner ? 1 : 0) + (bracket.reset ? 1 : 0);
        completed = winners.filter(m => m.status === 'completed' || m.status === 'bye').length +
                    losers.filter(m => m.status === 'completed' || m.status === 'bye').length +
                    (bracket.finals?.status === 'completed' ? 1 : 0) +
                    (bracket.reset?.status === 'completed' ? 1 : 0);
    } else if (bracket.type === 'pool-play') {
        bracket.pools?.forEach(pool => {
            const poolMatches = pool.matches || [];
            total += poolMatches.length;
            completed += poolMatches.filter(m => m.status === 'completed').length;
        });
    } else if (bracket.type === 'kata-flags' || bracket.type === 'kata-points') {
        // Kata bracket with rounds
        const rounds = bracket.rounds || [];
        rounds.forEach(round => {
            const performances = round.performances || [];
            total += performances.length;
            completed += performances.filter(p => p.completed).length;
        });
    } else {
        // Generic fallback
        const matches = bracket.matches || [];
        total = matches.length;
        completed = matches.filter(m => m.status === 'completed').length;
    }

    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    let status = 'upcoming';
    if (bracket.status === 'completed' || percent === 100) status = 'completed';
    else if (completed > 0) status = 'in-progress';

    return { completed, total, percent, status };
}

// Recalculate all estimated times for the schedule
function recalculateScheduleTimes() {
    const schedule = loadMatScheduleData();
    const settings = getScheduleSettings();

    Object.keys(schedule).forEach(matId => {
        const slots = schedule[matId] || [];
        // Sort by order
        slots.sort((a, b) => (a.order || 0) - (b.order || 0));

        const matStartTime = settings.matStartTimes[matId] || '08:00';
        let currentTime = parseTimeToMinutes(matStartTime);

        slots.forEach((slot, idx) => {
            slot.order = idx;

            // Calculate estimated duration
            const duration = slot.durationOverride || estimateDivisionDuration(slot.division, slot.eventId);
            slot.estimatedDuration = duration;

            // Set start time (use actual if available, otherwise estimated)
            slot.estimatedStartTime = formatMinutesToTime(currentTime);

            // Set end time
            slot.estimatedEndTime = formatMinutesToTime(currentTime + duration);

            // Advance current time by duration + buffer
            currentTime += duration + settings.bufferBetween;

            // Update status based on actual times
            if (slot.actualEndTime) {
                slot.status = 'completed';
            } else if (slot.actualStartTime) {
                slot.status = 'in-progress';
            } else {
                slot.status = 'upcoming';
            }
        });
    });

    saveMatScheduleData(schedule);
    return schedule;
}

// Time utility functions
function parseTimeToMinutes(timeStr) {
    if (!timeStr) return 480; // Default 08:00
    const parts = timeStr.split(':');
    return parseInt(parts[0]) * 60 + parseInt(parts[1] || 0);
}

function formatMinutesToTime(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60) % 24;
    const mins = Math.round(totalMinutes % 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function loadMatSchedule() {
    generateMats();
    loadMatSelects();
    loadCompetitorSelectsForMatches();
    loadSchedule();
    recalculateScheduleTimes();
    loadScheduleGrid();
}

// Drag and Drop Schedule Grid with Dynamic Timeline
function loadScheduleGrid() {
    const scheduleGrid = document.getElementById('schedule-grid');
    if (!scheduleGrid) return;

    const mats = db.load('mats');
    const eventTypes = db.load('eventTypes');
    const matSchedule = loadMatScheduleData();
    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');

    // Populate event filter dropdown (once)
    const filterEl = document.getElementById('schedule-event-filter');
    if (filterEl && filterEl.options.length <= 1) {
        eventTypes.forEach(ev => {
            const opt = document.createElement('option');
            opt.value = ev.id;
            opt.textContent = ev.name;
            filterEl.appendChild(opt);
        });
    }
    const activeEventFilter = filterEl ? String(filterEl.value) : '';

    // Clean up empty brackets
    let cleaned = false;
    Object.keys(brackets).forEach(bracketId => {
        if (!brackets[bracketId].competitors || brackets[bracketId].competitors.length === 0) {
            delete brackets[bracketId];
            cleaned = true;
        }
    });
    if (cleaned) {
        saveBrackets(brackets);
    }

    // Get all divisions that have brackets with competitors (ready to be scheduled)
    const allDivisionsList = [];
    Object.keys(brackets).forEach(bracketId => {
        const bracket = brackets[bracketId];
        const event = eventTypes.find(e => e.id == bracket.eventId);
        const divisionName = bracket.division || bracket.divisionName;

        // Apply event filter — skip brackets from other events when a filter is active
        if (activeEventFilter && String(bracket.eventId) !== activeEventFilter) return;

        if (event && divisionName) {
            let competitorCount = bracket.competitors?.length || 0;

            if (competitorCount === 0) {
                if (bracket.entries?.length > 0) {
                    competitorCount = bracket.entries.length;
                } else if (bracket.pools?.length > 0) {
                    bracket.pools.forEach(pool => {
                        competitorCount += pool.competitors?.length || 0;
                    });
                } else if (bracket.winners?.length > 0) {
                    const uniqueCompetitors = new Set();
                    bracket.winners.forEach(match => {
                        if (match.redCorner) uniqueCompetitors.add(match.redCorner.id || `${match.redCorner.firstName}_${match.redCorner.lastName}`);
                        if (match.blueCorner) uniqueCompetitors.add(match.blueCorner.id || `${match.blueCorner.firstName}_${match.blueCorner.lastName}`);
                    });
                    competitorCount = uniqueCompetitors.size;
                } else if (bracket.matches?.length > 0) {
                    const uniqueCompetitors = new Set();
                    bracket.matches.forEach(match => {
                        if (match.redCorner) uniqueCompetitors.add(match.redCorner.id || `${match.redCorner.firstName}_${match.redCorner.lastName}`);
                        if (match.blueCorner) uniqueCompetitors.add(match.blueCorner.id || `${match.blueCorner.firstName}_${match.blueCorner.lastName}`);
                    });
                    competitorCount = uniqueCompetitors.size;
                }
            }

            if (competitorCount > 0) {
                allDivisionsList.push({
                    name: divisionName,
                    eventId: bracket.eventId,
                    eventName: event.name,
                    count: competitorCount,
                    bracketId: bracketId
                });
            }
        }
    });

    // Build a Set of already-scheduled division+event combos (scoped per event to avoid cross-event false matches)
    const scheduledKeys = new Set();
    Object.keys(matSchedule).forEach(matId => {
        (matSchedule[matId] || []).forEach(slot => {
            scheduledKeys.add(`${slot.eventId}::${slot.division}`);
        });
    });

    // Filter out divisions that are already scheduled (scoped by eventId+name)
    const unassignedDivisions = allDivisionsList.filter(
        div => !scheduledKeys.has(`${div.eventId}::${div.name}`)
    );

    // Group unassigned by event for display
    const divisionsByEvent = {};
    unassignedDivisions.forEach(div => {
        if (!divisionsByEvent[div.eventId]) divisionsByEvent[div.eventId] = { eventName: div.eventName, divisions: [] };
        divisionsByEvent[div.eventId].divisions.push(div);
    });

    const unassignedPoolHTML = Object.keys(divisionsByEvent).length === 0
        ? '<p class="hint">All divisions have been scheduled!</p>'
        : Object.keys(divisionsByEvent).map(evId => {
            const group = divisionsByEvent[evId];
            return `
                <div style="margin-bottom: 12px;">
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--accent); padding: 4px 0; border-bottom: 1px solid var(--glass-border); margin-bottom: 6px;">${group.eventName}</div>
                    ${group.divisions.map(div => {
                        const estDuration = estimateDivisionDuration(div.name, div.eventId);
                        return `
                            <div class="division-item" draggable="true" data-division="${div.name}" data-event="${div.eventId}">
                                <strong>${div.name}</strong>
                                <span class="division-count">${div.count} competitors | ~${estDuration} min</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }).join('');

    scheduleGrid.innerHTML = `
        <div class="schedule-layout">
            <div class="divisions-pool">
                <h4>Unassigned Divisions</h4>
                <p class="hint">Drag divisions to mat columns on the right</p>
                <div class="divisions-list" id="divisions-pool">
                    ${unassignedPoolHTML}
                </div>
            </div>

            <div class="schedule-timeline">
                <h4>Mat Schedule${activeEventFilter ? ` — ${eventTypes.find(e => String(e.id) === activeEventFilter)?.name || ''}` : ''}</h4>
                <div class="timeline-grid">
                    ${mats.map(mat => `
                        <div class="mat-column">
                            <div class="mat-header">${mat.name}</div>
                            <div class="time-slots" data-mat="${mat.id}">
                                ${generateDynamicTimeline(mat.id, activeEventFilter)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    // Add drag and drop event listeners
    initializeDragAndDrop();

    // Add event delegation for clicking scheduled divisions
    scheduleGrid.addEventListener('click', function(e) {
        const scheduledDiv = e.target.closest('.scheduled-division');
        if (scheduledDiv && !e.target.classList.contains('remove-slot') && !e.target.classList.contains('override-duration-btn')) {
            e.stopPropagation();
            const matId = parseInt(scheduledDiv.dataset.matId);
            const division = scheduledDiv.dataset.division;
            const eventId = scheduledDiv.dataset.eventId;

            console.log('Clicking scheduled division:', { matId, division, eventId });
            openOperatorScoreboard(matId, division, eventId);
        }
    });
}

function generateDynamicTimeline(matId, eventFilter) {
    const schedule = loadMatScheduleData();
    let matSlots = (schedule[matId] || []).sort((a, b) => (a.order || 0) - (b.order || 0));
    // When an event filter is active, only show slots for that event
    if (eventFilter) {
        matSlots = matSlots.filter(s => String(s.eventId) === eventFilter);
    }
    const settings = getScheduleSettings();

    if (matSlots.length === 0) {
        return `
            <div class="time-slot drop-zone-empty" data-mat="${matId}" data-position="0">
                <div class="slot-empty" style="padding: 40px 8px;">Drop divisions here to schedule</div>
            </div>
        `;
    }

    // Calculate the projected end time for the last slot
    const lastSlot = matSlots[matSlots.length - 1];
    const matEndTime = lastSlot?.estimatedEndTime || '17:00';

    let html = '';

    matSlots.forEach((slot, idx) => {
        const statusClass = getStatusClass(slot);
        const statusIcon = getStatusIcon(slot);
        const startTime = slot.estimatedStartTime || '--:--';
        const endTime = slot.estimatedEndTime || '--:--';
        const duration = slot.estimatedDuration || '?';

        // Show actual vs estimated times for completed/in-progress
        let timeDisplay = `${startTime} - ${endTime}`;
        let timeDiff = '';
        if (slot.actualStartTime && slot.estimatedStartTime) {
            const actualMins = parseTimeToMinutes(slot.actualStartTime);
            const estMins = parseTimeToMinutes(slot.estimatedStartTime);
            const diff = actualMins - estMins;
            if (Math.abs(diff) >= 2) {
                timeDiff = diff > 0
                    ? `<span style="color: #ff453a; font-size: 10px; margin-left: 6px;">+${diff}min late</span>`
                    : `<span style="color: #22c55e; font-size: 10px; margin-left: 6px;">${diff}min early</span>`;
            }
        }

        // Get division progress
        const progress = getDivisionProgress(slot.division, slot.eventId);
        const progressPercent = progress.percent;
        const progressLabel = progress.total > 0 ? `${progress.completed}/${progress.total}` : '';

        // Progress bar color based on status
        let progressColor = 'rgba(220, 38, 38, 0.6)'; // blue - in progress
        if (progress.status === 'completed') progressColor = 'rgba(34, 197, 94, 0.7)'; // green
        else if (progress.status === 'upcoming') progressColor = 'rgba(255, 255, 255, 0.15)'; // dim

        html += `
            <div class="time-slot ${statusClass}" data-mat="${matId}" data-position="${idx}">
                <div class="scheduled-division" data-division="${slot.division}" data-mat-id="${matId}" data-event-id="${slot.eventId}" style="cursor: pointer;">
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                            <span style="font-size: 11px;">${statusIcon}</span>
                            <span style="font-weight: 600; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${slot.division}</span>
                            ${progressLabel ? `<span style="font-size: 10px; opacity: 0.7; margin-left: auto; white-space: nowrap;">${progressLabel}</span>` : ''}
                        </div>
                        <div style="font-size: 11px; opacity: 0.8; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                            <span>${timeDisplay}</span>
                            ${timeDiff}
                            <span style="margin-left: auto;">~${duration}min</span>
                        </div>
                        ${progress.total > 0 ? `
                            <div class="division-progress-bar" style="margin-top: 6px; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
                                <div class="division-progress-fill" style="width: ${progressPercent}%; height: 100%; background: ${progressColor}; border-radius: 2px; transition: width 0.5s ease;"></div>
                            </div>
                        ` : ''}
                    </div>
                    <div style="display: flex; gap: 4px; flex-shrink: 0;">
                        <button class="override-duration-btn" onclick="event.stopPropagation(); promptDurationOverride(${matId}, ${idx})" title="Override duration" style="background: rgba(255,255,255,0.15); border: none; color: white; width: 22px; height: 22px; border-radius: 4px; cursor: pointer; font-size: 11px; display: flex; align-items: center; justify-content: center;">
                            ⏱
                        </button>
                        <button class="remove-slot" onclick="event.stopPropagation(); removeFromSchedule(${matId}, ${idx})" style="background: rgba(255,255,255,0.15); border: none; color: white; width: 22px; height: 22px; border-radius: 50%; cursor: pointer; font-size: 11px; display: flex; align-items: center; justify-content: center;">
                            ×
                        </button>
                    </div>
                </div>
            </div>
        `;
    });

    // Add a final drop zone at the end
    html += `
        <div class="time-slot drop-zone-end" data-mat="${matId}" data-position="${matSlots.length}">
            <div class="slot-empty">Drop here</div>
        </div>
    `;

    // Summary footer
    const matStart = settings.matStartTimes[matId] || '08:00';
    html += `
        <div style="padding: 8px 12px; background: rgba(220, 38, 38, 0.05); border-top: 1px solid var(--glass-border); font-size: 11px; color: var(--text-secondary);">
            ${matSlots.length} divisions | ${matStart} - ${matEndTime}
        </div>
    `;

    return html;
}

function getStatusClass(slot) {
    switch (slot.status) {
        case 'completed': return 'slot-completed';
        case 'in-progress': return 'slot-in-progress';
        case 'behind': return 'slot-behind';
        case 'ahead': return 'slot-ahead';
        default: return 'slot-upcoming';
    }
}

function getStatusIcon(slot) {
    switch (slot.status) {
        case 'completed': return '✅';
        case 'in-progress': return '🔴';
        case 'behind': return '⚠️';
        case 'ahead': return '⏩';
        default: return '⏳';
    }
}

function promptDurationOverride(matId, slotIndex) {
    const schedule = loadMatScheduleData();
    const slot = schedule[matId]?.[slotIndex];
    if (!slot) return;

    const current = slot.durationOverride || slot.estimatedDuration || 15;
    const newDuration = prompt(`Override duration for "${slot.division}":\nCurrent estimate: ~${slot.estimatedDuration || '?'} min\n\nEnter new duration in minutes:`, current);

    if (newDuration !== null && !isNaN(parseInt(newDuration))) {
        slot.durationOverride = parseInt(newDuration);
        saveMatScheduleData(schedule);
        recalculateScheduleTimes();
        loadScheduleGrid();
        showMessage(`Duration for ${slot.division} set to ${newDuration} min`);
    }
}

function removeFromSchedule(matId, slotIndex) {
    const schedule = loadMatScheduleData();
    if (schedule[matId]) {
        const removed = schedule[matId].splice(slotIndex, 1);
        // Re-index orders
        schedule[matId].forEach((slot, idx) => { slot.order = idx; });
        saveMatScheduleData(schedule);
        recalculateScheduleTimes();
        loadScheduleGrid();
        if (removed.length > 0) showMessage(`${removed[0].division} removed from schedule`);
    }
}

function initializeDragAndDrop() {
    // Make division items draggable
    const divisionItems = document.querySelectorAll('.division-item');
    divisionItems.forEach(item => {
        item.addEventListener('dragstart', handleScheduleDragStart);
        item.addEventListener('dragend', handleScheduleDragEnd);
    });

    // Make time slots / drop zones droppable
    const timeSlots = document.querySelectorAll('.time-slot');
    timeSlots.forEach(slot => {
        slot.addEventListener('dragover', handleScheduleDragOver);
        slot.addEventListener('drop', handleScheduleDrop);
        slot.addEventListener('dragleave', handleScheduleDragLeave);
    });
}

let draggedDivision = null;

function handleScheduleDragStart(e) {
    draggedDivision = {
        name: this.dataset.division,
        eventId: this.dataset.event
    };
    this.style.opacity = '0.5';
}

function handleScheduleDragEnd(e) {
    this.style.opacity = '1';
}

function handleScheduleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

function handleScheduleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleScheduleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    if (!draggedDivision) return;

    const matId = parseInt(e.currentTarget.dataset.mat);
    const position = parseInt(e.currentTarget.dataset.position);

    // Save to schedule using new data structure
    const schedule = loadMatScheduleData();
    if (!schedule[matId]) {
        schedule[matId] = [];
    }

    // Check if this division+event is already scheduled on this mat
    const existingIdx = schedule[matId].findIndex(
        s => s.division === draggedDivision.name && String(s.eventId) === String(draggedDivision.eventId)
    );
    if (existingIdx >= 0) {
        showMessage('Division already scheduled on this mat', 'warning');
        return;
    }

    // Create new slot entry
    const newSlot = {
        order: position,
        division: draggedDivision.name,
        eventId: draggedDivision.eventId,
        estimatedDuration: null,
        durationOverride: null,
        estimatedStartTime: null,
        estimatedEndTime: null,
        actualStartTime: null,
        actualEndTime: null,
        status: 'upcoming'
    };

    // Insert at position
    schedule[matId].splice(position, 0, newSlot);

    // Re-index orders
    schedule[matId].forEach((slot, idx) => { slot.order = idx; });

    saveMatScheduleData(schedule);
    recalculateScheduleTimes();
    loadScheduleGrid();

    const mats = db.load('mats');
    const matName = mats.find(m => m.id == matId)?.name || `Mat ${matId}`;
    showMessage(`${draggedDivision.name} scheduled on ${matName}`);
}

// Legacy compatibility: removeFromSlot still works (used by queue management)
function removeFromSlot(matId, timeOrDivision) {
    const schedule = loadMatScheduleData();
    if (schedule[matId]) {
        // Try to match by time (legacy) or division name
        const before = schedule[matId].length;
        schedule[matId] = schedule[matId].filter(s =>
            s.legacyTime !== timeOrDivision && s.division !== timeOrDivision
        );

        // If nothing matched by legacy/division, try matching the division at that time
        if (schedule[matId].length === before) {
            schedule[matId] = schedule[matId].filter(s => s.estimatedStartTime !== timeOrDivision);
        }

        schedule[matId].forEach((slot, idx) => { slot.order = idx; });
        saveMatScheduleData(schedule);
        recalculateScheduleTimes();
        loadScheduleGrid();
        showMessage('Division removed from schedule');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHEDULE MANAGEMENT - Live Control & Queue System
// ═══════════════════════════════════════════════════════════════════════════

function showScheduleTab(tabName) {
    // Update button states
    document.getElementById('schedule-tab-timeline').className = tabName === 'timeline' ? 'btn btn-primary' : 'btn btn-secondary';
    document.getElementById('schedule-tab-live').className = tabName === 'live' ? 'btn btn-primary' : 'btn btn-secondary';
    document.getElementById('schedule-tab-queue').className = tabName === 'queue' ? 'btn btn-primary' : 'btn btn-secondary';

    // Hide all content
    document.getElementById('schedule-content-timeline').classList.add('hidden');
    document.getElementById('schedule-content-live').classList.add('hidden');
    document.getElementById('schedule-content-queue').classList.add('hidden');

    // Show selected content
    document.getElementById(`schedule-content-${tabName}`).classList.remove('hidden');

    // Load content based on tab
    if (tabName === 'timeline') {
        loadScheduleGrid();
    } else if (tabName === 'live') {
        loadLiveControlGrid();
    } else if (tabName === 'queue') {
        loadQueueManagementGrid();
    }
}

function loadLiveControlGrid() {
    const container = document.getElementById('live-control-grid');
    if (!container) return;

    const mats = db.load('mats');
    const matSchedule = loadMatScheduleData();
    const matScoreboards = JSON.parse(localStorage.getItem(_scopedKey('matScoreboards')) || '{}');
    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
    const eventTypes = db.load('eventTypes');

    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px;">
            ${mats.map(mat => {
                const schedule = (matSchedule[mat.id] || []).sort((a, b) => (a.order || 0) - (b.order || 0));
                const currentScoreboard = matScoreboards[mat.id];
                const currentSlot = schedule.find(s => s.division === currentScoreboard?.division);

                // Get next divisions that aren't completed
                const currentIndex = schedule.findIndex(s => s.division === currentScoreboard?.division);
                const upcomingSlots = schedule.filter((s, idx) => {
                    if (currentIndex >= 0) return idx > currentIndex && s.status !== 'completed';
                    return s.status !== 'completed';
                }).slice(0, 3);

                // Calculate pace info
                const completedCount = schedule.filter(s => s.status === 'completed').length;
                const totalCount = schedule.length;
                const lastSlot = schedule[schedule.length - 1];
                const projectedEnd = lastSlot?.estimatedEndTime || '--:--';

                return `
                    <div class="glass-panel" style="padding: 20px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <h4 style="margin: 0; font-size: 18px;">${mat.name}</h4>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="width: 10px; height: 10px; border-radius: 50%; background: ${currentScoreboard ? '#22c55e' : '#8e8e93'};"></span>
                                <span style="font-size: 12px; color: var(--text-secondary);">${currentScoreboard ? 'ACTIVE' : 'Idle'}</span>
                                <span style="font-size: 11px; color: var(--text-secondary); margin-left: 8px;">${completedCount}/${totalCount} done</span>
                            </div>
                        </div>

                        ${currentScoreboard ? `
                            <!-- Current Match -->
                            <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 10px; padding: 16px; margin-bottom: 16px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                    <div style="font-weight: 600; color: #22c55e;">🔴 LIVE NOW</div>
                                    <button class="btn btn-small btn-primary" onclick="openOperatorScoreboard(${mat.id}, '${currentScoreboard.division}', ${currentScoreboard.eventId})" style="padding: 6px 12px;">
                                        Open Scoreboard
                                    </button>
                                </div>
                                <div style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">${currentScoreboard.division}</div>
                                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">
                                    ${currentSlot ? `Est: ${currentSlot.estimatedStartTime || '--:--'} - ${currentSlot.estimatedEndTime || '--:--'}` : 'Not on schedule'}
                                    ${currentSlot?.actualStartTime ? ` | Started: ${currentSlot.actualStartTime}` : ''}
                                </div>
                                <div style="display: flex; gap: 8px;">
                                    <button class="btn btn-small btn-secondary" onclick="pauseMat(${mat.id})" style="flex: 1;">
                                        ⏸️ Pause
                                    </button>
                                    <button class="btn btn-small btn-danger" onclick="skipDivision(${mat.id})" style="flex: 1;">
                                        ⏭️ Skip
                                    </button>
                                </div>
                            </div>
                        ` : `
                            <!-- No Active Match -->
                            <div style="background: var(--bg-secondary); border-radius: 10px; padding: 16px; margin-bottom: 16px; text-align: center;">
                                <p style="color: var(--text-secondary); margin: 0 0 12px 0;">No active match</p>
                                ${schedule.filter(s => s.status !== 'completed').length > 0 ? `
                                    <button class="btn btn-primary btn-small" onclick="startNextDivision(${mat.id})">
                                        ▶️ Start Next Division
                                    </button>
                                ` : `
                                    <p style="font-size: 12px; color: var(--text-secondary); margin: 0;">No divisions scheduled</p>
                                `}
                            </div>
                        `}

                        <!-- Upcoming Queue -->
                        <div style="border-top: 1px solid var(--glass-border); padding-top: 12px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <div style="font-size: 12px; font-weight: 600; color: var(--text-secondary);">UP NEXT:</div>
                                <div style="font-size: 11px; color: var(--text-secondary);">Projected end: ${projectedEnd}</div>
                            </div>
                            ${upcomingSlots.length > 0 ? upcomingSlots.map((slot, idx) => `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: var(--bg-secondary); border-radius: 6px; margin-bottom: 6px;">
                                    <div>
                                        <div style="font-size: 13px; font-weight: 500;">${idx + 1}. ${slot.division}</div>
                                        <div style="font-size: 11px; color: var(--text-secondary);">${slot.estimatedStartTime || '--:--'} | ~${slot.estimatedDuration || '?'}min</div>
                                    </div>
                                    <div style="display: flex; gap: 4px;">
                                        <button class="btn btn-small" onclick="moveToFront(${mat.id}, '${slot.division}')" style="padding: 4px 8px; font-size: 11px;">
                                            ⬆️
                                        </button>
                                        <button class="btn btn-small btn-danger" onclick="removeFromQueue(${mat.id}, '${slot.division}')" style="padding: 4px 8px; font-size: 11px;">
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            `).join('') : `
                                <p style="font-size: 12px; color: var(--text-secondary); text-align: center;">No upcoming divisions</p>
                            `}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function loadQueueManagementGrid() {
    const container = document.getElementById('queue-management-grid');
    if (!container) return;

    const mats = db.load('mats');
    const matSchedule = loadMatScheduleData();
    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
    const eventTypes = db.load('eventTypes');

    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 20px;">
            ${mats.map(mat => {
                const schedule = (matSchedule[mat.id] || []).sort((a, b) => (a.order || 0) - (b.order || 0));

                return `
                    <div class="glass-panel" style="padding: 20px;">
                        <h4 style="margin: 0 0 16px 0;">${mat.name} Queue</h4>

                        ${schedule.length > 0 ? `
                            <div id="queue-${mat.id}" style="display: flex; flex-direction: column; gap: 8px;">
                                ${schedule.map((slot, idx) => {
                                    // Get bracket info
                                    const bracketKey = Object.keys(brackets).find(key => {
                                        const b = brackets[key];
                                        return (b.division === slot.division || b.divisionName === slot.division) && b.eventId == slot.eventId;
                                    });
                                    const bracket = bracketKey ? brackets[bracketKey] : null;

                                    // Count progress based on bracket type
                                    let progressText = '';
                                    if (bracket) {
                                        if (bracket.type === 'ranking-list') {
                                            const scored = (bracket.entries || []).filter(e => e.score != null).length;
                                            const total = (bracket.entries || []).length;
                                            progressText = `${scored}/${total} scored`;
                                        } else {
                                            const totalMatches = bracket.matches?.length || 0;
                                            const completedMatches = bracket.matches?.filter(m => m.status === 'completed').length || 0;
                                            progressText = `${completedMatches}/${totalMatches} matches`;
                                        }
                                    }

                                    const statusIcon = getStatusIcon(slot);
                                    const statusBg = slot.status === 'completed' ? 'rgba(34, 197, 94, 0.08)' :
                                                     slot.status === 'in-progress' ? 'rgba(220, 38, 38, 0.08)' : 'var(--bg-secondary)';

                                    return `
                                        <div class="queue-item" draggable="true" data-mat="${mat.id}" data-index="${idx}" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: ${statusBg}; border-radius: 8px; cursor: move; border: 1px solid var(--glass-border);">
                                            <div style="display: flex; align-items: center; gap: 12px;">
                                                <div style="font-size: 18px; font-weight: 700; color: var(--text-secondary); min-width: 32px;">${idx + 1}</div>
                                                <div>
                                                    <div style="display: flex; align-items: center; gap: 6px;">
                                                        <span style="font-size: 12px;">${statusIcon}</span>
                                                        <span style="font-weight: 600; font-size: 14px;">${slot.division}</span>
                                                    </div>
                                                    <div style="font-size: 11px; color: var(--text-secondary);">
                                                        ${slot.estimatedStartTime || '--:--'} - ${slot.estimatedEndTime || '--:--'} | ~${slot.estimatedDuration || '?'}min | ${progressText}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style="display: flex; gap: 6px;">
                                                <button class="btn btn-small btn-primary" onclick="openOperatorScoreboard(${mat.id}, '${slot.division}', ${slot.eventId})" style="padding: 6px 12px; font-size: 12px;">
                                                    Open
                                                </button>
                                                <button class="btn btn-small btn-danger" onclick="removeFromSchedule(${mat.id}, ${idx})" style="padding: 6px 10px; font-size: 12px;">
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        ` : `
                            <p style="text-align: center; color: var(--text-secondary); padding: 40px 0;">No divisions scheduled on this mat</p>
                        `}
                    </div>
                `;
            }).join('')}
        </div>
    `;

    // Initialize drag-and-drop for queue reordering
    initializeQueueDragAndDrop();
}

function initializeQueueDragAndDrop() {
    const queueItems = document.querySelectorAll('.queue-item');
    queueItems.forEach(item => {
        item.addEventListener('dragstart', handleQueueDragStart);
        item.addEventListener('dragover', handleQueueDragOver);
        item.addEventListener('drop', handleQueueDrop);
        item.addEventListener('dragend', handleQueueDragEnd);
    });
}

let draggedQueueItem = null;

function handleQueueDragStart(e) {
    draggedQueueItem = {
        matId: parseInt(this.dataset.mat),
        index: parseInt(this.dataset.index)
    };
    this.style.opacity = '0.5';
}

function handleQueueDragOver(e) {
    e.preventDefault();
    const targetMatId = parseInt(e.currentTarget.dataset.mat);
    if (draggedQueueItem && draggedQueueItem.matId === targetMatId) {
        e.currentTarget.style.borderTop = '2px solid var(--accent)';
    }
}

function handleQueueDrop(e) {
    e.preventDefault();
    e.currentTarget.style.borderTop = '';

    if (!draggedQueueItem) return;

    const targetMatId = parseInt(e.currentTarget.dataset.mat);
    const targetIndex = parseInt(e.currentTarget.dataset.index);

    if (draggedQueueItem.matId !== targetMatId) return; // Don't allow cross-mat dragging

    // Reorder the schedule
    const schedule = loadMatScheduleData();
    const matSlots = schedule[targetMatId] || [];

    if (draggedQueueItem.index !== targetIndex) {
        // Remove from old position
        const [item] = matSlots.splice(draggedQueueItem.index, 1);
        // Insert at new position
        matSlots.splice(targetIndex, 0, item);

        // Re-index orders
        matSlots.forEach((slot, idx) => { slot.order = idx; });

        schedule[targetMatId] = matSlots;
        saveMatScheduleData(schedule);
        recalculateScheduleTimes();

        showMessage('Queue order updated');
        loadQueueManagementGrid();
    }
}

function handleQueueDragEnd(e) {
    this.style.opacity = '1';
    this.style.borderTop = '';
}

// Live control functions
function pauseMat(matId) {
    const matScoreboards = JSON.parse(localStorage.getItem(_scopedKey('matScoreboards')) || '{}');
    if (matScoreboards[matId]) {
        matScoreboards[matId].paused = !matScoreboards[matId].paused;
        localStorage.setItem(_scopedKey('matScoreboards'), JSON.stringify(matScoreboards));
        showMessage(`Mat ${matId} ${matScoreboards[matId].paused ? 'paused' : 'resumed'}`);
        loadLiveControlGrid();
    }
}

function skipDivision(matId) {
    if (confirm('Skip this division and move to the next one? The current division will be moved to the end of the queue.')) {
        const schedule = loadMatScheduleData();
        const matSlots = (schedule[matId] || []).sort((a, b) => (a.order || 0) - (b.order || 0));

        // Find first non-completed division
        const activeIdx = matSlots.findIndex(s => s.status === 'in-progress' || s.status === 'upcoming');
        if (activeIdx >= 0 && matSlots.length > 1) {
            const [skipped] = matSlots.splice(activeIdx, 1);
            skipped.status = 'upcoming';
            skipped.actualStartTime = null;
            matSlots.push(skipped);

            // Re-index orders
            matSlots.forEach((slot, idx) => { slot.order = idx; });

            schedule[matId] = matSlots;
            saveMatScheduleData(schedule);
            recalculateScheduleTimes();

            // Clear current scoreboard
            const matScoreboards = JSON.parse(localStorage.getItem(_scopedKey('matScoreboards')) || '{}');
            delete matScoreboards[matId];
            localStorage.setItem(_scopedKey('matScoreboards'), JSON.stringify(matScoreboards));

            showMessage('Division skipped and moved to end of queue');
            loadLiveControlGrid();
        }
    }
}

function startNextDivision(matId) {
    const schedule = loadMatScheduleData();
    const matSlots = (schedule[matId] || []).sort((a, b) => (a.order || 0) - (b.order || 0));

    // Find first non-completed division
    const next = matSlots.find(s => s.status !== 'completed');
    if (next) {
        // Mark it as in-progress with actual start time
        next.status = 'in-progress';
        next.actualStartTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
        saveMatScheduleData(schedule);
        recalculateScheduleTimes();

        openOperatorScoreboard(matId, next.division, next.eventId);
    }
}

function moveToFront(matId, division) {
    const schedule = loadMatScheduleData();
    const matSlots = (schedule[matId] || []).sort((a, b) => (a.order || 0) - (b.order || 0));

    const index = matSlots.findIndex(s => s.division === division);
    if (index > 0) {
        // Find where the first non-completed slot is
        const firstUpcomingIdx = matSlots.findIndex(s => s.status === 'upcoming');
        const insertAt = firstUpcomingIdx >= 0 ? firstUpcomingIdx : 0;

        const [item] = matSlots.splice(index, 1);
        matSlots.splice(insertAt, 0, item);

        matSlots.forEach((slot, idx) => { slot.order = idx; });
        schedule[matId] = matSlots;
        saveMatScheduleData(schedule);
        recalculateScheduleTimes();

        showMessage(`${division} moved to front of queue`);
        loadLiveControlGrid();
    }
}

function removeFromQueue(matId, division) {
    const schedule = loadMatScheduleData();
    const matSlots = schedule[matId] || [];

    schedule[matId] = matSlots.filter(s => s.division !== division);
    schedule[matId].forEach((slot, idx) => { slot.order = idx; });
    saveMatScheduleData(schedule);
    recalculateScheduleTimes();

    showMessage(`${division} removed from queue`);
    loadLiveControlGrid();
}

function autoScheduleDivisions() {
    const filterEl = document.getElementById('schedule-event-filter');
    const activeEventFilter = filterEl ? String(filterEl.value) : '';
    const filterLabel = activeEventFilter && filterEl
        ? filterEl.options[filterEl.selectedIndex]?.text
        : 'all events';

    if (!confirm(`Automatically schedule unassigned divisions (${filterLabel}) across all mats? This will distribute them evenly.`)) {
        return;
    }

    const mats = db.load('mats');
    const eventTypes = db.load('eventTypes');
    const matSchedule = loadMatScheduleData();
    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');

    // Get all divisions that have brackets with competitors
    const allDivisionsList = [];
    Object.keys(brackets).forEach(bracketId => {
        const bracket = brackets[bracketId];
        const event = eventTypes.find(e => e.id == bracket.eventId);
        const divisionName = bracket.division || bracket.divisionName;

        // Respect event filter
        if (activeEventFilter && String(bracket.eventId) !== activeEventFilter) return;

        if (event && divisionName) {
            let competitorCount = bracket.competitors?.length || 0;

            if (competitorCount === 0) {
                if (bracket.entries?.length > 0) {
                    competitorCount = bracket.entries.length;
                } else if (bracket.pools?.length > 0) {
                    bracket.pools.forEach(pool => {
                        competitorCount += pool.competitors?.length || 0;
                    });
                } else if (bracket.matches?.length > 0) {
                    const uniqueCompetitors = new Set();
                    bracket.matches.forEach(match => {
                        if (match.redCorner) uniqueCompetitors.add(match.redCorner.id || `${match.redCorner.firstName}_${match.redCorner.lastName}`);
                        if (match.blueCorner) uniqueCompetitors.add(match.blueCorner.id || `${match.blueCorner.firstName}_${match.blueCorner.lastName}`);
                    });
                    competitorCount = uniqueCompetitors.size;
                }
            }

            if (competitorCount > 0) {
                allDivisionsList.push({
                    name: divisionName,
                    eventId: bracket.eventId,
                    count: competitorCount,
                    estimatedDuration: estimateDivisionDuration(divisionName, bracket.eventId)
                });
            }
        }
    });

    // Get already scheduled divisions
    const scheduledDivisions = new Set();
    Object.keys(matSchedule).forEach(matId => {
        const matSlots = matSchedule[matId] || [];
        matSlots.forEach(slot => {
            scheduledDivisions.add(slot.division);
        });
    });

    // Filter unassigned
    const unassigned = allDivisionsList.filter(div => !scheduledDivisions.has(div.name));

    if (unassigned.length === 0) {
        showMessage('All divisions are already scheduled!');
        return;
    }

    // Sort unassigned by estimated duration (longest first for better balancing)
    unassigned.sort((a, b) => (b.estimatedDuration || 0) - (a.estimatedDuration || 0));

    // Distribute across mats using a balanced approach (shortest total time first)
    const matTotals = {}; // Track total minutes per mat
    mats.forEach(mat => {
        if (!matSchedule[mat.id]) matSchedule[mat.id] = [];
        // Sum up existing durations
        matTotals[mat.id] = matSchedule[mat.id].reduce((sum, s) => sum + (s.estimatedDuration || 15), 0);
    });

    unassigned.forEach(div => {
        // Find the mat with the lowest total time
        let bestMatId = mats[0].id;
        let bestTotal = Infinity;
        mats.forEach(mat => {
            if ((matTotals[mat.id] || 0) < bestTotal) {
                bestTotal = matTotals[mat.id] || 0;
                bestMatId = mat.id;
            }
        });

        const order = matSchedule[bestMatId].length;
        matSchedule[bestMatId].push({
            order: order,
            division: div.name,
            eventId: div.eventId,
            estimatedDuration: div.estimatedDuration,
            durationOverride: null,
            estimatedStartTime: null,
            estimatedEndTime: null,
            actualStartTime: null,
            actualEndTime: null,
            status: 'upcoming'
        });

        matTotals[bestMatId] = (matTotals[bestMatId] || 0) + (div.estimatedDuration || 15);
    });

    saveMatScheduleData(matSchedule);
    recalculateScheduleTimes();
    showMessage(`Auto-scheduled ${unassigned.length} divisions across ${mats.length} mats`);
    loadScheduleGrid();
}

function clearAllSchedules() {
    if (confirm('Clear all scheduled divisions? This cannot be undone.')) {
        saveMatScheduleData({});
        showMessage('All schedules cleared');
        loadScheduleGrid();
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// ORPHAN CLEANUP - Remove schedule entries for deleted/regenerated divisions
// ═══════════════════════════════════════════════════════════════════════════

function cleanOrphanScheduleEntries() {
    const schedule = loadMatScheduleData();
    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');

    // Build a set of all valid division names from existing brackets
    const validDivisions = new Set();
    Object.values(brackets).forEach(bracket => {
        const name = bracket.division || bracket.divisionName;
        if (name) validDivisions.add(name);
    });

    let removedCount = 0;
    Object.keys(schedule).forEach(matId => {
        const before = schedule[matId].length;
        schedule[matId] = schedule[matId].filter(slot => validDivisions.has(slot.division));
        removedCount += before - schedule[matId].length;

        // Re-index orders
        schedule[matId].forEach((slot, idx) => { slot.order = idx; });
    });

    if (removedCount > 0) {
        saveMatScheduleData(schedule);
        recalculateScheduleTimes();
        console.log(`Cleaned ${removedCount} orphan schedule entries`);
    }

    return removedCount;
}

function removeOrphanScheduleEntry(divisionName) {
    const schedule = loadMatScheduleData();
    let removed = false;

    Object.keys(schedule).forEach(matId => {
        const before = schedule[matId].length;
        schedule[matId] = schedule[matId].filter(slot => slot.division !== divisionName);
        if (schedule[matId].length < before) {
            removed = true;
            schedule[matId].forEach((slot, idx) => { slot.order = idx; });
        }
    });

    if (removed) {
        saveMatScheduleData(schedule);
        recalculateScheduleTimes();
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// LIVE STATUS TRACKING - Mark divisions in-progress/completed
// ═══════════════════════════════════════════════════════════════════════════

function markDivisionStarted(matId, divisionName) {
    const schedule = loadMatScheduleData();
    const matSlots = schedule[matId] || [];
    const slot = matSlots.find(s => s.division === divisionName);

    if (slot && slot.status !== 'completed') {
        slot.status = 'in-progress';
        slot.actualStartTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
        saveMatScheduleData(schedule);
        recalculateScheduleTimes();
    }
}

function markDivisionCompleted(matId, divisionName) {
    const schedule = loadMatScheduleData();
    const matSlots = schedule[matId] || [];
    const slot = matSlots.find(s => s.division === divisionName);

    if (slot) {
        slot.status = 'completed';
        slot.actualEndTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
        saveMatScheduleData(schedule);
        recalculateScheduleTimes();
    }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * OPERATOR SCOREBOARD - Match Control System
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ROUTE: Schedule tab → Click scheduled division → Operator modal opens
 *
 * FLOW (KUMITE):
 * 1. User clicks scheduled division on mat
 * 2. openOperatorScoreboard(matId, divisionName, eventId) - Opens modal
 * 3. Auto-loads RED and BLUE competitors from bracket (no manual selection)
 * 4. Auto-detects Kata vs Kumite based on event scoreboard type
 * 5. Routes to openKataScoreboard() if scoreboard type is kata-flags/kata-points
 * 6. Operator controls: scores, penalties, timer
 * 7. Click "Open TV Display" → Opens tv-display.html in new window
 * 8. updateOperatorTVDisplay() → Syncs to localStorage['scoreboard-state']
 * 9. TV display polls localStorage every 100ms for updates
 * 10. Operator declares winner → Match saved to bracket, auto-loads next match
 *
 * STATE VARIABLES (Global):
 * - currentOperatorMat: Active mat ID
 * - currentOperatorDivision: Division name
 * - currentOperatorEventId: Event type ID
 * - operatorRedCompetitor/operatorBlueCompetitor: Auto-loaded from bracket
 * - operatorRedScore/operatorBlueScore: Current scores
 * - operatorRedPenalties/operatorBluePenalties: Penalty counts
 * - operatorTimeRemaining: Match timer (seconds)
 * - operatorTimerInterval: setInterval reference
 * - currentMatchId: Current match ID from bracket
 * - currentBracketId: Current bracket ID
 *
 * SYNC MECHANISM:
 * localStorage['scoreboard-state'] = {
 *   matName, divisionName, matchInfo,          // Display headers
 *   corner1Name, corner2Name,                   // Custom corner names
 *   corner1Color, corner2Color,                 // Custom corner colors
 *   redName, redInfo, redPhoto, redScore, redPenalties,
 *   blueName, blueInfo, bluePhoto, blueScore, bluePenalties,
 *   timer, scoringType, winner
 * }
 *
 * ✅ FIXED BUGS (2026-02-13):
 * 1. ✅ Bug #26: Timer memory leak - closeOperatorScoreboard() now cleans up completely
 * 2. ✅ Bug #25: Auto-loads competitors from brackets (removed manual dropdowns)
 * 3. ✅ Bug #25: Auto-saves match results to brackets and advances winners
 * 4. ✅ Auto-loads next match after winner declared (2 second delay)
 * 5. ✅ Bug #24: Scoreboard settings (corner colors/names) now applied to TV display
 * 6. ✅ Kata vs Kumite auto-detection based on event scoreboard type
 *
 * ⚠️ REMAINING KNOWN ISSUES:
 * 1. Multiple mat scoreboards can have timer conflicts - Bug #27
 * 2. State not persisted - refreshing page loses match progress - Bug #13
 * 3. No DQ/forfeit handling - Bug #28
 *
 * 📝 TODO:
 * - Use mat-specific localStorage keys to prevent conflicts (Bug #27)
 * - Persist match state across page refresh (Bug #13)
 * - Add DQ/forfeit buttons (Bug #28)
 * - Save match history
 * - Add match replay feature
 *
 * Last Updated: 2026-02-13
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Operator Scoreboard
let currentOperatorMat = null;
let currentOperatorDivision = null;
let currentOperatorEventId = null;
// Active scoreboard type tracker - prevents multiple scoreboards from conflicting
let activeScoreboardType = null; // 'kumite', 'kata-flags', 'kata-points', 'standalone', null

// ── Kumite Dual Ruleset Definitions ─────────────────────────────────────────
const KUMITE_RULESETS = {
    wkf: {
        name: 'WKF 2026',
        scoring: {
            techniques: ['ippon', 'waza-ari', 'yuko'],
            values: { ippon: 3, 'waza-ari': 2, yuko: 1 },
            isDecimal: false,
            correctionStep: -1,
        },
        penalties: {
            system: 'two-track',
            tracks: {
                c1: { name: 'Category 1', levels: ['chukoku','keikoku','hansoku-chui','hansoku'], labels: ['C1','K1','HC1','H'] },
                c2: { name: 'Category 2', levels: ['chukoku','keikoku','hansoku-chui','hansoku'], labels: ['C2','K2','HC2','H'] },
            },
            awardsPoints: false,
            shikkaku: true,
        },
        timer: {
            defaultDuration: 180,
            presets: [
                { label: 'Senior/U21 (3:00)', duration: 180 },
                { label: 'Cadet/Junior (2:00)', duration: 120 },
                { label: 'U14 (1:30)', duration: 90 },
            ],
            atoshiBaraku: 15,
            overtimeDefault: 60,
        },
        winConditions: { pointLead: 8, senshu: true, hantei: true, overtime: true },
        matchFormats: null,
    },
    aau: {
        name: 'AAU 2025/2026',
        scoring: {
            techniques: ['ippon', 'waza-ari'],
            values: { ippon: 1.0, 'waza-ari': 0.5 },
            isDecimal: true,
            correctionStep: -0.5,
        },
        penalties: {
            system: 'three-track',
            tracks: {
                hansoku: {
                    name: 'Hansoku (Contact)',
                    levels: ['chukoku', 'hansoku-chui', 'hansoku'],
                    labels: ['CHU', 'HC', 'H'],
                },
                mubobi: {
                    name: 'Mubobi (Defenseless)',
                    levels: ['chukoku', 'hansoku-chui', 'hansoku'],
                    labels: ['CHU', 'HC', 'H'],
                },
                jogai: {
                    name: 'Jogai (Out of Bounds)',
                    levelsByFormat: {
                        'shobu-ippon': {
                            levels: ['jogai', 'jogai-hansoku-chui', 'jogai-hansoku'],
                            labels: ['J', 'JHC', 'JH'],
                        },
                        'shobu-sanbon': {
                            levels: ['jogai-ichi', 'jogai-ni', 'jogai-hansoku-chui', 'jogai-hansoku'],
                            labels: ['J1', 'J2', 'JHC', 'JH'],
                        },
                    },
                },
            },
            awardsPoints: false,
            shikkaku: true,
        },
        timer: {
            defaultDuration: 120,
            atoshiBaraku: 30,
        },
        winConditions: { pointLead: null, senshu: false, hantei: true, overtime: true },
        matchFormats: {
            'shobu-ippon': {
                name: 'Shobu Ippon',
                winScore: null,
                firstScoreWins: true,
                awaseteIppon: true,
                extensionName: 'Sai Shiai',
                extensionDuration: 120,
                extensionResetsScores: true,
                extensionResetsPenalties: true,
                suddenDeath: false,
            },
            'shobu-sanbon': {
                name: 'Shobu Sanbon',
                winScore: 3.0,
                firstScoreWins: false,
                awaseteIppon: true,
                extensionName: 'Encho-Sen',
                extensionDuration: 60,
                extensionResetsScores: true,
                extensionResetsPenalties: false,
                suddenDeath: true,
            },
        },
        defaultMatchFormat: 'shobu-sanbon',
    },
};

function getActiveRuleset() {
    const cfg = getUnifiedScoreboardConfig();
    const org = cfg?.org || 'wkf';
    const rules = JSON.parse(JSON.stringify(KUMITE_RULESETS[org] || KUMITE_RULESETS.wkf));
    if (cfg?.kumite?.pointsToWin) rules.winConditions.pointLead = cfg.kumite.pointsToWin;
    return { org, rules };
}

function resolveJogaiTrack(matchFormat) {
    const jogaiDef = KUMITE_RULESETS.aau.penalties.tracks.jogai;
    const variant = jogaiDef.levelsByFormat[matchFormat] || jogaiDef.levelsByFormat['shobu-sanbon'];
    return { name: jogaiDef.name, levels: variant.levels, labels: variant.labels };
}

function getResolvedPenaltyTracks(org, matchFormat) {
    const rules = KUMITE_RULESETS[org] || KUMITE_RULESETS.wkf;
    const tracks = {};
    for (const [key, def] of Object.entries(rules.penalties.tracks)) {
        if (def.levelsByFormat) {
            // Format-dependent track (AAU Jogai)
            const variant = def.levelsByFormat[matchFormat] || Object.values(def.levelsByFormat)[0];
            tracks[key] = { name: def.name, levels: variant.levels, labels: variant.labels };
        } else {
            tracks[key] = { name: def.name, levels: def.levels, labels: def.labels };
        }
    }
    return tracks;
}
// ── End Ruleset Definitions ─────────────────────────────────────────────────

let operatorRedCompetitor = null;
let operatorBlueCompetitor = null;
let operatorRedScore = 0;
let operatorBlueScore = 0;
let operatorRedPenalties = 0;
let operatorBluePenalties = 0;
let operatorRedPenaltyList = []; // Track specific penalties: [{type, timestamp}]
let operatorBluePenaltyList = []; // Track specific penalties
let operatorTimeRemaining = 120; // 2 minutes default
let operatorMatchDuration = 120; // Configured match duration in seconds
let operatorTimerInterval = null;
let operatorScoreHistory = []; // Track all scoring actions with timestamp
let operatorKeyboardEnabled = false; // Flag to enable/disable keyboard shortcuts

// Ruleset-aware state
let operatorCurrentOrg = 'wkf';
let operatorMatchFormat = null;
let operatorSenshu = null;
let operatorIsOvertime = false;
let operatorOvertimeRemaining = null;
let operatorAtoshiBaraku = false;
let operatorRedPenaltyTracks = {};
let operatorBluePenaltyTracks = {};
let operatorHanteiRound = 0;

// Score breakdown counters
let operatorIpponCountRed = 0;
let operatorIpponCountBlue = 0;
let operatorWazaariCountRed = 0;
let operatorWazaariCountBlue = 0;
let operatorYukoCountRed = 0;
let operatorYukoCountBlue = 0;

// Default: AKA (red/corner1) on RIGHT, AO (blue/corner2) on LEFT (matches judge's view from behind ref)
// When swapped: AKA on LEFT, AO on RIGHT (for operators sitting on the other side)
let operatorSidesSwapped = localStorage.getItem(_scopedKey('operatorSidesSwapped')) === 'true';

// Toggle operator sides (swap left/right corner panels)
// Default: AKA (corner1/red) on RIGHT, AO (corner2/blue) on LEFT
// Swapped: AKA on LEFT, AO on RIGHT
function toggleOperatorSides() {
    operatorSidesSwapped = !operatorSidesSwapped;
    localStorage.setItem(_scopedKey('operatorSidesSwapped'), operatorSidesSwapped);
    // Kumite: 3-column grid [Corner1, Timer, Corner2]
    const grid = document.querySelector('.scoreboard-display');
    if (grid && grid.children.length >= 3) {
        grid.children[0].style.order = operatorSidesSwapped ? 1 : 3; // Corner1: default RIGHT(3), swapped LEFT(1)
        grid.children[2].style.order = operatorSidesSwapped ? 3 : 1; // Corner2: default LEFT(1), swapped RIGHT(3)
    }
    // Kumite: winner buttons [Corner1 Wins, Reset, Corner2 Wins]
    const winnerBtns = document.querySelectorAll('button[onclick*="operatorDeclareWinner"]');
    if (winnerBtns.length >= 2) {
        winnerBtns[0].style.order = operatorSidesSwapped ? 1 : 3; // Corner1 wins: match corner1 panel
        winnerBtns[1].style.order = operatorSidesSwapped ? 3 : 1; // Corner2 wins: match corner2 panel
    }
    // Kata-flags: 2-column layout
    const flagsGrid = document.querySelector('.kata-flags-competitors');
    if (flagsGrid && flagsGrid.children.length >= 2) {
        flagsGrid.children[0].style.order = operatorSidesSwapped ? 1 : 2; // Corner1: default RIGHT(2), swapped LEFT(1)
        flagsGrid.children[1].style.order = operatorSidesSwapped ? 2 : 1; // Corner2: default LEFT(1), swapped RIGHT(2)
    }
    // Update swap button tooltip
    const btn = document.getElementById('swap-sides-btn');
    if (btn) btn.title = operatorSidesSwapped ? 'Sides swapped (click to reset)' : 'Swap sides';
}

// Keyboard shortcut handler for operator scoreboard
function handleOperatorKeyboard(event) {
    if (!operatorKeyboardEnabled) return;

    const key = event.key.toUpperCase();
    const { org, rules } = getActiveRuleset();
    const values = rules.scoring.values;

    switch(key) {
        // Red Corner Scoring (Q=Ippon, W=Waza-ari, E=Yuko/WKF only)
        case 'Q':
            event.preventDefault();
            operatorAddScore('red', values.ippon, 'ippon');
            break;
        case 'W':
            event.preventDefault();
            operatorAddScore('red', values['waza-ari'], 'waza-ari');
            break;
        case 'E':
            if (values.yuko !== undefined && values.yuko !== null) {
                event.preventDefault();
                operatorAddScore('red', values.yuko, 'yuko');
            }
            break;

        // Blue Corner Scoring (U=Ippon, I=Waza-ari, O=Yuko/WKF only)
        case 'U':
            event.preventDefault();
            operatorAddScore('blue', values.ippon, 'ippon');
            break;
        case 'I':
            event.preventDefault();
            operatorAddScore('blue', values['waza-ari'], 'waza-ari');
            break;
        case 'O':
            if (values.yuko !== undefined && values.yuko !== null) {
                event.preventDefault();
                operatorAddScore('blue', values.yuko, 'yuko');
            }
            break;

        // Timer Controls
        case ' ': // Spacebar
            event.preventDefault();
            if (operatorTimerInterval) {
                operatorPauseTimer();
            } else {
                operatorStartTimer();
            }
            break;
        case 'R':
            event.preventDefault();
            operatorResetTimer();
            break;

        // Corrections (Z for red, M for blue)
        case 'Z':
            event.preventDefault();
            operatorAddScore('red', rules.scoring.correctionStep, 'correction');
            break;
        case 'M':
            event.preventDefault();
            operatorAddScore('blue', rules.scoring.correctionStep, 'correction');
            break;
    }
}

// ── Operator UI Generator Functions ─────────────────────────────────────────

function generateScoringButtons(corner, org, rules, cornerTextColor) {
    const techniques = rules.scoring.techniques;
    const values = rules.scoring.values;

    let buttons = '';
    techniques.forEach(tech => {
        const val = values[tech];
        if (val === undefined || val === null) return;
        const label = tech.toUpperCase().replace('-', ' ');
        const displayVal = rules.scoring.isDecimal ? val.toFixed(1) : `+${val}`;
        buttons += `
            <button class="btn btn-primary"
                onclick="operatorAddScore('${corner}', ${val}, '${tech}')"
                style="font-size: clamp(11px, 1.2vw, 13px); padding: clamp(6px, 0.8vh, 10px) 4px; font-weight: 600;">
                ${label} ${displayVal}
            </button>
        `;
    });

    // Correction button
    const correctionVal = rules.scoring.correctionStep;
    buttons += `
        <button class="btn btn-small btn-danger"
            onclick="operatorAddScore('${corner}', ${correctionVal}, 'correction')"
            style="font-size: 11px; padding: clamp(6px, 0.8vh, 10px) 4px;">
            ${correctionVal}
        </button>
    `;

    return `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: clamp(3px, 0.4vh, 6px); margin-bottom: clamp(4px, 0.5vh, 10px);">${buttons}</div>`;
}

function generatePenaltyButtons(corner, org, rules, cornerTextColor) {
    const resolvedTracks = getResolvedPenaltyTracks(org, operatorMatchFormat);
    let buttons = '';

    for (const [trackName, trackDef] of Object.entries(resolvedTracks)) {
        // Show the short label for the button
        const shortLabel = org === 'wkf'
            ? trackName.toUpperCase()  // C1, C2
            : trackDef.name.split('(')[0].trim().split(' ')[0].toUpperCase(); // HANSOKU, MUBOBI, JOGAI

        const btnColor = org === 'wkf'
            ? (trackName === 'c1' ? '#ffd60a' : '#ff9500')
            : (trackName === 'hansoku' ? '#ff453a' : trackName === 'mubobi' ? '#ff9500' : '#ffd60a');

        buttons += `
            <button class="btn btn-small"
                onclick="operatorAddPenalty('${corner}', '${trackName}')"
                style="font-size: 10px; padding: clamp(3px, 0.4vh, 6px); background: ${btnColor}; color: #000; font-weight: 600;">
                ${shortLabel}
            </button>
        `;
    }

    // Shikkaku button (both rulesets)
    if (rules.penalties.shikkaku) {
        buttons += `
            <button class="btn btn-small"
                onclick="operatorAddPenalty('${corner}', 'shikkaku')"
                style="font-size: 9px; padding: clamp(2px, 0.3vh, 4px); width: 100%; background: #000; color: #fff; margin-top: 2px;">
                SHIKKAKU
            </button>
        `;
    }

    const trackCount = Object.keys(resolvedTracks).length;

    return `
        <div style="border-top: 1px solid ${cornerTextColor}33; padding-top: clamp(4px, 0.5vh, 10px);">
            <div style="font-size: clamp(10px, 1.1vw, 13px); font-weight: 600; margin-bottom: clamp(3px, 0.4vh, 6px); text-align: center; color: ${cornerTextColor}; opacity: 0.9;">Penalties</div>
            <div style="display: grid; grid-template-columns: repeat(${trackCount}, 1fr); gap: 4px; margin-bottom: 4px;">
                ${buttons.split('SHIKKAKU')[0]}
            </div>
            ${rules.penalties.shikkaku ? `<button class="btn btn-small" onclick="operatorAddPenalty('${corner}', 'shikkaku')" style="font-size: 9px; padding: clamp(2px, 0.3vh, 4px); width: 100%; background: #000; color: #fff;">SHIKKAKU</button>` : ''}
            <div id="operator-${corner}-penalty-display" style="font-size: 10px; color: ${cornerTextColor}; opacity: 0.8; margin-top: 4px; text-align: center;"></div>
        </div>
    `;
}

function openOperatorScoreboard(matId, divisionName, eventId) {
    console.log('=== OPEN OPERATOR SCOREBOARD ===');
    console.log('matId:', matId, 'divisionName:', divisionName, 'eventId:', eventId);

    currentOperatorMat = matId;
    currentOperatorDivision = divisionName;
    currentOperatorEventId = eventId;

    // Get event type to determine scoreboard type
    const eventTypes = JSON.parse(localStorage.getItem(_scopedKey('eventTypes')) || '[]');
    const eventType = eventTypes.find(e => e.id == eventId);
    console.log('Event Type:', eventType);

    // Find bracket for this division
    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
    let currentBracket = null;

    // Search for bracket matching this division and event
    for (const bracketId in brackets) {
        const bracket = brackets[bracketId];
        if ((bracket.division === divisionName || bracket.divisionName === divisionName) && bracket.eventId == eventId) {
            currentBracket = bracket;
            break;
        }
    }

    // Determine scoreboard type: bracket override > event default
    let scoreboardType = 'kumite'; // default to kumite
    let scoreboardConfig = null;

    console.log('Current Bracket:', currentBracket);

    if (currentBracket && currentBracket.scoreboardConfigId) {
        // Bracket has explicit scoreboard configuration
        const scoreboardConfigs = db.load('scoreboardConfigs');
        scoreboardConfig = scoreboardConfigs.find(c => c.id == currentBracket.scoreboardConfigId);
        if (scoreboardConfig) {
            scoreboardType = scoreboardConfig.baseType;
        } else {
            // scoreboardConfigId may be a raw type string (e.g. 'kata-flags', 'kumite')
            // from unified config — use it directly as the scoreboard type
            const validTypes = ['kumite', 'kata-flags', 'kata-points', 'kobudo'];
            if (validTypes.includes(currentBracket.scoreboardConfigId)) {
                scoreboardType = currentBracket.scoreboardConfigId;
                // Also load the unified config for this type
                const unifiedCfg = getUnifiedScoreboardConfig();
                const typeKeyMap = { 'kumite': 'kumite', 'kata-flags': 'kataFlags', 'kata-points': 'kataPoints', 'kobudo': 'kobudo' };
                const typeKey = typeKeyMap[scoreboardType];
                if (unifiedCfg && typeKey && unifiedCfg[typeKey]) {
                    scoreboardConfig = {
                        id: 'unified-' + scoreboardType,
                        name: scoreboardType,
                        baseType: scoreboardType,
                        settings: unifiedCfg[typeKey]
                    };
                }
            }
        }
        console.log('Using bracket scoreboard config:', scoreboardConfig, 'type:', scoreboardType);
    } else if (currentBracket && currentBracket.scoreboardType) {
        // Legacy: Bracket has explicit scoreboard type override
        scoreboardType = currentBracket.scoreboardType;
        console.log('Using legacy bracket scoreboard type:', scoreboardType);
    } else if (eventType && eventType.scoreboardType) {
        // Use event's scoreboard type
        scoreboardType = eventType.scoreboardType;
        console.log('Using event scoreboard type:', scoreboardType);
    }

    console.log('Final scoreboard type:', scoreboardType);

    // Check if this should use kata-style operator
    // Only route to kata operator if:
    // 1. Scoreboard is kata-points or kobudo (individual scoring)
    // 2. Scoreboard is kata-flags AND bracket uses kata structure (rounds/performances)
    const usesKataStructure = currentBracket && currentBracket.rounds && Array.isArray(currentBracket.rounds);
    const isIndividualScoring = scoreboardType === 'kata-points' || scoreboardType === 'kobudo';
    const isKataFlagsWithKataStructure = scoreboardType === 'kata-flags' && usesKataStructure;

    console.log('Routing decision:', { usesKataStructure, isIndividualScoring, isKataFlagsWithKataStructure, bracketType: currentBracket?.type });

    // Mark division as in-progress in schedule
    markDivisionStarted(matId, divisionName);

    // Ranking-list brackets get their own scorer (no head-to-head, individual performances)
    if (currentBracket && currentBracket.type === 'ranking-list') {
        console.log('Routing to RANKING LIST scoreboard');
        openRankingListScoreboard(matId, divisionName, eventId, currentBracket, scoreboardType);
        return;
    }

    if (isIndividualScoring || isKataFlagsWithKataStructure) {
        // Route to Kata scoreboard for individual scoring or kata-flags with kata structure
        if (!currentBracket) {
            showToast('No bracket found for this division. Please generate a bracket first.', 'error');
            return;
        }
        console.log('Routing to KATA scoreboard');
        openKataScoreboard(matId, divisionName, eventId, currentBracket, scoreboardType);
        return;
    }

    // Check if this is kata-flags (needs special judge flag interface)
    if (scoreboardType === 'kata-flags') {
        // Use bracket's embedded config as fallback if scoreboardConfig wasn't resolved
        const flagsConfig = scoreboardConfig || currentBracket?.scoreboardConfig || null;
        console.log('Routing to KATA-FLAGS head-to-head operator, config:', flagsConfig);
        openKataFlagsHeadToHeadOperator(matId, divisionName, eventId, currentBracket, flagsConfig);
        return;
    }

    console.log('Routing to KUMITE scoreboard');

    // ── Initialize ruleset state ──
    const { org: kumiteOrg, rules: kumiteRules } = getActiveRuleset();
    operatorCurrentOrg = kumiteOrg;
    const unifiedScoreboardCfg = getUnifiedScoreboardConfig();
    operatorMatchFormat = unifiedScoreboardCfg?.kumite?.matchFormat || kumiteRules?.defaultMatchFormat || null;
    operatorSenshu = null;
    operatorIsOvertime = false;
    operatorOvertimeRemaining = null;
    operatorAtoshiBaraku = false;
    operatorHanteiRound = 0;
    resetScoreBreakdownCounters();
    initPenaltyTracks(kumiteOrg);

    // KUMITE SCOREBOARD (for sparring events)
    // Read match duration: bracket-specific > unified config > scoreboardConfig > default
    if (currentBracket && currentBracket.matchDuration) {
        operatorMatchDuration = parseInt(currentBracket.matchDuration) || kumiteRules.timer.defaultDuration;
    } else {
        const cfgForDuration = getUnifiedScoreboardConfig();
        if (cfgForDuration && cfgForDuration.kumite && cfgForDuration.kumite.matchDuration) {
            operatorMatchDuration = parseInt(cfgForDuration.kumite.matchDuration) || kumiteRules.timer.defaultDuration;
        } else if (scoreboardConfig && scoreboardConfig.settings && scoreboardConfig.settings.matchDuration) {
            operatorMatchDuration = parseInt(scoreboardConfig.settings.matchDuration) || kumiteRules.timer.defaultDuration;
        } else {
            operatorMatchDuration = kumiteRules.timer.defaultDuration;
        }
    }

    // Reset scores
    operatorRedScore = 0;
    operatorBlueScore = 0;
    operatorRedPenalties = 0;
    operatorBluePenalties = 0;
    operatorRedPenaltyList = [];
    operatorBluePenaltyList = [];
    operatorTimeRemaining = operatorMatchDuration;
    operatorRedCompetitor = null;
    operatorBlueCompetitor = null;

    // Get competitors in this division
    const allDivisions = JSON.parse(localStorage.getItem(_scopedKey('divisions')) || '{}');
    const eventData = allDivisions[eventId];
    const divisionCompetitors = eventData?.generated?.[divisionName] || [];

    let currentMatch = null;

    // Check if we should force-load a specific match (from bracket viewer "Score Match" button)
    if (window.forceLoadMatchId && currentBracket) {
        console.log('Force loading match ID:', window.forceLoadMatchId);
        // Find the specific match by ID
        if (currentBracket.type === 'single-elimination' || currentBracket.type === 'round-robin' || currentBracket.type === 'repechage') {
            currentMatch = currentBracket.matches?.find(m => m.id === window.forceLoadMatchId);
            if (!currentMatch) currentMatch = currentBracket.repechageA?.find(m => m.id === window.forceLoadMatchId);
            if (!currentMatch) currentMatch = currentBracket.repechageB?.find(m => m.id === window.forceLoadMatchId);
        } else if (currentBracket.type === 'double-elimination') {
            currentMatch = currentBracket.winners?.find(m => m.id === window.forceLoadMatchId) ||
                          currentBracket.losers?.find(m => m.id === window.forceLoadMatchId);
            if (!currentMatch && currentBracket.finals?.id === window.forceLoadMatchId) currentMatch = currentBracket.finals;
            if (!currentMatch && currentBracket.reset?.id === window.forceLoadMatchId) currentMatch = currentBracket.reset;
        } else if (currentBracket.type === 'pool-play') {
            for (const pool of currentBracket.pools || []) {
                currentMatch = pool.matches?.find(m => m.id === window.forceLoadMatchId);
                if (currentMatch) break;
            }
        }

        // Guard: prevent replaying a completed match
        if (currentMatch && currentMatch.status === 'completed') {
            console.warn('[FORCE-LOAD] Match already completed, cannot replay:', window.forceLoadMatchId);
            showMessage('This match has already been completed.', 'warning');
            currentMatch = null; // Don't load it — fall through to normal match-finding
        }

        // Update match status to in-progress when loading from bracket viewer
        if (currentMatch && currentMatch.status === 'pending') {
            currentMatch.status = 'in-progress';
            brackets[window.currentBracketId] = currentBracket;
            saveBrackets(brackets);
        }
    }

    // If no forced match, find first pending match for kumite brackets
    if (!currentMatch && currentBracket) {
        console.log('Searching for pending matches...');
        console.log('Bracket type:', currentBracket.type);
        console.log('Total matches in bracket:', currentBracket.matches?.length);

        // Find first pending match
        if (currentBracket.type === 'single-elimination' || currentBracket.type === 'round-robin' || currentBracket.type === 'repechage') {
            // Log all matches for debugging
            currentBracket.matches?.forEach((m, idx) => {
                console.log(`Match ${idx}:`, {
                    id: m.id,
                    status: m.status,
                    hasRed: !!m.redCorner,
                    hasBlue: !!m.blueCorner,
                    redName: m.redCorner ? `${m.redCorner.firstName} ${m.redCorner.lastName}` : 'none',
                    blueName: m.blueCorner ? `${m.blueCorner.firstName} ${m.blueCorner.lastName}` : 'none'
                });
            });

            // Find first match that's pending or in-progress with both competitors
            currentMatch = currentBracket.matches?.find(m =>
                (m.status === 'pending' || m.status === 'in-progress') && m.redCorner && m.blueCorner
            );
            // Also search repechage brackets if no main bracket match found
            if (!currentMatch && currentBracket.type === 'repechage') {
                currentMatch = currentBracket.repechageA?.find(m =>
                    (m.status === 'pending' || m.status === 'in-progress') && m.redCorner && m.blueCorner
                );
                if (!currentMatch) {
                    currentMatch = currentBracket.repechageB?.find(m =>
                        (m.status === 'pending' || m.status === 'in-progress') && m.redCorner && m.blueCorner
                    );
                }
            }
            console.log('Found match with both competitors:', currentMatch);
        } else if (currentBracket.type === 'double-elimination') {
            // Check winners bracket first, then losers, then finals, then reset
            currentMatch = currentBracket.winners?.find(m =>
                (m.status === 'pending' || m.status === 'in-progress') && m.redCorner && m.blueCorner
            );
            if (!currentMatch) {
                currentMatch = currentBracket.losers?.find(m =>
                    (m.status === 'pending' || m.status === 'in-progress') && m.redCorner && m.blueCorner
                );
            }
            if (!currentMatch && currentBracket.finals &&
                (currentBracket.finals.status === 'pending' || currentBracket.finals.status === 'in-progress') &&
                currentBracket.finals.redCorner && currentBracket.finals.blueCorner) {
                currentMatch = currentBracket.finals;
            }
            if (!currentMatch && currentBracket.reset &&
                (currentBracket.reset.status === 'pending' || currentBracket.reset.status === 'in-progress') &&
                currentBracket.reset.redCorner && currentBracket.reset.blueCorner) {
                currentMatch = currentBracket.reset;
            }
        }
    }

    // Auto-load competitors from bracket match (rehydrate photos stripped by slimCompetitor)
    if (currentMatch) {
        console.log('Found current match:', currentMatch);
        operatorRedCompetitor = rehydrateCompetitor(currentMatch.redCorner);
        operatorBlueCompetitor = rehydrateCompetitor(currentMatch.blueCorner);
        console.log('Loaded competitors:', { red: operatorRedCompetitor, blue: operatorBlueCompetitor });

        // Store current match ID for later use when declaring winner
        window.currentMatchId = currentMatch.id;
        window.currentBracketId = Object.keys(brackets).find(id => brackets[id] === currentBracket);
    } else {
        console.warn('No current match found!');
        console.warn('Bracket:', currentBracket);
        console.warn('Force load match ID:', window.forceLoadMatchId);
    }

    // Get mat name and scoreboard settings
    const mats = JSON.parse(localStorage.getItem(_scopedKey('mats')) || '[]');
    const mat = mats.find(m => m.id == matId);
    const matName = mat ? mat.name : `Mat ${matId}`;

    // Get corner colors, names, and point values
    // Priority: unified scoreboardConfig > legacy named config > legacy scoreboardSettings
    let corner1Name  = 'RED';
    let corner2Name  = 'BLUE';
    let corner1Color = '#ff453a';
    let corner2Color = '#0a84ff';

    // Point values now come from the ruleset (via getActiveRuleset/KUMITE_RULESETS)
    const ipponValue   = kumiteRules.scoring.values.ippon;
    const wazaAriValue = kumiteRules.scoring.values['waza-ari'];
    const yukoValue    = kumiteRules.scoring.values.yuko;

    if (unifiedScoreboardCfg && unifiedScoreboardCfg.kumite) {
        const uk = unifiedScoreboardCfg.kumite;
        corner1Name  = uk.corner1Name  || 'RED';
        corner2Name  = uk.corner2Name  || 'BLUE';
        corner1Color = uk.corner1Color || '#ff453a';
        corner2Color = uk.corner2Color || '#0a84ff';
        console.log('Using unified scoreboard config kumite settings:', { corner1Name, corner1Color, corner2Name, corner2Color, org: kumiteOrg });
    } else if (scoreboardConfig && scoreboardConfig.settings) {
        corner1Name  = scoreboardConfig.settings.corner1Name  || 'RED';
        corner2Name  = scoreboardConfig.settings.corner2Name  || 'BLUE';
        corner1Color = scoreboardConfig.settings.corner1Color || '#ff453a';
        corner2Color = scoreboardConfig.settings.corner2Color || '#0a84ff';
        console.log('Using legacy named scoreboard config:', { corner1Name, corner1Color, corner2Name, corner2Color });
    } else {
        const settings = JSON.parse(localStorage.getItem(_scopedKey('scoreboardSettings')) || '{}');
        corner1Name  = settings.corner1Name  || 'RED';
        corner2Name  = settings.corner2Name  || 'BLUE';
        corner1Color = settings.corner1Custom || '#ff453a';
        corner2Color = settings.corner2Custom || '#0a84ff';
        console.log('Using legacy scoreboardSettings:', { corner1Name, corner1Color, corner2Name, corner2Color });
    }

    // Show modal
    const modal = document.getElementById('operator-scoreboard-modal');
    const title = document.getElementById('scoreboard-title');
    const content = document.getElementById('operator-scoreboard-content');

    title.textContent = `${matName} - ${divisionName}`;

    // Enable keyboard shortcuts and reset score history
    operatorKeyboardEnabled = true;
    operatorScoreHistory = [];

    // Store point values globally for backward compat
    window.operatorIpponValue = ipponValue;
    window.operatorWazaAriValue = wazaAriValue;
    window.operatorYukoValue = yukoValue;

    // Add keyboard event listener
    document.removeEventListener('keydown', handleOperatorKeyboard);
    document.addEventListener('keydown', handleOperatorKeyboard);

    // Build match info display with swap button
    const swapBtnHTML = `<button id="swap-sides-btn" onclick="toggleOperatorSides()" title="${operatorSidesSwapped ? 'Sides swapped (click to reset)' : 'Swap sides'}" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: 1px solid var(--glass-border); border-radius: 6px; padding: 4px 8px; cursor: pointer; font-size: 14px; color: var(--text-secondary); display: flex; align-items: center; gap: 4px;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='none'">⇄</button>`;
    const divProgressHTML = buildDivisionProgressHTML(matId, divisionName, eventId);
    let matchInfoHTML = '';
    if (currentMatch) {
        matchInfoHTML = `
            <div class="glass-panel" style="text-align: center; flex-shrink: 0; position: relative;">
                <div style="font-size: clamp(12px, 1.3vw, 15px); color: var(--text-secondary);">Round ${currentMatch.round} - Match ${currentMatch.id}</div>
                ${divProgressHTML}
                ${swapBtnHTML}
            </div>
        `;
    } else {
        matchInfoHTML = `
            <div class="glass-panel" style="text-align: center; background: rgba(255, 149, 0, 0.1); border-color: #ff9500; flex-shrink: 0; position: relative;">
                <h4 style="color: #ff9500; margin-bottom: 4px;">⚠️ No Bracket Found</h4>
                <p style="color: var(--text-secondary); font-size: 13px;">Go to Brackets tab to create a bracket first.</p>
                ${divProgressHTML}
                ${swapBtnHTML}
            </div>
        `;
    }

    // Find next match in current bracket and next division in schedule
    let nextMatch = null;
    let nextDivision = null;

    // Check for next match in current bracket
    if (currentBracket && currentMatch) {
        if (currentBracket.type === 'single-elimination' || currentBracket.type === 'round-robin') {
            const currentIndex = currentBracket.matches?.findIndex(m => m.id === currentMatch.id);
            if (currentIndex !== -1) {
                nextMatch = currentBracket.matches?.slice(currentIndex + 1).find(m =>
                    (m.status === 'pending' || m.status === 'in-progress') && m.redCorner && m.blueCorner
                );
            }
        }
    }

    // Find next division from mat schedule
    const matScheduleData = loadMatScheduleData();
    const schedule = (matScheduleData[matId] || []).sort((a, b) => (a.order || 0) - (b.order || 0));
    const currentDivIndex = schedule.findIndex(s => s.division === divisionName && s.eventId == eventId);
    if (currentDivIndex !== -1 && currentDivIndex < schedule.length - 1) {
        nextDivision = schedule[currentDivIndex + 1];
    }

    // Build next match/division preview HTML
    let nextMatchHTML = '';

    // Show next match in current bracket if exists
    if (nextMatch) {
        const nextRedName = nextMatch.redCorner ? `${nextMatch.redCorner.firstName} ${nextMatch.redCorner.lastName}` : 'TBD';
        const nextBlueName = nextMatch.blueCorner ? `${nextMatch.blueCorner.firstName} ${nextMatch.blueCorner.lastName}` : 'TBD';

        nextMatchHTML += `
            <div class="glass-panel" style="background: rgba(220, 38, 38, 0.1); border-color: rgba(220, 38, 38, 0.3); flex-shrink: 0;">
                <div style="display: flex; align-items: center; justify-content: center; gap: clamp(8px, 1vw, 16px); font-size: clamp(11px, 1.2vw, 14px);">
                    <span style="color: #dc2626; font-weight: 600; font-size: 11px;">NEXT:</span>
                    <span style="font-weight: 600; color: ${corner1Color};">${nextRedName}</span>
                    <span style="color: var(--text-secondary);">vs</span>
                    <span style="font-weight: 600; color: ${corner2Color};">${nextBlueName}</span>
                </div>
            </div>
        `;
    }

    // Show next division from schedule
    if (nextDivision) {
        const eventTypes = JSON.parse(localStorage.getItem(_scopedKey('eventTypes')) || '[]');
        const nextEvent = eventTypes.find(e => e.id == nextDivision.eventId);
        const eventName = nextEvent?.name || 'Unknown Event';

        nextMatchHTML += `
            <div class="glass-panel" style="background: rgba(255, 149, 0, 0.1); border-color: rgba(255, 149, 0, 0.3); flex-shrink: 0;">
                <div style="text-align: center; font-size: clamp(11px, 1.2vw, 13px);">
                    <span style="color: #ff9500; font-weight: 600;">UP NEXT:</span> ${nextDivision.division} <span style="color: var(--text-secondary);">(${eventName})</span>
                </div>
            </div>
        `;
    }

    // Compute text colors for opaque corner backgrounds
    const corner1TextColor = getCornerTextColor(corner1Color);
    const corner2TextColor = getCornerTextColor(corner2Color);

    // Build scoreboard HTML with responsive design (no scrollbars)
    content.innerHTML = `
        <div class="operator-scoreboard">
            ${matchInfoHTML}

            <div class="scoreboard-display" style="display: grid; grid-template-columns: 1fr auto 1fr; gap: clamp(6px, 1vw, 16px); margin-bottom: clamp(4px, 0.6vh, 12px); flex: 1; min-height: 0;">
                <!-- Corner 1 Side (AKA/Red — default RIGHT) -->
                <div class="glass-panel" style="background: ${corner1Color}; border-color: ${corner1Color}; overflow-y: auto; order: ${operatorSidesSwapped ? 1 : 3};">
                    <div style="text-align: center;">
                        <div style="font-size: clamp(13px, 1.5vw, 18px); font-weight: 600; color: ${corner1TextColor}; margin-bottom: clamp(2px, 0.3vh, 6px);">${corner1Name}</div>
                        ${kumiteOrg === 'wkf' ? `<div id="senshu-badge-red" style="display: none; background: #30d158; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-bottom: 4px;">SENSHU</div>` : ''}
                        ${kumiteOrg === 'aau' && operatorMatchFormat ? `<div style="background: #5856d6; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; margin-bottom: 4px; display: inline-block;">${(KUMITE_RULESETS.aau.matchFormats[operatorMatchFormat]?.name || '').toUpperCase()}</div>` : ''}
                        ${operatorRedCompetitor && operatorRedCompetitor.photo ? `
                            <div style="margin-bottom: clamp(2px, 0.4vh, 8px);">
                                <img src="${operatorRedCompetitor.photo}" alt="${operatorRedCompetitor.firstName} ${operatorRedCompetitor.lastName}"
                                     style="width: clamp(40px, 6vh, 80px); height: clamp(40px, 6vh, 80px); border-radius: 50%; object-fit: cover; border: 3px solid ${corner1Color}; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                            </div>
                        ` : ''}
                        <div id="operator-red-name" style="font-size: clamp(14px, 2vw, 22px); font-weight: 700; color: ${corner1TextColor}; margin-bottom: clamp(2px, 0.3vh, 8px); word-wrap: break-word;">${operatorRedCompetitor ? `${operatorRedCompetitor.firstName} ${operatorRedCompetitor.lastName}`.toUpperCase() : 'NO COMPETITOR'}</div>
                        ${operatorRedCompetitor ? `
                            <div style="font-size: clamp(10px, 1.1vw, 13px); color: ${corner1TextColor}; opacity: 0.8; margin-bottom: clamp(4px, 0.5vh, 10px);">
                                ${getDisplayAge(operatorRedCompetitor)} yrs | ${operatorRedCompetitor.weight || 'N/A'}kg | ${operatorRedCompetitor.rank || 'N/A'}
                                <div style="display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: 2px;">
                                    ${operatorRedCompetitor.clubLogo ? `<img src="${operatorRedCompetitor.clubLogo}" alt="" style="width: 16px; height: 16px; object-fit: contain; border-radius: 3px;">` : ''}
                                    <span>${operatorRedCompetitor.club || 'No Dojo'}</span>
                                </div>
                            </div>
                        ` : ''}
                        <div id="operator-red-score" style="font-size: clamp(36px, 5vh, 72px); font-weight: 700; color: ${corner1TextColor}; margin: clamp(4px, 0.5vh, 10px) 0;">${kumiteRules.scoring.isDecimal ? '0.0' : '0'}</div>
                        <div id="operator-red-score-breakdown" style="font-size: 10px; color: ${corner1TextColor}; opacity: 0.7; margin-bottom: 4px;"></div>
                        ${generateScoringButtons('red', kumiteOrg, kumiteRules, corner1TextColor)}
                        ${generatePenaltyButtons('red', kumiteOrg, kumiteRules, corner1TextColor)}
                    </div>
                </div>

                <!-- Timer & Controls -->
                <div class="glass-panel" style="min-width: clamp(110px, 12vw, 180px); display: flex; flex-direction: column; justify-content: center; order: 2;">
                    <div style="text-align: center;">
                        <div style="font-size: clamp(11px, 1.2vw, 14px); color: var(--text-secondary); margin-bottom: clamp(2px, 0.3vh, 6px);">
                            ${operatorIsOvertime ? 'OVERTIME' : 'TIME'}
                        </div>
                        <div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 4px;">${kumiteRules.name}</div>
                        <div id="operator-timer" style="font-size: clamp(28px, 4vw, 48px); font-weight: 700; margin-bottom: clamp(8px, 1vh, 16px);">${Math.floor(operatorMatchDuration / 60)}:${(operatorMatchDuration % 60).toString().padStart(2, '0')}</div>
                        <div style="display: flex; flex-direction: column; gap: clamp(4px, 0.5vh, 6px);">
                            <button class="btn btn-primary" onclick="operatorStartTimer()" style="font-size: clamp(11px, 1.2vw, 13px); padding: clamp(6px, 0.8vh, 10px);">▶ Start</button>
                            <button class="btn btn-secondary" onclick="operatorPauseTimer()" style="font-size: clamp(11px, 1.2vw, 13px); padding: clamp(6px, 0.8vh, 10px);">⏸ Pause</button>
                            <button class="btn btn-secondary" onclick="operatorResetTimer()" style="font-size: clamp(11px, 1.2vw, 13px); padding: clamp(6px, 0.8vh, 10px);">↺ Reset</button>
                        </div>
                    </div>
                </div>

                <!-- Corner 2 Side (AO/Blue — default LEFT) -->
                <div class="glass-panel" style="background: ${corner2Color}; border-color: ${corner2Color}; overflow-y: auto; order: ${operatorSidesSwapped ? 3 : 1};">
                    <div style="text-align: center;">
                        <div style="font-size: clamp(13px, 1.5vw, 18px); font-weight: 600; color: ${corner2TextColor}; margin-bottom: clamp(2px, 0.3vh, 6px);">${corner2Name}</div>
                        ${kumiteOrg === 'wkf' ? `<div id="senshu-badge-blue" style="display: none; background: #30d158; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-bottom: 4px;">SENSHU</div>` : ''}
                        ${operatorBlueCompetitor && operatorBlueCompetitor.photo ? `
                            <div style="margin-bottom: clamp(2px, 0.4vh, 8px);">
                                <img src="${operatorBlueCompetitor.photo}" alt="${operatorBlueCompetitor.firstName} ${operatorBlueCompetitor.lastName}"
                                     style="width: clamp(40px, 6vh, 80px); height: clamp(40px, 6vh, 80px); border-radius: 50%; object-fit: cover; border: 3px solid ${corner2Color}; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                            </div>
                        ` : ''}
                        <div id="operator-blue-name" style="font-size: clamp(14px, 2vw, 22px); font-weight: 700; color: ${corner2TextColor}; margin-bottom: clamp(2px, 0.3vh, 8px); word-wrap: break-word;">${operatorBlueCompetitor ? `${operatorBlueCompetitor.firstName} ${operatorBlueCompetitor.lastName}`.toUpperCase() : 'NO COMPETITOR'}</div>
                        ${operatorBlueCompetitor ? `
                            <div style="font-size: clamp(10px, 1.1vw, 13px); color: ${corner2TextColor}; opacity: 0.8; margin-bottom: clamp(4px, 0.5vh, 10px);">
                                ${getDisplayAge(operatorBlueCompetitor)} yrs | ${operatorBlueCompetitor.weight || 'N/A'}kg | ${operatorBlueCompetitor.rank || 'N/A'}
                                <div style="display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: 2px;">
                                    ${operatorBlueCompetitor.clubLogo ? `<img src="${operatorBlueCompetitor.clubLogo}" alt="" style="width: 16px; height: 16px; object-fit: contain; border-radius: 3px;">` : ''}
                                    <span>${operatorBlueCompetitor.club || 'No Dojo'}</span>
                                </div>
                            </div>
                        ` : ''}
                        <div id="operator-blue-score" style="font-size: clamp(36px, 5vh, 72px); font-weight: 700; color: ${corner2TextColor}; margin: clamp(4px, 0.5vh, 10px) 0;">${kumiteRules.scoring.isDecimal ? '0.0' : '0'}</div>
                        <div id="operator-blue-score-breakdown" style="font-size: 10px; color: ${corner2TextColor}; opacity: 0.7; margin-bottom: 4px;"></div>
                        ${generateScoringButtons('blue', kumiteOrg, kumiteRules, corner2TextColor)}
                        ${generatePenaltyButtons('blue', kumiteOrg, kumiteRules, corner2TextColor)}
                    </div>
                </div>
            </div>

            <div class="glass-panel" style="text-align: center; flex-shrink: 0;">
                <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
                    <button class="btn btn-primary" onclick="operatorDeclareWinner('red')" style="background: ${corner1Color}; color: ${corner1TextColor}; border: 1px solid ${corner1TextColor}33; font-size: clamp(11px, 1.2vw, 14px); padding: clamp(6px, 0.8vh, 10px) 12px; order: ${operatorSidesSwapped ? 1 : 3};">${corner1Name} Wins</button>
                    <button class="btn btn-primary" onclick="operatorDeclareWinner('blue')" style="background: ${corner2Color}; color: ${corner2TextColor}; border: 1px solid ${corner2TextColor}33; font-size: clamp(11px, 1.2vw, 14px); padding: clamp(6px, 0.8vh, 10px) 12px; order: ${operatorSidesSwapped ? 3 : 1};">${corner2Name} Wins</button>
                    <button class="btn btn-secondary" onclick="operatorResetMatch()" style="font-size: clamp(11px, 1.2vw, 14px); padding: clamp(6px, 0.8vh, 10px) 12px; order: 2;">Reset</button>
                </div>
                <div style="display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; margin-top: 8px; border-top: 1px solid var(--glass-border); padding-top: 8px;">
                    <button class="btn btn-secondary" onclick="operatorMarkAbsent('red')" style="font-size: 11px; padding: 4px 10px; color: #ff453a; border-color: #ff453a44; order: ${operatorSidesSwapped ? 1 : 3};">${corner1Name} Absent</button>
                    <button class="btn btn-secondary" onclick="operatorMarkAbsent('blue')" style="font-size: 11px; padding: 4px 10px; color: #ff453a; border-color: #ff453a44; order: ${operatorSidesSwapped ? 3 : 1};">${corner2Name} Absent</button>
                </div>
            </div>

            ${nextMatchHTML}
        </div>
    `;

    console.log('Opening modal...');
    console.log('Modal element:', modal);
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    console.log('Modal opened! Classes:', modal.className);

    // Show/hide Edit Results button based on whether there are completed matches
    updateEditResultsButtonVisibility(currentBracket);

    // Set this as the active scoreboard type
    activeScoreboardType = 'kumite';
    console.log('Active scoreboard type set to: kumite');

    // Push initial state to audience display (triggers type redirect if needed)
    updateOperatorTVDisplay();
}

// Global variables for kata-flags operator
let kataFlagsJudgeVotes = [];
let kataFlagsCurrentMatch = null;
let kataFlagsScoreboardConfig = null;
let kataFlagsMatId = null;
let kataFlagsMatName = null;
let kataFlagsDivisionName = null;
let kataFlagsEventId = null;

function openKataFlagsHeadToHeadOperator(matId, divisionName, eventId, bracket, scoreboardConfig) {
    console.log('=== OPEN KATA-FLAGS HEAD-TO-HEAD OPERATOR ===');
    console.log('Scoreboard Config:', scoreboardConfig);

    // Set this as the active scoreboard type FIRST to prevent kumite from writing
    activeScoreboardType = 'kata-flags';
    console.log('Active scoreboard type set to: kata-flags');

    // Stop any running kumite timers to prevent them from overwriting our state
    if (operatorTimerInterval) {
        clearInterval(operatorTimerInterval);
        operatorTimerInterval = null;
    }

    // Clear any kumite operator state that might be writing to localStorage
    operatorRedCompetitor = null;
    operatorBlueCompetitor = null;
    operatorRedScore = 0;
    operatorBlueScore = 0;
    operatorRedPenalties = 0;
    operatorBluePenalties = 0;
    // Keep currentOperatorMat set (from parent openOperatorScoreboard) so TV display
    // routing works. Kumite interference is already prevented by activeScoreboardType checks.

    // Get mat name early so we can store it globally
    const mats = JSON.parse(localStorage.getItem(_scopedKey('mats')) || '[]');
    const mat = mats.find(m => m.id == matId);
    const matName = mat ? mat.name : `Mat ${matId}`;

    // Store parameters globally
    kataFlagsScoreboardConfig = scoreboardConfig;
    kataFlagsMatId = matId;
    kataFlagsMatName = matName;
    kataFlagsDivisionName = divisionName;
    kataFlagsEventId = eventId;

    // Get number of judges from scoreboard config
    const numJudges = scoreboardConfig?.settings?.judges || 5;

    // Initialize judge votes
    kataFlagsJudgeVotes = Array(numJudges).fill(null); // null, 'corner1', or 'corner2'

    // Find first pending match — check all match arrays (matches, winners, losers, repechage, finals, reset)
    let currentMatch = null;
    if (bracket) {
        const allMatches = [
            ...(bracket.matches || []),
            ...(bracket.winners || []),
            ...(bracket.losers || []),
            ...(bracket.repechageA || []),
            ...(bracket.repechageB || [])
        ];
        if (bracket.finals) allMatches.push(bracket.finals);
        if (bracket.reset) allMatches.push(bracket.reset);

        // Find next pending match — prefer a specific match if the bracket clicked a button
        if (window.forceLoadMatchId) {
            currentMatch = allMatches.find(m => m.id === window.forceLoadMatchId);
            delete window.forceLoadMatchId;
        }
        if (!currentMatch) {
            currentMatch = allMatches.find(m => m.status === 'pending' && m.redCorner && m.blueCorner);
        }

        // Diagnostic: log all pending matches to help debug stuck brackets
        const pendingMatches = allMatches.filter(m => m.status === 'pending');
        console.log('Kata-flags match search:', {
            totalMatches: allMatches.length,
            pendingCount: pendingMatches.length,
            pendingWithBothCorners: pendingMatches.filter(m => m.redCorner && m.blueCorner).length,
            pendingMissing: pendingMatches.filter(m => !m.redCorner || !m.blueCorner).map(m => ({
                round: m.round, position: m.position,
                hasRed: !!m.redCorner, hasBlue: !!m.blueCorner
            })),
            foundMatch: currentMatch ? { id: currentMatch.id, round: currentMatch.round, position: currentMatch.position } : null
        });
    }
    // Rehydrate photos stripped by slimCompetitor before using for display
    if (currentMatch) {
        currentMatch = {
            ...currentMatch,
            redCorner:  rehydrateCompetitor(currentMatch.redCorner),
            blueCorner: rehydrateCompetitor(currentMatch.blueCorner),
        };
    }
    kataFlagsCurrentMatch = currentMatch;

    if (!currentMatch) {
        // No pending matches — open the modal anyway so user can see status / edit results
        const modal = document.getElementById('operator-scoreboard-modal');
        const title = document.getElementById('scoreboard-title');
        const content = document.getElementById('operator-scoreboard-content');

        title.textContent = `${matName} - ${divisionName} (Kata Flags)`;
        modal.classList.remove('hidden');
        modal.style.display = 'flex';

        const divComplete = checkBracketComplete(kataFlagsDivisionName, kataFlagsEventId);
        if (divComplete) {
            const results = getDivisionResults(kataFlagsDivisionName, kataFlagsEventId);
            showDivisionCompleteCountdown(kataFlagsMatId, kataFlagsDivisionName, kataFlagsEventId, results);
        } else {
            // Division not complete but no matches ready (waiting for opponents from other rounds)
            // Include all match pools for accurate counting
            const allMatches = [
                ...(bracket?.matches || []),
                ...(bracket?.winners || []),
                ...(bracket?.losers || []),
                ...(bracket?.repechageA || []),
                ...(bracket?.repechageB || [])
            ];
            if (bracket?.finals) allMatches.push(bracket.finals);
            if (bracket?.reset) allMatches.push(bracket.reset);

            const completedMatches = allMatches.filter(m => m.status === 'completed');
            const pendingEmpty = allMatches.filter(m => m.status === 'pending' && (!m.redCorner || !m.blueCorner));

            let matchListHTML = '';
            if (completedMatches.length > 0) {
                matchListHTML = completedMatches.map(m => `
                    <div style="display: flex; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--glass-border);">
                        <div style="flex: 1;">
                            <span style="font-weight: 600;">${m.redCorner?.firstName || '?'} ${m.redCorner?.lastName || ''}</span>
                            <span style="color: var(--text-secondary); margin: 0 6px;">vs</span>
                            <span style="font-weight: 600;">${m.blueCorner?.firstName || '?'} ${m.blueCorner?.lastName || ''}</span>
                        </div>
                        <div style="font-size: 12px; color: #22c55e;">
                            Winner: ${m.winner?.firstName || '?'} ${m.winner?.lastName || ''}
                        </div>
                    </div>
                `).join('');
            }

            // Auto-retry after 1 second — bracket data may have just been saved
            if (!window._kataFlagsRetried) {
                window._kataFlagsRetried = true;
                setTimeout(() => {
                    window._kataFlagsRetried = false;
                    openOperatorScoreboard(kataFlagsMatId, kataFlagsDivisionName, kataFlagsEventId);
                }, 1000);
            } else {
                window._kataFlagsRetried = false;
            }

            const matchProgressHTML = buildMatchProgressHTML(bracket);

            content.innerHTML = `
                <div style="max-height: 75vh; overflow-y: auto;">
                    <div class="glass-panel" style="text-align: center; padding: 20px; margin-bottom: 16px;">
                        <div style="font-size: 20px; margin-bottom: 8px;">⏳</div>
                        <h3 style="margin-bottom: 8px;">Waiting for Next Round</h3>
                        <p style="color: var(--text-secondary); font-size: 14px;">
                            ${pendingEmpty.length > 0
                                ? `${pendingEmpty.length} match${pendingEmpty.length > 1 ? 'es' : ''} waiting for opponents to advance.`
                                : 'No pending matches found for this division.'}
                        </p>
                        ${matchProgressHTML}
                    </div>
                    ${completedMatches.length > 0 ? `
                        <div class="glass-panel" style="padding: 16px; margin-bottom: 16px;">
                            <h4 style="margin-bottom: 12px;">Completed Matches</h4>
                            ${matchListHTML}
                        </div>
                    ` : ''}
                    <div style="text-align: center; display: flex; gap: 8px; justify-content: center;">
                        <button class="btn btn-primary" onclick="window._kataFlagsRetried=false; openOperatorScoreboard(kataFlagsMatId, kataFlagsDivisionName, kataFlagsEventId);" style="font-size: 14px;">
                            🔄 Retry
                        </button>
                        <button class="btn btn-secondary" onclick="closeOperatorScoreboard()" style="font-size: 14px;">
                            Close
                        </button>
                    </div>
                </div>
            `;
        }
        return;
    }

    // Store for later use - find bracket ID by matching bracket properties
    window.currentMatchId = currentMatch.id;
    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
    window.currentBracketId = Object.keys(brackets).find(id => {
        const b = brackets[id];
        return (b.division === bracket.division || b.divisionName === bracket.division) && b.eventId == bracket.eventId;
    });

    console.log('Stored bracket ID:', window.currentBracketId);

    // Get corner settings
    const corner1Name = scoreboardConfig?.settings?.corner1Name || 'Red';
    const corner2Name = scoreboardConfig?.settings?.corner2Name || 'Blue';
    const corner1Color = scoreboardConfig?.settings?.corner1Color || '#ff3b30';
    const corner2Color = scoreboardConfig?.settings?.corner2Color || '#0a84ff';

    const competitor1 = currentMatch.redCorner;
    const competitor2 = currentMatch.blueCorner;

    // Show modal
    const modal = document.getElementById('operator-scoreboard-modal');
    const title = document.getElementById('scoreboard-title');
    const content = document.getElementById('operator-scoreboard-content');

    title.textContent = `${matName} - ${divisionName} (Kata Flags)`;

    // Compute text colors for opaque corner backgrounds
    const corner1TextColor = getCornerTextColor(corner1Color);
    const corner2TextColor = getCornerTextColor(corner2Color);

    const kfDivProgressHTML = buildDivisionProgressHTML(matId, divisionName, eventId);
    const kfMatchProgressHTML = buildMatchProgressHTML(bracket);
    content.innerHTML = `
        <div class="operator-scoreboard">
            <div class="glass-panel" style="text-align: center; flex-shrink: 0; position: relative;">
                <div style="font-size: clamp(12px, 1.3vw, 15px); color: var(--text-secondary);">Round ${currentMatch.round} <span style="font-size: 11px; margin-left: 8px;">Judges vote with flags</span></div>
                ${kfDivProgressHTML}
                ${kfMatchProgressHTML}
                <button id="swap-sides-btn" onclick="toggleOperatorSides()" title="${operatorSidesSwapped ? 'Sides swapped (click to reset)' : 'Swap sides'}" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: 1px solid var(--glass-border); border-radius: 6px; padding: 4px 8px; cursor: pointer; font-size: 14px; color: var(--text-secondary); display: flex; align-items: center; gap: 4px;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='none'">⇄</button>
            </div>

            <!-- Competitors Display -->
            <div class="kata-flags-competitors" style="display: grid; grid-template-columns: 1fr 1fr; gap: clamp(8px, 1vw, 16px); margin-bottom: clamp(4px, 0.6vh, 12px); flex-shrink: 0;">
                <!-- Corner 1 (AKA/Red — default RIGHT) -->
                <div class="glass-panel" style="background: ${corner1Color}; border-color: ${corner1Color}; text-align: center; order: ${operatorSidesSwapped ? 1 : 2};">
                    <div style="font-size: clamp(13px, 1.5vw, 16px); font-weight: 600; color: ${corner1TextColor}; margin-bottom: clamp(2px, 0.3vh, 6px);">${corner1Name}</div>
                    ${competitor1.photo ? `
                        <div style="margin-bottom: clamp(2px, 0.4vh, 8px);">
                            <img src="${competitor1.photo}" alt="${competitor1.firstName} ${competitor1.lastName}"
                                 style="width: clamp(40px, 6vh, 70px); height: clamp(40px, 6vh, 70px); border-radius: 50%; object-fit: cover; border: 3px solid ${corner1Color};">
                        </div>
                    ` : ''}
                    <div style="font-size: clamp(16px, 2vw, 22px); font-weight: 700; color: ${corner1TextColor}; margin-bottom: clamp(2px, 0.3vh, 6px);">${competitor1.firstName} ${competitor1.lastName}</div>
                    <div style="font-size: clamp(10px, 1.1vw, 12px); color: ${corner1TextColor}; opacity: 0.8;">
                        ${getDisplayAge(competitor1)} yrs | ${competitor1.rank || 'N/A'} | ${competitor1.club || 'No Dojo'}
                    </div>
                    <div id="corner1-flag-count" style="font-size: clamp(32px, 4vh, 48px); font-weight: 700; color: ${corner1TextColor}; margin-top: clamp(4px, 0.6vh, 12px);">0</div>
                    <div style="font-size: 11px; color: ${corner1TextColor}; opacity: 0.7;">Flags</div>
                </div>

                <!-- Corner 2 (AO/Blue — default LEFT) -->
                <div class="glass-panel" style="background: ${corner2Color}; border-color: ${corner2Color}; text-align: center; order: ${operatorSidesSwapped ? 2 : 1};">
                    <div style="font-size: clamp(13px, 1.5vw, 16px); font-weight: 600; color: ${corner2TextColor}; margin-bottom: clamp(2px, 0.3vh, 6px);">${corner2Name}</div>
                    ${competitor2.photo ? `
                        <div style="margin-bottom: clamp(2px, 0.4vh, 8px);">
                            <img src="${competitor2.photo}" alt="${competitor2.firstName} ${competitor2.lastName}"
                                 style="width: clamp(40px, 6vh, 70px); height: clamp(40px, 6vh, 70px); border-radius: 50%; object-fit: cover; border: 3px solid ${corner2Color};">
                        </div>
                    ` : ''}
                    <div style="font-size: clamp(16px, 2vw, 22px); font-weight: 700; color: ${corner2TextColor}; margin-bottom: clamp(2px, 0.3vh, 6px);">${competitor2.firstName} ${competitor2.lastName}</div>
                    <div style="font-size: clamp(10px, 1.1vw, 12px); color: ${corner2TextColor}; opacity: 0.8;">
                        ${getDisplayAge(competitor2)} yrs | ${competitor2.rank || 'N/A'} | ${competitor2.club || 'No Dojo'}
                    </div>
                    <div id="corner2-flag-count" style="font-size: clamp(32px, 4vh, 48px); font-weight: 700; color: ${corner2TextColor}; margin-top: clamp(4px, 0.6vh, 12px);">0</div>
                    <div style="font-size: 11px; color: ${corner2TextColor}; opacity: 0.7;">Flags</div>
                </div>
            </div>

            <!-- Judge Panel -->
            <div class="glass-panel" style="flex: 1; min-height: 0; overflow-y: auto;">
                <div style="font-weight: 600; text-align: center; margin-bottom: clamp(6px, 1vh, 16px); font-size: clamp(13px, 1.5vw, 16px);">Judge Panel (${numJudges} Judges)</div>
                <div id="judge-panel" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: clamp(6px, 0.8vh, 12px);">
                    ${Array.from({ length: numJudges }, (_, i) => `
                        <div class="glass-panel" style="text-align: center; background: var(--bg-secondary);">
                            <div style="font-weight: 600; margin-bottom: clamp(4px, 0.5vh, 8px); font-size: 13px;">Judge ${i + 1}</div>
                            <div id="judge-${i}-vote" style="font-size: 12px; color: var(--text-secondary); margin-bottom: clamp(4px, 0.5vh, 8px); min-height: 16px;">No vote</div>
                            <div style="display: flex; gap: 6px; justify-content: center;">
                                <button class="btn btn-small kata-flags-vote" data-judge="${i}" data-corner="corner1" style="background: ${corner1Color}; flex: 1; font-size: 11px; padding: clamp(4px, 0.5vh, 8px);">
                                    ${corner1Name}
                                </button>
                                <button class="btn btn-small kata-flags-vote" data-judge="${i}" data-corner="corner2" style="background: ${corner2Color}; flex: 1; font-size: 11px; padding: clamp(4px, 0.5vh, 8px);">
                                    ${corner2Name}
                                </button>
                            </div>
                            <button class="btn btn-small btn-secondary kata-flags-vote" data-judge="${i}" data-corner="clear" style="margin-top: 4px; width: 100%; font-size: 10px; padding: 3px;">Clear</button>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Match Control -->
            <div class="glass-panel" style="text-align: center; flex-shrink: 0;">
                <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; align-items: center;">
                    <button class="btn btn-primary kata-flags-declare-winner-btn" style="font-size: clamp(13px, 1.4vw, 16px); padding: clamp(6px, 1vh, 12px) 16px;">
                        Declare Winner
                    </button>
                    <button class="btn btn-secondary kata-flags-reset-votes-btn" style="font-size: 12px; padding: 6px 12px;">
                        Reset Votes
                    </button>
                </div>
                <div style="display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; margin-top: 8px; border-top: 1px solid var(--glass-border); padding-top: 8px;">
                    <button class="btn btn-secondary kata-flags-mark-absent-btn" data-absent-corner="corner1" style="font-size: 11px; padding: 4px 10px; color: #ff453a; border-color: #ff453a44; order: ${operatorSidesSwapped ? 1 : 2};">${corner1Name} Absent</button>
                    <button class="btn btn-secondary kata-flags-mark-absent-btn" data-absent-corner="corner2" style="font-size: 11px; padding: 4px 10px; color: #ff453a; border-color: #ff453a44; order: ${operatorSidesSwapped ? 2 : 1};">${corner2Name} Absent</button>
                </div>
                <div id="kata-flags-result" style="margin-top: 6px; font-size: 13px; color: var(--text-secondary);"></div>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    // Initialize TV display
    updateKataFlagsTVDisplay();

    // CRITICAL: Remove any previous kata-flags click handler to prevent accumulation.
    // Each call to openKataFlagsHeadToHeadOperator adds a new window click listener.
    // Without cleanup, handlers pile up and kataFlagsDeclareWinner() gets called N times
    // (once per accumulated handler), causing winners to be advanced multiple times
    // and overwriting BYE-advanced competitors in later bracket rounds.
    if (window._kataFlagsClickHandler) {
        window.removeEventListener('click', window._kataFlagsClickHandler, true);
        window._kataFlagsClickHandler = null;
    }

    // Add event delegation using window to catch ALL clicks
    const clickHandler = function(e) {
        console.log('Click detected, target classes:', e.target.className);
        console.log('Target element:', e.target);
        console.log('Has kata-flags-open-tv-btn?', e.target.classList?.contains('kata-flags-open-tv-btn'));
        console.log('className includes?', e.target.className?.includes('kata-flags-open-tv-btn'));

        // Handle Open TV Display button - check multiple ways
        const isOpenTvBtn = e.target.classList?.contains('kata-flags-open-tv-btn') ||
                           e.target.className?.includes('kata-flags-open-tv-btn') ||
                           e.target.closest('.kata-flags-open-tv-btn');

        if (isOpenTvBtn) {
            e.preventDefault();
            e.stopPropagation();
            console.log('>>> Open TV button clicked! Calling function...');
            openKataFlagsTVDisplay();
            return;
        }

        // Handle Declare Winner button
        if (e.target.classList?.contains('kata-flags-declare-winner-btn') || e.target.closest('.kata-flags-declare-winner-btn')) {
            e.preventDefault();
            e.stopPropagation();
            console.log('>>> Declare winner clicked');
            kataFlagsDeclareWinner();
            return;
        }

        // Handle Reset Votes button
        if (e.target.classList?.contains('kata-flags-reset-votes-btn') || e.target.closest('.kata-flags-reset-votes-btn')) {
            e.preventDefault();
            e.stopPropagation();
            console.log('>>> Reset votes clicked');
            kataFlagsResetVotes();
            return;
        }

        // Handle Mark Absent button
        const absentBtn = e.target.closest('.kata-flags-mark-absent-btn');
        if (absentBtn) {
            e.preventDefault();
            e.stopPropagation();
            const absentCorner = absentBtn.dataset.absentCorner;
            console.log('>>> Mark absent clicked for', absentCorner);
            kataFlagsMarkAbsent(absentCorner);
            return;
        }

        // Handle judge voting buttons
        const voteBtn = e.target.closest('.kata-flags-vote');
        if (voteBtn) {
            e.preventDefault();
            e.stopPropagation();
            console.log('>>> Judge vote clicked');
            const judgeIndex = parseInt(voteBtn.dataset.judge);
            const corner = voteBtn.dataset.corner;
            kataFlagsVote(judgeIndex, corner === 'clear' ? null : corner);
        }
    };

    // Attach to window and store reference for cleanup
    window.addEventListener('click', clickHandler, true);

    // Store handler on window for reliable cleanup on next call
    window._kataFlagsClickHandler = clickHandler;
}

function openKataFlagsTVDisplay() {
    console.log('openKataFlagsTVDisplay called, kataFlagsMatId:', kataFlagsMatId);
    if (!kataFlagsMatId) {
        console.error('Cannot open TV display - kataFlagsMatId is not set');
        showToast('Error: Mat ID not set. Please close and reopen the operator.', 'error');
        return;
    }
    const windowName = `TVDisplay_Mat${kataFlagsMatId}`;
    console.log('Opening TV display window:', windowName);
    const tidParam = currentTournamentId ? `?tid=${currentTournamentId}` : '';
    const newWindow = window.open(`/kata-flags-scoreboard.html${tidParam}`, windowName, 'width=1920,height=1080,fullscreen=yes');
    if (!newWindow) {
        showToast('Failed to open TV display. Please allow popups for this site.', 'error');
    }
}

// Make it globally accessible for inline onclick
window.openKataFlagsTVDisplay = openKataFlagsTVDisplay;

function kataFlagsVote(judgeIndex, corner) {
    kataFlagsJudgeVotes[judgeIndex] = corner;

    // Track vote timestamps for decision speed analytics
    if (!window._kataFlagsVoteTimestamps) window._kataFlagsVoteTimestamps = {};
    if (corner) {
        window._kataFlagsVoteTimestamps[judgeIndex] = Date.now();
    } else {
        delete window._kataFlagsVoteTimestamps[judgeIndex];
    }

    // Update UI - use the stored scoreboard config
    const voteDisplay = document.getElementById(`judge-${judgeIndex}-vote`);
    const corner1Name = kataFlagsScoreboardConfig?.settings?.corner1Name || 'Red';
    const corner2Name = kataFlagsScoreboardConfig?.settings?.corner2Name || 'Blue';
    const corner1Color = kataFlagsScoreboardConfig?.settings?.corner1Color || '#ff3b30';
    const corner2Color = kataFlagsScoreboardConfig?.settings?.corner2Color || '#0a84ff';

    console.log('Vote registered:', { judgeIndex, corner, corner1Name, corner2Name });

    if (corner === 'corner1') {
        voteDisplay.innerHTML = `<span style="color: ${corner1Color}; font-weight: 700;">✓ ${corner1Name}</span>`;
    } else if (corner === 'corner2') {
        voteDisplay.innerHTML = `<span style="color: ${corner2Color}; font-weight: 700;">✓ ${corner2Name}</span>`;
    } else {
        voteDisplay.innerHTML = 'No vote';
    }

    // Update flag counts
    const corner1Votes = kataFlagsJudgeVotes.filter(v => v === 'corner1').length;
    const corner2Votes = kataFlagsJudgeVotes.filter(v => v === 'corner2').length;

    document.getElementById('corner1-flag-count').textContent = corner1Votes;
    document.getElementById('corner2-flag-count').textContent = corner2Votes;

    // Update TV display
    updateKataFlagsTVDisplay();
}

function updateKataFlagsTVDisplay() {
    console.log('=== UPDATE KATA FLAGS TV DISPLAY ===');
    console.log('kataFlagsCurrentMatch:', kataFlagsCurrentMatch);
    console.log('kataFlagsScoreboardConfig:', kataFlagsScoreboardConfig);

    // Only update if kata-flags is the active scoreboard
    if (activeScoreboardType !== 'kata-flags') {
        console.log('updateKataFlagsTVDisplay: Kata-flags not active, skipping update');
        return;
    }

    if (!kataFlagsCurrentMatch) {
        console.error('Missing current match - cannot update TV display');
        return;
    }

    const corner1Votes = kataFlagsJudgeVotes.filter(v => v === 'corner1').length;
    const corner2Votes = kataFlagsJudgeVotes.filter(v => v === 'corner2').length;

    const competitor1 = kataFlagsCurrentMatch.redCorner;
    const competitor2 = kataFlagsCurrentMatch.blueCorner;

    console.log('Competitor 1:', competitor1);
    console.log('Competitor 2:', competitor2);

    const corner1Name = kataFlagsScoreboardConfig?.settings?.corner1Name || 'Red';
    const corner2Name = kataFlagsScoreboardConfig?.settings?.corner2Name || 'Blue';
    const corner1Color = kataFlagsScoreboardConfig?.settings?.corner1Color || '#ff3b30';
    const corner2Color = kataFlagsScoreboardConfig?.settings?.corner2Color || '#0a84ff';

    console.log('Corner 1 Name:', corner1Name, 'Color:', corner1Color);
    console.log('Corner 2 Name:', corner2Name, 'Color:', corner2Color);

    const state = {
        scoreboardType: 'kata-flags',
        matName: kataFlagsMatName || `Mat ${kataFlagsMatId}`,
        divisionName: kataFlagsDivisionName,
        matchInfo: `Round ${kataFlagsCurrentMatch.round} - Match ${kataFlagsCurrentMatch.id}`,

        // Corner 1
        redName: `${competitor1.firstName} ${competitor1.lastName}`,
        redInfo: `${getDisplayAge(competitor1)} yrs | ${competitor1.rank || 'N/A'}\n${competitor1.club || 'No Dojo'}`,
        redPhoto: competitor1.photo || null,
        redClubLogo: competitor1.clubLogo || null,
        redFlags: corner1Votes,
        redScore: corner1Votes,
        corner1Name: corner1Name,
        corner1Color: corner1Color,

        // Corner 2
        blueName: `${competitor2.firstName} ${competitor2.lastName}`,
        blueInfo: `${getDisplayAge(competitor2)} yrs | ${competitor2.rank || 'N/A'}\n${competitor2.club || 'No Dojo'}`,
        bluePhoto: competitor2.photo || null,
        blueClubLogo: competitor2.clubLogo || null,
        blueFlags: corner2Votes,
        blueScore: corner2Votes,
        corner2Name: corner2Name,
        corner2Color: corner2Color,

        judges: kataFlagsScoreboardConfig?.settings?.judges || 5,
        judgeVotes: [...kataFlagsJudgeVotes]
    };

    console.log('State to save:', state);
    localStorage.setItem(_scopedKey('scoreboard-state'), JSON.stringify(state));
    console.log('State saved to localStorage');
}

function kataFlagsResetVotes() {
    kataFlagsJudgeVotes.fill(null);
    window._kataFlagsVoteTimestamps = {}; // reset vote timestamps for analytics

    // Reset UI
    kataFlagsJudgeVotes.forEach((_, i) => {
        const voteDisplay = document.getElementById(`judge-${i}-vote`);
        if (voteDisplay) voteDisplay.innerHTML = 'No vote';
    });

    document.getElementById('corner1-flag-count').textContent = '0';
    document.getElementById('corner2-flag-count').textContent = '0';
    document.getElementById('kata-flags-result').textContent = '';
}

function kataFlagsDeclareWinner() {
    // Guard against duplicate calls (accumulated event handlers or double-clicks)
    if (window._kataFlagsDeclaring) {
        console.warn('[DECLARE] Ignoring duplicate kataFlagsDeclareWinner call');
        return;
    }
    window._kataFlagsDeclaring = true;

    const corner1Votes = kataFlagsJudgeVotes.filter(v => v === 'corner1').length;
    const corner2Votes = kataFlagsJudgeVotes.filter(v => v === 'corner2').length;
    const totalVotes = corner1Votes + corner2Votes;

    if (totalVotes === 0) {
        window._kataFlagsDeclaring = false;
        showToast('No votes recorded! Judges must vote before declaring a winner.', 'error');
        return;
    }

    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
    const bracket = brackets[window.currentBracketId];

    if (!bracket) {
        window._kataFlagsDeclaring = false;
        showToast('Error: Bracket not found. Please reload the operator.', 'error');
        console.error('Bracket ID not found:', window.currentBracketId);
        return;
    }

    // Search all match arrays (matches, winners, losers, finals, reset, repechage) to find the current match
    const allBracketMatches = [
        ...(bracket.matches || []),
        ...(bracket.winners || []),
        ...(bracket.losers || []),
        ...(bracket.repechageA || []),
        ...(bracket.repechageB || [])
    ];
    if (bracket.finals) allBracketMatches.push(bracket.finals);
    if (bracket.reset) allBracketMatches.push(bracket.reset);
    const match = allBracketMatches.find(m => m.id === window.currentMatchId);

    // Guard: if match is already completed, don't re-process (prevents double advancement)
    if (match && (match.status === 'completed')) {
        console.warn('[DECLARE] Match already completed, skipping:', match.id);
        window._kataFlagsDeclaring = false;
        return;
    }

    if (!match) {
        window._kataFlagsDeclaring = false;
        showToast('Error: Match not found in bracket.', 'error');
        console.error('Match ID not found:', window.currentMatchId);
        return;
    }

    let winner;
    const loser_competitor = corner1Votes > corner2Votes ? match.blueCorner : match.redCorner;
    if (corner1Votes > corner2Votes) {
        winner = match.redCorner;
    } else if (corner2Votes > corner1Votes) {
        winner = match.blueCorner;
    } else {
        window._kataFlagsDeclaring = false;
        showToast('Tie! Judges must break the tie.', 'warning');
        return;
    }

    // Update match
    match.winner = winner;
    match.status = 'completed';
    match.corner1Flags = corner1Votes;
    match.corner2Flags = corner2Votes;
    match.winMethod = 'decision';
    match.winNote = `Flag decision (${corner1Votes > corner2Votes ? corner1Votes : corner2Votes}-${corner1Votes > corner2Votes ? corner2Votes : corner1Votes})`;

    // Log win method to score edit log
    logScoreEdit(window.currentBracketId, window.currentMatchId, 'winMethod', null, `decision: Flag decision (${corner1Votes}-${corner2Votes})`);

    // Advance winner to next round
    if (bracket.type === 'single-elimination') {
        const matchPool = bracket.matches || [];
        let advanceMatch = match;
        let advanceWinner = winner;

        console.log(`[ADVANCE] Starting advancement from Round ${match.round} Pos ${match.position}, winner: ${winner.firstName} ${winner.lastName}`);

        while (true) {
            const nextRound = advanceMatch.round + 1;
            const nextPosition = Math.floor(advanceMatch.position / 2);
            const nextMatch = matchPool.find(m => m.round === nextRound && m.position === nextPosition);

            if (!nextMatch) {
                console.log(`[ADVANCE] No next match found for Round ${nextRound} Pos ${nextPosition} — end of bracket`);
                break;
            }

            console.log(`[ADVANCE] Found next match: Round ${nextRound} Pos ${nextPosition} (id: ${nextMatch.id}, status: ${nextMatch.status})`);
            console.log(`[ADVANCE] Before: red=${nextMatch.redCorner?.firstName || 'null'}, blue=${nextMatch.blueCorner?.firstName || 'null'}`);

            // Guard: if this winner is already in the next match, skip (prevents double-advancement)
            const winnerId = advanceWinner.id || `${advanceWinner.firstName}_${advanceWinner.lastName}`;
            const redId = nextMatch.redCorner ? (nextMatch.redCorner.id || `${nextMatch.redCorner.firstName}_${nextMatch.redCorner.lastName}`) : null;
            const blueId = nextMatch.blueCorner ? (nextMatch.blueCorner.id || `${nextMatch.blueCorner.firstName}_${nextMatch.blueCorner.lastName}`) : null;
            if (winnerId === redId || winnerId === blueId) {
                console.log(`[ADVANCE] Winner ${advanceWinner.firstName} already in next match — skipping duplicate advancement`);
                break;
            }

            if (advanceMatch.position % 2 === 0) {
                if (!nextMatch.redCorner) nextMatch.redCorner = advanceWinner;
                else if (!nextMatch.blueCorner) nextMatch.blueCorner = advanceWinner;
                else { console.warn('[ADVANCE] Both corners already filled — cannot place winner'); break; }
            } else {
                if (!nextMatch.blueCorner) nextMatch.blueCorner = advanceWinner;
                else if (!nextMatch.redCorner) nextMatch.redCorner = advanceWinner;
                else { console.warn('[ADVANCE] Both corners already filled — cannot place winner'); break; }
            }

            console.log(`[ADVANCE] After: red=${nextMatch.redCorner?.firstName || 'null'}, blue=${nextMatch.blueCorner?.firstName || 'null'}`);

            // Check for BYE cascade — if the other feeder match is empty/bye, auto-advance
            if (nextMatch.redCorner && !nextMatch.blueCorner) {
                const blueFeeder = matchPool.find(m => m.round === nextMatch.round - 1 && m.position === nextMatch.position * 2 + 1);
                console.log(`[ADVANCE] Blue feeder (R${nextMatch.round - 1} P${nextMatch.position * 2 + 1}): ${blueFeeder ? blueFeeder.status : 'NOT FOUND'}`);
                if (blueFeeder && (blueFeeder.status === 'empty' || blueFeeder.status === 'bye')) {
                    console.log(`[ADVANCE] BYE cascade — advancing ${nextMatch.redCorner.firstName} through Round ${nextRound}`);
                    nextMatch.status = 'bye';
                    nextMatch.winner = nextMatch.redCorner;
                    nextMatch.score1 = 'BYE';
                    advanceMatch = nextMatch;
                    advanceWinner = nextMatch.redCorner;
                    continue;
                }
            } else if (!nextMatch.redCorner && nextMatch.blueCorner) {
                const redFeeder = matchPool.find(m => m.round === nextMatch.round - 1 && m.position === nextMatch.position * 2);
                console.log(`[ADVANCE] Red feeder (R${nextMatch.round - 1} P${nextMatch.position * 2}): ${redFeeder ? redFeeder.status : 'NOT FOUND'}`);
                if (redFeeder && (redFeeder.status === 'empty' || redFeeder.status === 'bye')) {
                    console.log(`[ADVANCE] BYE cascade — advancing ${nextMatch.blueCorner.firstName} through Round ${nextRound}`);
                    nextMatch.status = 'bye';
                    nextMatch.winner = nextMatch.blueCorner;
                    nextMatch.score2 = 'BYE';
                    advanceMatch = nextMatch;
                    advanceWinner = nextMatch.blueCorner;
                    continue;
                }
            }
            console.log(`[ADVANCE] Done — next match Round ${nextRound} Pos ${nextPosition} now has both corners: ${!!nextMatch.redCorner && !!nextMatch.blueCorner}`);
            break;
        }
    } else if (bracket.type === 'double-elimination') {
        handleDoubleElimWinnerDeclaration(bracket, match, winner, loser_competitor);
    } else if (bracket.type === 'repechage') {
        handleRepechageWinnerDeclaration(bracket, match, winner, loser_competitor);
    }

    // Save updated bracket
    saveBrackets(brackets);

    // Save to results/history
    const results = JSON.parse(localStorage.getItem(_scopedKey('results')) || '[]');
    results.push({
        id: generateUniqueId(),
        timestamp: new Date().toISOString(),
        matId: currentOperatorMat,
        division: currentOperatorDivision,
        eventId: currentOperatorEventId,
        winner: winner,
        loser: corner1Votes > corner2Votes ? match.blueCorner : match.redCorner,
        scoreboardType: 'kata-flags',
        corner1Flags: corner1Votes,
        corner2Flags: corner2Votes,
        method: 'Flag Decision',
        winMethod: 'decision',
        winNote: `Flag decision (${corner1Votes > corner2Votes ? corner1Votes : corner2Votes}-${corner1Votes > corner2Votes ? corner2Votes : corner1Votes})`
    });
    localStorage.setItem(_scopedKey('results'), JSON.stringify(results));

    // ── Judge Vote Analytics Logging ──────────────────────────────────────
    // Store each judge's vote for analytics (does NOT block the UI flow)
    try {
        const majorityVote = corner1Votes > corner2Votes ? 'corner1' : 'corner2';
        const voteTimestamps = window._kataFlagsVoteTimestamps || {};
        const tsValues = Object.values(voteTimestamps);
        const firstVoteTs = tsValues.length > 0 ? Math.min(...tsValues) : null;
        const lastVoteTs = tsValues.length > 0 ? Math.max(...tsValues) : null;
        // Approximate decision speed: time spread between first and last judge vote
        const voteDurationSeconds = (firstVoteTs && lastVoteTs && lastVoteTs > firstVoteTs)
            ? Math.round((lastVoteTs - firstVoteTs) / 100) / 10
            : null;

        const judgeVoteLog = JSON.parse(localStorage.getItem(_scopedKey('judgeVoteLog')) || '[]');

        for (let ji = 0; ji < kataFlagsJudgeVotes.length; ji++) {
            const judgeVote = kataFlagsJudgeVotes[ji];
            if (!judgeVote) continue; // skip judges who didn't vote

            // Determine the competitor's dojo for the corner this judge voted for
            let competitorDojo = null;
            if (judgeVote === 'corner1' && kataFlagsCurrentMatch?.redCorner) {
                competitorDojo = kataFlagsCurrentMatch.redCorner.club || null;
            } else if (judgeVote === 'corner2' && kataFlagsCurrentMatch?.blueCorner) {
                competitorDojo = kataFlagsCurrentMatch.blueCorner.club || null;
            }

            judgeVoteLog.push({
                matchId: window.currentMatchId || match.id,
                divisionName: kataFlagsDivisionName || null,
                judgeName: `Judge ${ji + 1}`,
                judgeIndex: ji,
                vote: judgeVote,
                majorityVote: majorityVote,
                votedWithMajority: judgeVote === majorityVote,
                voteDurationSeconds: voteDurationSeconds,
                competitorDojo: competitorDojo,
                timestamp: new Date().toISOString(),
            });
        }

        localStorage.setItem(_scopedKey('judgeVoteLog'), JSON.stringify(judgeVoteLog));
        window._kataFlagsVoteTimestamps = {}; // reset for next match

        // Debounced sync to server
        _debouncedSync('judgeVotes', _syncJudgeVotesToServer, 3000);
    } catch (analyticsErr) {
        console.warn('[Judge Analytics] Failed to log votes:', analyticsErr);
    }
    // ── End Judge Vote Analytics Logging ──────────────────────────────────

    // Show winner message with Next Match / Division Complete button
    const corner1Name = kataFlagsScoreboardConfig?.settings?.corner1Name || 'Red';
    const corner2Name = kataFlagsScoreboardConfig?.settings?.corner2Name || 'Blue';
    const winnerCorner = corner1Votes > corner2Votes ? corner1Name : corner2Name;
    const divisionDone = checkBracketComplete(kataFlagsDivisionName, kataFlagsEventId);

    document.getElementById('kata-flags-result').innerHTML = `
        <div style="background: rgba(34, 197, 94, 0.2); border: 2px solid #22c55e; border-radius: 12px; padding: 20px; margin-top: 20px;">
            <div style="font-size: 24px; font-weight: 700; color: #22c55e; margin-bottom: 12px;">
                🏆 WINNER: ${winner.firstName} ${winner.lastName}
            </div>
            <div style="font-size: 18px; color: var(--text-secondary); margin-bottom: 16px;">
                ${winnerCorner} Corner: ${corner1Votes > corner2Votes ? corner1Votes : corner2Votes} flags vs ${corner1Votes > corner2Votes ? corner2Votes : corner1Votes} flags
            </div>
            <button class="btn btn-primary" onclick="kataFlagsNextMatch()" style="font-size: 16px; padding: 12px 32px;">
                ${divisionDone ? 'View Results →' : 'Next Match →'}
            </button>
        </div>
    `;

    // Update TV display to show winner
    updateKataFlagsTVDisplayWinner(winner, corner1Votes, corner2Votes);

    // Allow future declarations (for the NEXT match, after kataFlagsNextMatch reloads)
    window._kataFlagsDeclaring = false;
}

function updateKataFlagsTVDisplayWinner(winner, corner1Votes, corner2Votes) {
    const corner1Name = kataFlagsScoreboardConfig?.settings?.corner1Name || 'Red';
    const corner2Name = kataFlagsScoreboardConfig?.settings?.corner2Name || 'Blue';
    const corner1Color = kataFlagsScoreboardConfig?.settings?.corner1Color || '#ff3b30';
    const corner2Color = kataFlagsScoreboardConfig?.settings?.corner2Color || '#0a84ff';

    const competitor1 = kataFlagsCurrentMatch.redCorner;
    const competitor2 = kataFlagsCurrentMatch.blueCorner;

    const state = {
        scoreboardType: 'kata-flags',
        matName: kataFlagsMatName || `Mat ${kataFlagsMatId}`,
        divisionName: kataFlagsDivisionName,
        matchInfo: `Round ${kataFlagsCurrentMatch.round} - Match ${kataFlagsCurrentMatch.id}`,

        // Keep current competitors and flag counts
        redName: `${competitor1.firstName} ${competitor1.lastName}`,
        redInfo: `${getDisplayAge(competitor1)} yrs | ${competitor1.rank || 'N/A'}\n${competitor1.club || 'No Dojo'}`,
        redPhoto: competitor1.photo || null,
        redClubLogo: competitor1.clubLogo || null,
        redFlags: corner1Votes,
        redScore: corner1Votes,
        corner1Name: corner1Name,
        corner1Color: corner1Color,

        blueName: `${competitor2.firstName} ${competitor2.lastName}`,
        blueInfo: `${getDisplayAge(competitor2)} yrs | ${competitor2.rank || 'N/A'}\n${competitor2.club || 'No Dojo'}`,
        bluePhoto: competitor2.photo || null,
        blueClubLogo: competitor2.clubLogo || null,
        blueFlags: corner2Votes,
        blueScore: corner2Votes,
        corner2Name: corner2Name,
        corner2Color: corner2Color,

        judges: kataFlagsScoreboardConfig?.settings?.judges || 5,

        // Add winner overlay data (rich object for audience celebration)
        winner: {
            name: `${winner.firstName} ${winner.lastName}`.toUpperCase(),
            photo: winner.photo || null,
            club: winner.club || null,
            clubLogo: winner.clubLogo || null,
            corner: corner1Votes > corner2Votes ? 'red' : 'blue',
        }
    };

    localStorage.setItem(_scopedKey('scoreboard-state'), JSON.stringify(state));
}

function kataFlagsNextMatch() {
    // Check if the division is now complete
    const divisionComplete = checkBracketComplete(kataFlagsDivisionName, kataFlagsEventId);
    console.log(`[NEXT MATCH] Division: ${kataFlagsDivisionName}, complete: ${divisionComplete}`);

    // Debug: dump the full bracket state
    const debugBrackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
    for (const id in debugBrackets) {
        const b = debugBrackets[id];
        if ((b.division === kataFlagsDivisionName || b.divisionName === kataFlagsDivisionName) && b.eventId == kataFlagsEventId) {
            const matches = b.matches || [];
            console.log(`[NEXT MATCH] Bracket ${id} has ${matches.length} matches:`);
            matches.forEach(m => {
                console.log(`  R${m.round} P${m.position}: ${m.status} | red=${m.redCorner?.firstName || 'null'} blue=${m.blueCorner?.firstName || 'null'} winner=${m.winner?.firstName || 'null'}`);
            });
            break;
        }
    }

    if (divisionComplete) {
        // Division is done — show results + countdown to next division
        const results = getDivisionResults(kataFlagsDivisionName, kataFlagsEventId);
        showDivisionCompleteCountdown(kataFlagsMatId, kataFlagsDivisionName, kataFlagsEventId, results);
    } else {
        // More matches remain — reload scoreboard with next match
        openOperatorScoreboard(kataFlagsMatId, kataFlagsDivisionName, kataFlagsEventId);
    }
}

function selectOperatorCompetitor(corner) {
    const select = document.getElementById(`${corner}-competitor-select`);
    const competitorId = parseInt(select.value);

    if (!competitorId) return;

    const competitors = db.load('competitors');
    const competitor = competitors.find(c => c.id === competitorId);

    if (corner === 'red') {
        operatorRedCompetitor = competitor;
    } else {
        operatorBlueCompetitor = competitor;
    }

    // Update display
    document.getElementById(`operator-${corner}-name`).textContent =
        `${competitor.firstName} ${competitor.lastName}`.toUpperCase();

    document.getElementById(`${corner}-competitor-info`).innerHTML = `
        <strong>${competitor.firstName} ${competitor.lastName}</strong><br>
        ${getDisplayAge(competitor)} yrs | ${competitor.weight}kg | ${competitor.rank}<br>
        ${competitor.club}
    `;

    // Update TV display
    updateOperatorTVDisplay();
}

function operatorAddScore(corner, points, techniqueType = 'generic') {
    const { org, rules } = getActiveRuleset();
    console.log(`Score [${org}]: ${corner} ${points > 0 ? '+' : ''}${rules.scoring.isDecimal ? points.toFixed(1) : points} (${techniqueType})`);

    // Add to score history
    operatorScoreHistory.push({
        corner,
        points,
        techniqueType,
        timestamp: Date.now(),
        time: operatorTimeRemaining
    });

    // Update score with float-safe arithmetic
    if (corner === 'red') {
        operatorRedScore = Math.max(0, parseFloat((operatorRedScore + points).toFixed(1)));
        // Track technique breakdown
        if (points > 0) {
            if (techniqueType === 'ippon') operatorIpponCountRed++;
            else if (techniqueType === 'waza-ari') operatorWazaariCountRed++;
            else if (techniqueType === 'yuko') operatorYukoCountRed++;
        } else if (techniqueType === 'correction') {
            // Decrement the most recent technique count for corrections
            if (operatorYukoCountRed > 0 && org === 'wkf') operatorYukoCountRed--;
            else if (operatorWazaariCountRed > 0) operatorWazaariCountRed--;
            else if (operatorIpponCountRed > 0) operatorIpponCountRed--;
        }
        const scoreElement = document.getElementById('operator-red-score');
        if (scoreElement) {
            scoreElement.textContent = rules.scoring.isDecimal ? operatorRedScore.toFixed(1) : operatorRedScore;
            scoreElement.classList.add('score-change');
            setTimeout(() => scoreElement.classList.remove('score-change'), 400);
        }
    } else {
        operatorBlueScore = Math.max(0, parseFloat((operatorBlueScore + points).toFixed(1)));
        if (points > 0) {
            if (techniqueType === 'ippon') operatorIpponCountBlue++;
            else if (techniqueType === 'waza-ari') operatorWazaariCountBlue++;
            else if (techniqueType === 'yuko') operatorYukoCountBlue++;
        } else if (techniqueType === 'correction') {
            if (operatorYukoCountBlue > 0 && org === 'wkf') operatorYukoCountBlue--;
            else if (operatorWazaariCountBlue > 0) operatorWazaariCountBlue--;
            else if (operatorIpponCountBlue > 0) operatorIpponCountBlue--;
        }
        const scoreElement = document.getElementById('operator-blue-score');
        if (scoreElement) {
            scoreElement.textContent = rules.scoring.isDecimal ? operatorBlueScore.toFixed(1) : operatorBlueScore;
            scoreElement.classList.add('score-change');
            setTimeout(() => scoreElement.classList.remove('score-change'), 400);
        }
    }

    // Update score breakdown display
    updateScoreBreakdownDisplay();

    // WKF Senshu check (first unopposed scoring technique)
    if (org === 'wkf' && rules.winConditions.senshu && !operatorSenshu && points > 0 && techniqueType !== 'correction') {
        checkSenshu(corner);
    }

    // Update score history display if it exists
    updateScoreHistoryDisplay();

    updateOperatorTVDisplay();

    // Auto-win check (runs after TV display update so audience sees final state)
    if (points > 0) {
        checkAutoWin(org, rules);
    }
}

function resetScoreBreakdownCounters() {
    operatorIpponCountRed = 0;
    operatorIpponCountBlue = 0;
    operatorWazaariCountRed = 0;
    operatorWazaariCountBlue = 0;
    operatorYukoCountRed = 0;
    operatorYukoCountBlue = 0;
}

function updateScoreBreakdownDisplay() {
    const { org } = getActiveRuleset();
    ['red', 'blue'].forEach(corner => {
        const el = document.getElementById(`operator-${corner}-score-breakdown`);
        if (!el) return;
        const ic = corner === 'red' ? operatorIpponCountRed : operatorIpponCountBlue;
        const wc = corner === 'red' ? operatorWazaariCountRed : operatorWazaariCountBlue;
        const yc = corner === 'red' ? operatorYukoCountRed : operatorYukoCountBlue;
        const parts = [];
        if (ic > 0) parts.push(`${ic}I`);
        if (wc > 0) parts.push(`${wc}W`);
        if (yc > 0 && org === 'wkf') parts.push(`${yc}Y`);
        el.textContent = parts.length > 0 ? parts.join(' ') : '';
    });
}

function checkSenshu(scoringCorner) {
    const opponentScore = scoringCorner === 'red' ? operatorBlueScore : operatorRedScore;
    if (opponentScore === 0 && operatorSenshu === null) {
        operatorSenshu = scoringCorner;
        updateSenshuDisplay();
        showMessage(`SENSHU awarded to ${scoringCorner.toUpperCase()}!`);
    }
}

function updateSenshuDisplay() {
    ['red', 'blue'].forEach(corner => {
        const badge = document.getElementById(`senshu-badge-${corner}`);
        if (badge) {
            badge.style.display = operatorSenshu === corner ? 'inline-block' : 'none';
        }
    });
}

function checkAutoWin(org, rules) {
    if (org === 'wkf') {
        // 8-point lead check
        const pointLead = rules.winConditions.pointLead || 8;
        const diff = Math.abs(operatorRedScore - operatorBlueScore);
        if (diff >= pointLead) {
            const winner = operatorRedScore > operatorBlueScore ? 'red' : 'blue';
            operatorPauseTimer();
            setTimeout(() => {
                if (confirm(`${pointLead}-point lead reached!\n\n${winner.toUpperCase()} leads ${operatorRedScore} - ${operatorBlueScore}.\n\nDeclare ${winner.toUpperCase()} as winner?`)) {
                    operatorDeclareWinner(winner, { winMethod: 'points', winNote: `${pointLead}-point lead` });
                }
            }, 100);
        }
    } else if (org === 'aau') {
        // Sudden death in Encho-Sen (any score wins)
        if (operatorIsOvertime) {
            const fmt = rules.matchFormats?.[operatorMatchFormat];
            if (fmt?.suddenDeath) {
                // Any score during sudden death = immediate win
                if (operatorRedScore > 0 || operatorBlueScore > 0) {
                    const winner = operatorRedScore > operatorBlueScore ? 'red' : operatorBlueScore > operatorRedScore ? 'blue' : null;
                    if (winner) {
                        operatorPauseTimer();
                        setTimeout(() => {
                            showMessage(`SUDDEN DEATH — ${winner.toUpperCase()} wins!`);
                            operatorDeclareWinner(winner, { winMethod: 'points', winNote: 'Sudden death' });
                        }, 100);
                    }
                    return;
                }
            }
        }

        if (operatorMatchFormat === 'shobu-ippon') {
            // Any Ippon = immediate win
            // 2x Waza-ari = Awasete Ippon = immediate win
            const redWins = operatorIpponCountRed > 0 || operatorWazaariCountRed >= 2;
            const blueWins = operatorIpponCountBlue > 0 || operatorWazaariCountBlue >= 2;
            if (redWins && !blueWins) {
                operatorPauseTimer();
                const reason = operatorWazaariCountRed >= 2 ? 'AWASETE IPPON' : 'IPPON';
                setTimeout(() => {
                    showMessage(`${reason}! RED wins!`);
                    operatorDeclareWinner('red', { winMethod: 'ippon', winNote: reason });
                }, 100);
            } else if (blueWins && !redWins) {
                operatorPauseTimer();
                const reason = operatorWazaariCountBlue >= 2 ? 'AWASETE IPPON' : 'IPPON';
                setTimeout(() => {
                    showMessage(`${reason}! BLUE wins!`);
                    operatorDeclareWinner('blue', { winMethod: 'ippon', winNote: reason });
                }, 100);
            }
        } else if (operatorMatchFormat === 'shobu-sanbon') {
            // First to 3.0 points
            if (operatorRedScore >= 3.0) {
                operatorPauseTimer();
                setTimeout(() => {
                    showMessage('SANBON! RED wins!');
                    operatorDeclareWinner('red', { winMethod: 'ippon', winNote: 'SANBON (3 points)' });
                }, 100);
            } else if (operatorBlueScore >= 3.0) {
                operatorPauseTimer();
                setTimeout(() => {
                    showMessage('SANBON! BLUE wins!');
                    operatorDeclareWinner('blue', { winMethod: 'ippon', winNote: 'SANBON (3 points)' });
                }, 100);
            }
        }
    }
}

// Update score history display
function updateScoreHistoryDisplay() {
    const historyElement = document.getElementById('score-history-list');
    if (!historyElement) return;

    // Show last 5 scoring actions
    const recentHistory = operatorScoreHistory.slice(-5).reverse();

    const { org } = getActiveRuleset();
    const isDecimal = org === 'aau';

    historyElement.innerHTML = recentHistory.map(entry => {
        const cornerName = entry.corner === 'red' ? 'RED' : 'BLUE';
        const fmtPts = isDecimal ? parseFloat(entry.points).toFixed(1) : entry.points;
        const pointsText = entry.points > 0 ? `+${fmtPts}` : fmtPts;
        const techniqueLabel = entry.techniqueType.toUpperCase().replace('-', ' ');
        const timeText = formatTime(entry.time);

        return `
            <div class="score-history-item ${entry.techniqueType}">
                <span><strong>${cornerName}</strong> ${techniqueLabel} ${pointsText}</span>
                <span style="color: var(--text-secondary); font-size: 10px;">${timeText}</span>
            </div>
        `;
    }).join('');
}

// Format time helper
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ── Penalty Track System ────────────────────────────────────────────────────

function initPenaltyTracks(org) {
    if (org === 'wkf') {
        operatorRedPenaltyTracks  = { c1: 0, c2: 0 };
        operatorBluePenaltyTracks = { c1: 0, c2: 0 };
    } else if (org === 'aau') {
        operatorRedPenaltyTracks  = { hansoku: 0, mubobi: 0, jogai: 0 };
        operatorBluePenaltyTracks = { hansoku: 0, mubobi: 0, jogai: 0 };
    }
    operatorRedPenalties = 0;
    operatorBluePenalties = 0;
    operatorRedPenaltyList = [];
    operatorBluePenaltyList = [];
}

function operatorAddPenalty(corner, trackName) {
    const { org, rules } = getActiveRuleset();
    const opponentCorner = corner === 'red' ? 'blue' : 'red';

    // Handle Shikkaku separately (both rulesets)
    if (trackName === 'shikkaku') {
        const message = `${corner.toUpperCase()} disqualified from ENTIRE TOURNAMENT (SHIKKAKU)`;
        if (confirm(`${message}\n\nDeclare ${opponentCorner.toUpperCase()} as winner?`)) {
            operatorDeclareWinner(opponentCorner, { winMethod: 'hansoku', winNote: 'SHIKKAKU - Tournament disqualification', withdrawalType: 'disqualified' });
        }
        return;
    }

    const tracks = corner === 'red' ? operatorRedPenaltyTracks : operatorBluePenaltyTracks;

    // Resolve the track definition (handles AAU format-dependent Jogai)
    const resolvedTracks = getResolvedPenaltyTracks(org, operatorMatchFormat);
    const trackDef = resolvedTracks[trackName];
    if (!trackDef) {
        console.warn(`Unknown penalty track: ${trackName} for org ${org}`);
        return;
    }

    const currentLevel = tracks[trackName] || 0;
    const maxLevel = trackDef.levels.length - 1;

    if (currentLevel > maxLevel) {
        showMessage(`${corner.toUpperCase()} already at max penalty for ${trackDef.name}`);
        return;
    }

    // Escalate
    tracks[trackName] = currentLevel + 1;
    const newLevel = currentLevel + 1;
    const newLevelName = trackDef.levels[newLevel - 1]; // 0-indexed in levels array
    const newLevelLabel = trackDef.labels[newLevel - 1];

    console.log(`Penalty [${org}]: ${corner} ${trackName} → level ${newLevel} (${newLevelName})`);

    // Add to legacy penalty list for backward compat
    if (corner === 'red') {
        operatorRedPenaltyList.push({ type: `${trackName}-${newLevelName}`, timestamp: Date.now() });
        operatorRedPenalties = Object.values(operatorRedPenaltyTracks).reduce((a, b) => a + b, 0);
    } else {
        operatorBluePenaltyList.push({ type: `${trackName}-${newLevelName}`, timestamp: Date.now() });
        operatorBluePenalties = Object.values(operatorBluePenaltyTracks).reduce((a, b) => a + b, 0);
    }

    // NO points awarded to opponent (WKF 2026 + AAU)

    // Check for DQ (reached last level = hansoku/DQ)
    const lastLevelName = trackDef.levels[trackDef.levels.length - 1];
    if (newLevel > maxLevel || newLevelName === lastLevelName) {
        operatorPauseTimer();
        const message = `${corner.toUpperCase()} disqualified — ${trackDef.name} reached ${newLevelName.toUpperCase()}`;
        if (confirm(`${message}\n\nDeclare ${opponentCorner.toUpperCase()} as winner?`)) {
            operatorDeclareWinner(opponentCorner, { winMethod: 'hansoku', winNote: `${trackDef.name} - ${newLevelName.toUpperCase()}`, withdrawalType: 'disqualified' });
            return;
        }
    }

    updatePenaltyTrackDisplay(corner);
    updateOperatorTVDisplay();
}

function operatorUndoPenalty(corner, trackName) {
    const tracks = corner === 'red' ? operatorRedPenaltyTracks : operatorBluePenaltyTracks;
    if ((tracks[trackName] || 0) > 0) {
        tracks[trackName]--;
        if (corner === 'red') {
            operatorRedPenalties = Object.values(operatorRedPenaltyTracks).reduce((a, b) => a + b, 0);
        } else {
            operatorBluePenalties = Object.values(operatorBluePenaltyTracks).reduce((a, b) => a + b, 0);
        }
        updatePenaltyTrackDisplay(corner);
        updateOperatorTVDisplay();
    }
}

function updatePenaltyTrackDisplay(corner) {
    const displayElement = document.getElementById(`operator-${corner}-penalty-display`);
    if (!displayElement) return;

    const { org } = getActiveRuleset();
    const tracks = corner === 'red' ? operatorRedPenaltyTracks : operatorBluePenaltyTracks;
    const resolvedTracks = getResolvedPenaltyTracks(org, operatorMatchFormat);

    const parts = [];
    for (const [trackName, trackDef] of Object.entries(resolvedTracks)) {
        const level = tracks[trackName] || 0;
        if (level > 0) {
            const levelName = trackDef.levels[level - 1] || '?';
            const label = trackDef.labels[level - 1] || '?';
            // Capitalize first letter of each word
            const displayName = levelName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            parts.push(`${label}: ${displayName}`);
        }
    }

    displayElement.textContent = parts.length > 0 ? parts.join(' | ') : 'None';
}

// Legacy compat wrapper
function updatePenaltyDisplay(corner) {
    updatePenaltyTrackDisplay(corner);
}

// ── Timer System ────────────────────────────────────────────────────────────

function operatorStartTimer() {
    if (operatorTimerInterval) return; // Already running

    const { org, rules } = getActiveRuleset();
    const atoshiBarakuTime = rules.timer.atoshiBaraku || 15;

    operatorTimerInterval = setInterval(() => {
        if (operatorTimeRemaining > 0) {
            operatorTimeRemaining--;

            // Atoshi Baraku check
            if (operatorTimeRemaining <= atoshiBarakuTime && !operatorAtoshiBaraku) {
                operatorAtoshiBaraku = true;
                triggerAtoshiBaraku();
            }

            const timerEl = document.getElementById('operator-timer');
            if (timerEl) {
                const minutes = Math.floor(operatorTimeRemaining / 60);
                const seconds = operatorTimeRemaining % 60;
                timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                if (operatorAtoshiBaraku) {
                    timerEl.style.color = '#ff453a';
                }
            }
            updateOperatorTVDisplay();
        } else {
            operatorPauseTimer();
            handleTimeUp(org, rules);
        }
    }, 1000);
}

function triggerAtoshiBaraku() {
    const { rules } = getActiveRuleset();
    const seconds = rules.timer.atoshiBaraku || 15;

    // Visual: flash the timer red
    const timerEl = document.getElementById('operator-timer');
    if (timerEl) {
        timerEl.style.color = '#ff453a';
    }

    // Audio: play a short warning beep
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        gain.gain.value = 0.3;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        setTimeout(() => { osc.stop(); ctx.close(); }, 300);
    } catch(e) { /* Audio not available */ }

    showMessage(`ATOSHI BARAKU — ${seconds} seconds remaining!`);
    updateOperatorTVDisplay();
}

function handleTimeUp(org, rules) {
    showMessage('TIME UP!');

    // Check if one corner leads
    if (operatorRedScore !== operatorBlueScore) {
        const winner = operatorRedScore > operatorBlueScore ? 'red' : 'blue';
        const redDisplay = rules.scoring.isDecimal ? operatorRedScore.toFixed(1) : operatorRedScore;
        const blueDisplay = rules.scoring.isDecimal ? operatorBlueScore.toFixed(1) : operatorBlueScore;
        if (confirm(`Time up! ${winner.toUpperCase()} leads ${redDisplay} - ${blueDisplay}.\n\nDeclare ${winner.toUpperCase()} as winner?`)) {
            operatorDeclareWinner(winner, { winMethod: 'points', winNote: 'Time up - score lead' });
        }
        return;
    }

    // Tied at time-up
    if (org === 'wkf' && rules.winConditions.senshu && operatorSenshu) {
        // Senshu holder wins on tie
        if (confirm(`Tied ${operatorRedScore} - ${operatorBlueScore}.\n\nSENSHU goes to ${operatorSenshu.toUpperCase()}.\n\nDeclare ${operatorSenshu.toUpperCase()} as winner?`)) {
            operatorDeclareWinner(operatorSenshu, { winMethod: 'decision', winNote: 'SENSHU advantage' });
        }
        return;
    }

    // Show time-up decision panel
    operatorHanteiRound++;
    showTimeUpDecisionPanel(org, rules);
}

function showTimeUpDecisionPanel(org, rules) {
    // Remove any existing panel
    const existing = document.getElementById('timeup-decision-panel');
    if (existing) existing.remove();

    const cfg = getUnifiedScoreboardConfig();
    const overtimeEnabled = cfg?.kumite?.overtimeEnabled;
    const redDisplay = rules.scoring.isDecimal ? operatorRedScore.toFixed(1) : operatorRedScore;
    const blueDisplay = rules.scoring.isDecimal ? operatorBlueScore.toFixed(1) : operatorBlueScore;

    // Determine extension button label
    let extensionBtn = '';
    if (overtimeEnabled) {
        if (org === 'aau' && operatorMatchFormat) {
            const fmt = rules.matchFormats?.[operatorMatchFormat];
            if (fmt) {
                const dur = Math.floor(fmt.extensionDuration / 60) + ':' + (fmt.extensionDuration % 60).toString().padStart(2, '0');
                extensionBtn = `<button class="btn btn-primary" onclick="startExtension()" style="background: #ff9500; font-weight: 600;">${fmt.extensionName.toUpperCase()} (${dur})</button>`;
            }
        } else if (org === 'wkf') {
            extensionBtn = `<button class="btn btn-primary" onclick="startExtension()" style="background: #ff9500; font-weight: 600;">ENCHO-SEN (1:00)</button>`;
        }
    }

    // Hikiwake only allowed on first Hantei for AAU
    const hikiwakeBtn = (org === 'aau' && operatorHanteiRound < 2)
        ? `<button class="btn btn-secondary" onclick="declareHikiwake()" style="font-weight: 600;">HIKIWAKE (Draw)</button>`
        : '';

    const hanteiNote = operatorHanteiRound >= 2 ? '<div style="font-size: 11px; color: #ff453a; margin-top: 6px;">Second Hantei — judges MUST pick a winner</div>' : '';

    const panel = document.createElement('div');
    panel.id = 'timeup-decision-panel';
    panel.className = 'glass-panel';
    panel.style.cssText = 'text-align: center; background: rgba(255, 149, 0, 0.15); border-color: #ff9500; margin-top: 8px;';
    panel.innerHTML = `
        <div style="font-size: 18px; font-weight: 700; color: #ff9500; margin-bottom: 12px;">
            TIED ${redDisplay} - ${blueDisplay} — TIME UP
        </div>
        <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
            ${extensionBtn}
            <button class="btn btn-primary" onclick="showHanteiModal()" style="background: #5856d6; font-weight: 600;">HANTEI (Judges)</button>
            ${hikiwakeBtn}
        </div>
        ${hanteiNote}
    `;

    const scoreboardDiv = document.querySelector('.operator-scoreboard');
    if (scoreboardDiv) {
        // Insert after matchInfoHTML (first glass-panel)
        const firstPanel = scoreboardDiv.querySelector('.glass-panel');
        if (firstPanel && firstPanel.nextSibling) {
            scoreboardDiv.insertBefore(panel, firstPanel.nextSibling);
        } else {
            scoreboardDiv.appendChild(panel);
        }
    }
}

function startExtension() {
    const { org, rules } = getActiveRuleset();

    // Remove decision panel
    const panel = document.getElementById('timeup-decision-panel');
    if (panel) panel.remove();

    operatorIsOvertime = true;
    operatorAtoshiBaraku = false;

    if (org === 'wkf') {
        // WKF Encho-Sen
        const overtimeDuration = rules.timer.overtimeDefault || 60;
        operatorOvertimeRemaining = overtimeDuration;
        operatorRedScore = 0;
        operatorBlueScore = 0;
        resetScoreBreakdownCounters();
        operatorSenshu = null; // Reset Senshu for overtime

        operatorTimeRemaining = overtimeDuration;
        const timerEl = document.getElementById('operator-timer');
        if (timerEl) {
            timerEl.textContent = formatTime(overtimeDuration);
            timerEl.style.color = '';
        }

        // Update score displays
        const redScoreEl = document.getElementById('operator-red-score');
        const blueScoreEl = document.getElementById('operator-blue-score');
        if (redScoreEl) redScoreEl.textContent = '0';
        if (blueScoreEl) blueScoreEl.textContent = '0';
        updateSenshuDisplay();
        updateScoreBreakdownDisplay();

        showMessage('ENCHO-SEN — Overtime started!');
    } else if (org === 'aau') {
        // AAU: format-dependent extension
        const fmt = rules.matchFormats?.[operatorMatchFormat];
        if (!fmt) return;

        operatorOvertimeRemaining = fmt.extensionDuration;
        operatorTimeRemaining = fmt.extensionDuration;

        // Reset scores always
        operatorRedScore = 0;
        operatorBlueScore = 0;
        resetScoreBreakdownCounters();

        // Reset penalties only for Sai Shiai (full reset)
        if (fmt.extensionResetsPenalties) {
            initPenaltyTracks(org);
            updatePenaltyTrackDisplay('red');
            updatePenaltyTrackDisplay('blue');
        }
        // Penalties carry over for Encho-Sen

        const timerEl = document.getElementById('operator-timer');
        if (timerEl) {
            timerEl.textContent = formatTime(fmt.extensionDuration);
            timerEl.style.color = '';
        }

        // Update score displays
        const scoreDisplay = rules.scoring.isDecimal ? '0.0' : '0';
        const redScoreEl = document.getElementById('operator-red-score');
        const blueScoreEl = document.getElementById('operator-blue-score');
        if (redScoreEl) redScoreEl.textContent = scoreDisplay;
        if (blueScoreEl) blueScoreEl.textContent = scoreDisplay;
        updateScoreBreakdownDisplay();

        showMessage(`${fmt.extensionName.toUpperCase()} started!`);
    }

    updateOperatorTVDisplay();
    operatorStartTimer();
}

function showHanteiModal() {
    const cfg = getUnifiedScoreboardConfig();
    const c1Name = cfg?.kumite?.corner1Name || 'RED';
    const c2Name = cfg?.kumite?.corner2Name || 'BLUE';
    const noDrawAllowed = operatorHanteiRound >= 2;

    const drawNote = noDrawAllowed ? '\n\n(Second Hantei — judges MUST pick a winner, no draw)' : '';
    const choice = prompt(`HANTEI — Judges' Decision${drawNote}\n\nType "1" for ${c1Name} (RED) or "2" for ${c2Name} (BLUE):`);

    if (choice === '1') {
        const panel = document.getElementById('timeup-decision-panel');
        if (panel) panel.remove();
        showMessage(`HANTEI: ${c1Name} wins by judges' decision!`);
        operatorDeclareWinner('red', { winMethod: 'decision', winNote: 'HANTEI - Judges decision' });
    } else if (choice === '2') {
        const panel = document.getElementById('timeup-decision-panel');
        if (panel) panel.remove();
        showMessage(`HANTEI: ${c2Name} wins by judges' decision!`);
        operatorDeclareWinner('blue', { winMethod: 'decision', winNote: 'HANTEI - Judges decision' });
    }
}

function declareHikiwake() {
    // AAU draw — triggers extension
    const panel = document.getElementById('timeup-decision-panel');
    if (panel) panel.remove();

    showMessage('HIKIWAKE — Draw declared. Starting extension...');

    // After a brief pause, start the extension
    setTimeout(() => {
        startExtension();
    }, 1000);
}

function operatorPauseTimer() {
    if (operatorTimerInterval) {
        clearInterval(operatorTimerInterval);
        operatorTimerInterval = null;
    }
}

function operatorResetTimer() {
    operatorPauseTimer();
    operatorTimeRemaining = operatorMatchDuration;
    const mins = Math.floor(operatorMatchDuration / 60);
    const secs = (operatorMatchDuration % 60).toString().padStart(2, '0');
    document.getElementById('operator-timer').textContent = `${mins}:${secs}`;
    updateOperatorTVDisplay();
}

function operatorResetMatch() {
    if (!confirm('Reset this match? All scores will be cleared.')) return;

    const { org, rules } = getActiveRuleset();

    operatorRedScore = 0;
    operatorBlueScore = 0;
    operatorRedPenalties = 0;
    operatorBluePenalties = 0;
    operatorRedPenaltyList = [];
    operatorBluePenaltyList = [];

    // Reset ruleset-aware state
    operatorSenshu = null;
    operatorIsOvertime = false;
    operatorOvertimeRemaining = null;
    operatorAtoshiBaraku = false;
    operatorHanteiRound = 0;
    resetScoreBreakdownCounters();
    initPenaltyTracks(org);

    operatorResetTimer();

    const scoreDisplay = rules.scoring.isDecimal ? '0.0' : '0';
    const redScoreEl = document.getElementById('operator-red-score');
    const blueScoreEl = document.getElementById('operator-blue-score');
    if (redScoreEl) redScoreEl.textContent = scoreDisplay;
    if (blueScoreEl) blueScoreEl.textContent = scoreDisplay;

    const redPenEl = document.getElementById('operator-red-penalties');
    const bluePenEl = document.getElementById('operator-blue-penalties');
    if (redPenEl) redPenEl.textContent = '0';
    if (bluePenEl) bluePenEl.textContent = '0';

    updatePenaltyTrackDisplay('red');
    updatePenaltyTrackDisplay('blue');
    updateSenshuDisplay();
    updateScoreBreakdownDisplay();

    // Remove any time-up decision panel
    const timeupPanel = document.getElementById('timeup-decision-panel');
    if (timeupPanel) timeupPanel.remove();

    updateOperatorTVDisplay();
}

/**
 * Show a win-method selection modal. Returns a Promise that resolves to
 * { winMethod, winNote } or null if the user cancels.
 */
function showWinMethodModal(winnerName, cornerLabel) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.style.zIndex = '100001';
        overlay.innerHTML = `
            <div class="confirm-dialog" style="max-width: 420px; width: 90%;">
                <p class="confirm-message" style="margin-bottom: 12px;">
                    Declare <strong>${cornerLabel}</strong> corner (<strong>${winnerName}</strong>) as the WINNER?
                </p>
                <div style="margin-bottom: 12px;">
                    <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text-secondary);">Win Method</label>
                    <select id="win-method-select" style="width: 100%; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--glass-border); background: var(--bg-secondary); color: var(--text-primary); font-size: 14px;">
                        <option value="points">Points (Score Lead)</option>
                        <option value="decision">Decision (Hantei / Judge)</option>
                        <option value="ippon">Ippon</option>
                        <option value="hansoku">Hansoku (Disqualification)</option>
                        <option value="withdrawal">Withdrawal</option>
                        <option value="default_win">Default Win (No-Show / BYE)</option>
                    </select>
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text-secondary);">Note (optional)</label>
                    <input id="win-method-note" type="text" placeholder="e.g. excessive contact, out of bounds" style="width: 100%; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--glass-border); background: var(--bg-secondary); color: var(--text-primary); font-size: 13px; box-sizing: border-box;">
                </div>
                <div class="confirm-actions">
                    <button class="confirm-btn confirm-cancel" id="win-method-cancel">Cancel</button>
                    <button class="confirm-btn confirm-ok" id="win-method-confirm">Confirm Winner</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const cleanup = (val) => { overlay.remove(); resolve(val); };

        overlay.querySelector('#win-method-cancel').onclick = () => cleanup(null);
        overlay.querySelector('#win-method-confirm').onclick = () => {
            const winMethod = overlay.querySelector('#win-method-select').value;
            const winNote = overlay.querySelector('#win-method-note').value.trim();
            cleanup({ winMethod, winNote });
        };
        overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(null); });
        setTimeout(() => overlay.querySelector('#win-method-confirm').focus(), 50);
    });
}

/**
 * Declare a winner for kumite match.
 * @param {string} corner - 'red' or 'blue'
 * @param {object} [winMethodOverride] - Optional { winMethod, winNote, withdrawalType } to skip the modal
 */
async function operatorDeclareWinner(corner, winMethodOverride) {
    const winner = corner === 'red' ? operatorRedCompetitor : operatorBlueCompetitor;
    const loser = corner === 'red' ? operatorBlueCompetitor : operatorRedCompetitor;

    if (!winner || !loser) {
        showMessage('No competitors loaded for this match', 'error');
        return;
    }

    let winMethod = 'points';
    let winNote = '';
    let withdrawalType = null;

    if (winMethodOverride) {
        // Auto-called path (ippon, DQ, no-show, etc.) — skip modal
        winMethod = winMethodOverride.winMethod || 'points';
        winNote = winMethodOverride.winNote || '';
        withdrawalType = winMethodOverride.withdrawalType || null;
    } else {
        // Manual call — show win method modal
        const winnerName = `${winner.firstName} ${winner.lastName}`;
        const cornerLabel = corner === 'red' ? 'RED' : 'BLUE';
        const result = await showWinMethodModal(winnerName, cornerLabel);
        if (!result) return; // User cancelled
        winMethod = result.winMethod;
        winNote = result.winNote;
    }

    operatorPauseTimer();

    // Save match result to bracket
    if (window.currentBracketId && window.currentMatchId) {
        const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
        const bracket = brackets[window.currentBracketId];

        if (bracket) {
            // Find and update the current match
            let match = null;
            if (bracket.type === 'single-elimination' || bracket.type === 'round-robin') {
                match = bracket.matches?.find(m => m.id === window.currentMatchId);
            } else if (bracket.type === 'double-elimination') {
                match = bracket.winners?.find(m => m.id === window.currentMatchId);
                if (!match) match = bracket.losers?.find(m => m.id === window.currentMatchId);
                if (!match && bracket.finals?.id === window.currentMatchId) match = bracket.finals;
                if (!match && bracket.reset?.id === window.currentMatchId) match = bracket.reset;
            } else if (bracket.type === 'repechage') {
                match = bracket.matches?.find(m => m.id === window.currentMatchId);
                if (!match) match = bracket.repechageA?.find(m => m.id === window.currentMatchId);
                if (!match) match = bracket.repechageB?.find(m => m.id === window.currentMatchId);
            }

            if (match) {
                // Guard: prevent double-completion (same as kata-flags path)
                if (match.status === 'completed') {
                    console.warn('[KUMITE] Match already completed, skipping:', match.id);
                    return;
                }

                match.winner = winner;
                match.score1 = corner === 'red' ? operatorRedScore : operatorBlueScore;
                match.score2 = corner === 'red' ? operatorBlueScore : operatorRedScore;
                match.status = 'completed';
                match.winMethod = winMethod;
                match.winNote = winNote || '';
                if (withdrawalType) match.withdrawalType = withdrawalType;

                // Log win method to score edit log
                logScoreEdit(window.currentBracketId, window.currentMatchId, 'winMethod', null, `${winMethod}${winNote ? ': ' + winNote : ''}`);

                // Advance winner to next round
                if (bracket.type === 'single-elimination') {
                    let advanceMatch = match;
                    let advanceWinner = winner;

                    while (true) {
                        const nextRound = advanceMatch.round + 1;
                        const nextPosition = Math.floor(advanceMatch.position / 2);
                        const nextMatch = bracket.matches?.find(m => m.round === nextRound && m.position === nextPosition);

                        if (!nextMatch) break;

                        if (advanceMatch.position % 2 === 0) {
                            if (!nextMatch.redCorner) nextMatch.redCorner = advanceWinner;
                            else nextMatch.blueCorner = advanceWinner;
                        } else {
                            if (!nextMatch.blueCorner) nextMatch.blueCorner = advanceWinner;
                            else nextMatch.redCorner = advanceWinner;
                        }

                        if (nextMatch.redCorner && !nextMatch.blueCorner) {
                            const blueFeeder = bracket.matches?.find(m => m.round === nextMatch.round - 1 && m.position === nextMatch.position * 2 + 1);
                            if (blueFeeder && (blueFeeder.status === 'empty' || blueFeeder.status === 'bye')) {
                                nextMatch.status = 'bye';
                                nextMatch.winner = nextMatch.redCorner;
                                nextMatch.score1 = 'BYE';
                                advanceMatch = nextMatch;
                                advanceWinner = nextMatch.redCorner;
                                continue;
                            }
                        } else if (!nextMatch.redCorner && nextMatch.blueCorner) {
                            const redFeeder = bracket.matches?.find(m => m.round === nextMatch.round - 1 && m.position === nextMatch.position * 2);
                            if (redFeeder && (redFeeder.status === 'empty' || redFeeder.status === 'bye')) {
                                nextMatch.status = 'bye';
                                nextMatch.winner = nextMatch.blueCorner;
                                nextMatch.score2 = 'BYE';
                                advanceMatch = nextMatch;
                                advanceWinner = nextMatch.blueCorner;
                                continue;
                            }
                        }
                        break;
                    }
                } else if (bracket.type === 'double-elimination') {
                    handleDoubleElimWinnerDeclaration(bracket, match, winner, loser);
                } else if (bracket.type === 'repechage') {
                    handleRepechageWinnerDeclaration(bracket, match, winner, loser);
                }

                // Save updated bracket
                saveBrackets(brackets);
            }
        }
    }

    // Send winner to TV display (with rich data for audience celebration)
    updateOperatorTVDisplay({
        name: `${winner.firstName} ${winner.lastName}`.toUpperCase(),
        photo: winner.photo || null,
        club: winner.club || null,
        clubLogo: winner.clubLogo || null,
        corner: corner,
    });

    // Show inline winner result on operator side (no full-screen overlay)
    const settings = JSON.parse(localStorage.getItem(_scopedKey('scoreboardSettings')) || '{}');
    const winnerCornerName = corner === 'red' ? (settings.corner1Name || 'RED') : (settings.corner2Name || 'BLUE');
    const winnerColor = corner === 'red' ? (settings.corner1Custom || '#ff453a') : (settings.corner2Custom || '#0a84ff');

    // Check if the entire bracket/division is now complete
    const divisionComplete = checkBracketComplete(currentOperatorDivision, currentOperatorEventId);

    // Insert winner result panel into the operator scoreboard
    const operatorContent = document.getElementById('operator-scoreboard-content');
    const resultPanel = document.createElement('div');
    resultPanel.id = 'operator-winner-result';
    resultPanel.className = 'glass-panel';
    resultPanel.style.cssText = 'text-align: center; flex-shrink: 0; background: rgba(34, 197, 94, 0.15); border-color: #22c55e;';
    resultPanel.innerHTML = `
        <div style="font-size: 24px; font-weight: 700; color: #22c55e; margin-bottom: 8px;">
            🏆 WINNER: ${winner.firstName.toUpperCase()} ${winner.lastName.toUpperCase()}
        </div>
        <div style="font-size: 16px; color: var(--text-secondary); margin-bottom: 12px;">
            ${winnerCornerName} Corner — Score: ${corner === 'red' ? operatorRedScore : operatorBlueScore} - ${corner === 'red' ? operatorBlueScore : operatorRedScore}
        </div>
        <div style="display: flex; gap: 8px; justify-content: center;">
            <button class="btn btn-primary" onclick="operatorNextAfterWin()" style="font-size: 14px; padding: 8px 24px;">
                ${divisionComplete ? 'View Results →' : 'Next Match →'}
            </button>
            <span style="font-size: 13px; color: var(--text-tertiary); align-self: center;">
                Auto-advancing in <span id="winner-countdown">10</span>s
            </span>
        </div>
    `;

    // Find the operator-scoreboard div and append the result
    const scoreboardDiv = operatorContent?.querySelector('.operator-scoreboard');
    if (scoreboardDiv) {
        scoreboardDiv.appendChild(resultPanel);
    }

    // Countdown and auto-advance
    let countdown = 10;
    const countdownEl = document.getElementById('winner-countdown');
    const countdownInterval = setInterval(() => {
        countdown--;
        if (countdownEl) countdownEl.textContent = countdown;
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            operatorNextAfterWin();
        }
    }, 1000);

    // Store the interval so operatorNextAfterWin can clear it
    window._winnerCountdownInterval = countdownInterval;
}

/**
 * Mark a competitor as absent (no-show / withdrew / medical / disqualified).
 * Shows a modal to select withdrawal type, then auto-declares the opponent as winner.
 * @param {string} absentCorner - 'red' or 'blue' — the corner that is absent
 */
async function operatorMarkAbsent(absentCorner) {
    const absentCompetitor = absentCorner === 'red' ? operatorRedCompetitor : operatorBlueCompetitor;
    const opponentCorner = absentCorner === 'red' ? 'blue' : 'red';
    const opponentCompetitor = opponentCorner === 'red' ? operatorRedCompetitor : operatorBlueCompetitor;

    if (!absentCompetitor) {
        showMessage('No competitor loaded for this corner', 'error');
        return;
    }
    if (!opponentCompetitor) {
        showMessage('No opponent loaded — cannot declare a default winner', 'error');
        return;
    }

    const absentName = `${absentCompetitor.firstName} ${absentCompetitor.lastName}`;
    const opponentName = `${opponentCompetitor.firstName} ${opponentCompetitor.lastName}`;

    // Show withdrawal type modal
    const result = await new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.style.zIndex = '100001';
        overlay.innerHTML = `
            <div class="confirm-dialog" style="max-width: 420px; width: 90%;">
                <p class="confirm-message" style="margin-bottom: 12px;">
                    Mark <strong>${absentName}</strong> as absent?
                </p>
                <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">
                    <strong>${opponentName}</strong> will be declared the winner by default.
                </p>
                <div style="margin-bottom: 12px;">
                    <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text-secondary);">Reason</label>
                    <select id="absent-type-select" style="width: 100%; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--glass-border); background: var(--bg-secondary); color: var(--text-primary); font-size: 14px;">
                        <option value="no_show">No-Show (Did not arrive)</option>
                        <option value="withdrew">Withdrew (Pulled out)</option>
                        <option value="medical">Medical (Injury / Illness)</option>
                        <option value="disqualified">Disqualified</option>
                    </select>
                </div>
                <div class="confirm-actions">
                    <button class="confirm-btn confirm-cancel" id="absent-cancel">Cancel</button>
                    <button class="confirm-btn confirm-ok confirm-danger" id="absent-confirm">Mark Absent</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const cleanup = (val) => { overlay.remove(); resolve(val); };
        overlay.querySelector('#absent-cancel').onclick = () => cleanup(null);
        overlay.querySelector('#absent-confirm').onclick = () => {
            const withdrawalType = overlay.querySelector('#absent-type-select').value;
            cleanup(withdrawalType);
        };
        overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(null); });
        setTimeout(() => overlay.querySelector('#absent-confirm').focus(), 50);
    });

    if (!result) return; // User cancelled

    const withdrawalLabels = {
        no_show: 'Opponent no-show',
        withdrew: 'Opponent withdrew',
        medical: 'Opponent medical withdrawal',
        disqualified: 'Opponent disqualified'
    };

    // Declare the opponent as winner with default_win method
    operatorDeclareWinner(opponentCorner, {
        winMethod: 'default_win',
        winNote: withdrawalLabels[result] || 'Opponent absent',
        withdrawalType: result
    });
}

/**
 * Mark a competitor as absent in kata-flags head-to-head.
 * @param {string} absentCorner - 'corner1' (red) or 'corner2' (blue)
 */
async function kataFlagsMarkAbsent(absentCorner) {
    const match = kataFlagsCurrentMatch;
    if (!match) {
        showToast('No current match loaded', 'error');
        return;
    }

    const absentCompetitor = absentCorner === 'corner1' ? match.redCorner : match.blueCorner;
    const opponentCompetitor = absentCorner === 'corner1' ? match.blueCorner : match.redCorner;

    if (!absentCompetitor || !opponentCompetitor) {
        showToast('Both competitors must be loaded', 'error');
        return;
    }

    const absentName = `${absentCompetitor.firstName} ${absentCompetitor.lastName}`;
    const opponentName = `${opponentCompetitor.firstName} ${opponentCompetitor.lastName}`;

    // Show withdrawal type modal
    const withdrawalType = await new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.style.zIndex = '100001';
        overlay.innerHTML = `
            <div class="confirm-dialog" style="max-width: 420px; width: 90%;">
                <p class="confirm-message" style="margin-bottom: 12px;">
                    Mark <strong>${absentName}</strong> as absent?
                </p>
                <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">
                    <strong>${opponentName}</strong> will be declared the winner by default.
                </p>
                <div style="margin-bottom: 12px;">
                    <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text-secondary);">Reason</label>
                    <select id="absent-type-select-kf" style="width: 100%; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--glass-border); background: var(--bg-secondary); color: var(--text-primary); font-size: 14px;">
                        <option value="no_show">No-Show (Did not arrive)</option>
                        <option value="withdrew">Withdrew (Pulled out)</option>
                        <option value="medical">Medical (Injury / Illness)</option>
                        <option value="disqualified">Disqualified</option>
                    </select>
                </div>
                <div class="confirm-actions">
                    <button class="confirm-btn confirm-cancel" id="absent-cancel-kf">Cancel</button>
                    <button class="confirm-btn confirm-ok confirm-danger" id="absent-confirm-kf">Mark Absent</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const cleanup = (val) => { overlay.remove(); resolve(val); };
        overlay.querySelector('#absent-cancel-kf').onclick = () => cleanup(null);
        overlay.querySelector('#absent-confirm-kf').onclick = () => {
            cleanup(overlay.querySelector('#absent-type-select-kf').value);
        };
        overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(null); });
        setTimeout(() => overlay.querySelector('#absent-confirm-kf').focus(), 50);
    });

    if (!withdrawalType) return; // User cancelled

    const withdrawalLabels = {
        no_show: 'Opponent no-show',
        withdrew: 'Opponent withdrew',
        medical: 'Opponent medical withdrawal',
        disqualified: 'Opponent disqualified'
    };

    // Guard: if match is already completed, don't re-process
    if (match.status === 'completed') {
        showToast('Match already completed', 'error');
        return;
    }

    // Update match data
    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
    const bracket = brackets[window.currentBracketId];
    if (!bracket) {
        showToast('Bracket not found', 'error');
        return;
    }

    // Find the match in all arrays
    const allBracketMatches = [
        ...(bracket.matches || []),
        ...(bracket.winners || []),
        ...(bracket.losers || []),
        ...(bracket.repechageA || []),
        ...(bracket.repechageB || [])
    ];
    if (bracket.finals) allBracketMatches.push(bracket.finals);
    if (bracket.reset) allBracketMatches.push(bracket.reset);
    const bracketMatch = allBracketMatches.find(m => m.id === window.currentMatchId);

    if (!bracketMatch) {
        showToast('Match not found in bracket', 'error');
        return;
    }

    const winner = opponentCompetitor;
    const loser = absentCompetitor;

    bracketMatch.winner = winner;
    bracketMatch.status = 'completed';
    bracketMatch.winMethod = 'default_win';
    bracketMatch.winNote = withdrawalLabels[withdrawalType] || 'Opponent absent';
    bracketMatch.withdrawalType = withdrawalType;
    bracketMatch.corner1Flags = 0;
    bracketMatch.corner2Flags = 0;

    // Log to score edit log
    logScoreEdit(window.currentBracketId, window.currentMatchId, 'winMethod', null, `default_win: ${withdrawalLabels[withdrawalType]} (${absentName})`);

    // Advance winner (reuse existing bracket advancement logic)
    if (bracket.type === 'single-elimination') {
        const matchPool = bracket.matches || [];
        let advanceMatch = bracketMatch;
        let advanceWinner = winner;

        while (true) {
            const nextRound = advanceMatch.round + 1;
            const nextPosition = Math.floor(advanceMatch.position / 2);
            const nextMatch = matchPool.find(m => m.round === nextRound && m.position === nextPosition);
            if (!nextMatch) break;

            // Guard duplicate
            const winnerId = advanceWinner.id || `${advanceWinner.firstName}_${advanceWinner.lastName}`;
            const redId = nextMatch.redCorner ? (nextMatch.redCorner.id || `${nextMatch.redCorner.firstName}_${nextMatch.redCorner.lastName}`) : null;
            const blueId = nextMatch.blueCorner ? (nextMatch.blueCorner.id || `${nextMatch.blueCorner.firstName}_${nextMatch.blueCorner.lastName}`) : null;
            if (winnerId === redId || winnerId === blueId) break;

            if (advanceMatch.position % 2 === 0) {
                if (!nextMatch.redCorner) nextMatch.redCorner = advanceWinner;
                else if (!nextMatch.blueCorner) nextMatch.blueCorner = advanceWinner;
                else break;
            } else {
                if (!nextMatch.blueCorner) nextMatch.blueCorner = advanceWinner;
                else if (!nextMatch.redCorner) nextMatch.redCorner = advanceWinner;
                else break;
            }

            // BYE cascade
            if (nextMatch.redCorner && !nextMatch.blueCorner) {
                const blueFeeder = matchPool.find(m => m.round === nextMatch.round - 1 && m.position === nextMatch.position * 2 + 1);
                if (blueFeeder && (blueFeeder.status === 'empty' || blueFeeder.status === 'bye')) {
                    nextMatch.status = 'bye';
                    nextMatch.winner = nextMatch.redCorner;
                    nextMatch.score1 = 'BYE';
                    advanceMatch = nextMatch;
                    advanceWinner = nextMatch.redCorner;
                    continue;
                }
            } else if (!nextMatch.redCorner && nextMatch.blueCorner) {
                const redFeeder = matchPool.find(m => m.round === nextMatch.round - 1 && m.position === nextMatch.position * 2);
                if (redFeeder && (redFeeder.status === 'empty' || redFeeder.status === 'bye')) {
                    nextMatch.status = 'bye';
                    nextMatch.winner = nextMatch.blueCorner;
                    nextMatch.score2 = 'BYE';
                    advanceMatch = nextMatch;
                    advanceWinner = nextMatch.blueCorner;
                    continue;
                }
            }
            break;
        }
    } else if (bracket.type === 'double-elimination') {
        handleDoubleElimWinnerDeclaration(bracket, bracketMatch, winner, loser);
    } else if (bracket.type === 'repechage') {
        handleRepechageWinnerDeclaration(bracket, bracketMatch, winner, loser);
    }

    // Save updated bracket
    saveBrackets(brackets);

    // Save to results/history
    const results = JSON.parse(localStorage.getItem(_scopedKey('results')) || '[]');
    results.push({
        id: generateUniqueId(),
        timestamp: new Date().toISOString(),
        matId: kataFlagsMatId,
        division: kataFlagsDivisionName,
        eventId: kataFlagsEventId,
        winner: winner,
        loser: loser,
        scoreboardType: 'kata-flags',
        method: 'Default Win',
        winMethod: 'default_win',
        winNote: withdrawalLabels[withdrawalType] || 'Opponent absent',
        withdrawalType: withdrawalType
    });
    localStorage.setItem(_scopedKey('results'), JSON.stringify(results));

    // Show winner result
    const corner1Name = kataFlagsScoreboardConfig?.settings?.corner1Name || 'Red';
    const corner2Name = kataFlagsScoreboardConfig?.settings?.corner2Name || 'Blue';
    const winnerCorner = absentCorner === 'corner1' ? corner2Name : corner1Name;

    document.getElementById('kata-flags-result').innerHTML = `
        <div style="background: rgba(34, 197, 94, 0.2); border: 2px solid #22c55e; border-radius: 12px; padding: 20px; margin-top: 20px;">
            <div style="font-size: 24px; font-weight: 700; color: #22c55e; margin-bottom: 12px;">
                WINNER: ${winner.firstName} ${winner.lastName}
            </div>
            <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 16px;">
                ${winnerCorner} Corner wins by default (${withdrawalLabels[withdrawalType]})
            </div>
            <button class="btn btn-primary" onclick="kataFlagsNextMatch()" style="font-size: 16px; padding: 12px 32px;">
                ${checkBracketComplete(kataFlagsDivisionName, kataFlagsEventId) ? 'View Results' : 'Next Match'}
            </button>
        </div>
    `;

    // Allow future declarations
    window._kataFlagsDeclaring = false;
}

function operatorNextAfterWin() {
    // Clear countdown if still running
    if (window._winnerCountdownInterval) {
        clearInterval(window._winnerCountdownInterval);
        window._winnerCountdownInterval = null;
    }

    // Clear winner from audience display (works for all scoreboard types)
    try {
        const currentState = JSON.parse(localStorage.getItem(_scopedKey('scoreboard-state')) || '{}');
        currentState.winner = null;
        localStorage.setItem(_scopedKey('scoreboard-state'), JSON.stringify(currentState));
    } catch(e) {}

    const divisionComplete = checkBracketComplete(currentOperatorDivision, currentOperatorEventId);
    if (divisionComplete) {
        const results = getDivisionResults(currentOperatorDivision, currentOperatorEventId);
        showDivisionCompleteCountdown(currentOperatorMat, currentOperatorDivision, currentOperatorEventId, results);
    } else {
        openOperatorScoreboard(currentOperatorMat, currentOperatorDivision, currentOperatorEventId);
    }
}

// showWinnerCelebration removed — celebration now shows on audience scoreboards only

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * KATA SCOREBOARD - Kata/Forms Competition Operator
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ROUTE: Schedule tab → Click kata division → Auto-routed from openOperatorScoreboard()
 *
 * FLOW:
 * 1. openOperatorScoreboard() detects event scoreboard type is kata-flags/kata-points
 * 2. Routes to openKataScoreboard(matId, divisionName, eventId, bracket, scoreboardType)
 * 3. Auto-loads first incomplete performance from bracket.rounds[].performances[]
 * 4. Displays competitor info with photo
 * 5. Operator uses judge scoring panels:
 *    - kata-flags: Toggle flags (3/5/7 judges) → Vote system
 *    - kata-points: Enter scores 0-10 (3/5/7 judges) → Average/total system
 * 6. Shows real-time leaderboard with current round standings
 * 7. Click "Submit Score" → Saves to bracket, advances to next performance
 * 8. Auto-loads next competitor in round, or moves to next round when complete
 * 9. TV display integration via updateOperatorTVDisplay()
 *
 * STATE VARIABLES (Global):
 * - currentKataCompetitor: Current performer from bracket
 * - currentKataRound: Current round object from bracket.rounds[]
 * - currentKataPerformanceIndex: Index in round.performances array
 * - kataJudgeScores: Array of judge flags (bool) or scores (numbers)
 * - currentOperatorMat/Division/EventId: Inherited from operator scoreboard
 *
 * SCOREBOARD TYPES:
 * - kata-flags: Judges vote with flags, majority wins
 *   - 3 judges: 2 flags = pass
 *   - 5 judges: 3 flags = pass
 *   - 7 judges: 4 flags = pass
 * - kata-points: Judges score 0-10 (configurable range)
 *   - Average: Drop high/low, average middle scores
 *   - Total: Sum all scores
 *
 * DATA STRUCTURE (Kata Bracket):
 * brackets[bracketId] = {
 *   type: 'kata-flags' | 'kata-points',
 *   numJudges: 3 | 5 | 7,
 *   scoringRange: {min: 0, max: 10},
 *   scoringMethod: 'average' | 'total',
 *   rounds: [
 *     {
 *       roundNumber: 1,
 *       roundName: "Preliminaries",
 *       performances: [
 *         {
 *           competitor: {id, firstName, lastName, photo, age, weight, rank, club},
 *           scores: [8.5, 8.0, 9.0],    // For kata-points
 *           flags: [true, true, false],  // For kata-flags
 *           finalScore: 8.5,             // Calculated
 *           completed: true
 *         }
 *       ]
 *     }
 *   ]
 * }
 *
 * ✅ FEATURES (2026-02-13):
 * 1. ✅ Complete Kata operator scoreboard implementation
 * 2. ✅ Supports both kata-flags (judge flags) and kata-points (judge scores)
 * 3. ✅ Auto-loads next competitor from bracket performances
 * 4. ✅ Configurable judge panels (3/5/7 judges)
 * 5. ✅ Real-time leaderboard display
 * 6. ✅ Scores auto-save to bracket on submission
 * 7. ✅ Auto-advances to next performance after score submission
 * 8. ✅ Detects round completion and advances to next round
 * 9. ✅ Mat name displayed in scoreboard title
 * 10. ✅ Validates bracket structure (must be kata bracket type, not kumite)
 *
 * ⚠️ KNOWN ISSUES:
 * 1. No validation for incomplete judge scores before submission
 * 2. No tie-breaking mechanism for kata-flags
 * 3. No edit/undo for submitted scores
 * 4. TV display integration not yet implemented for Kata
 *
 * 📝 TODO:
 * - Add score validation (all judges must score)
 * - Implement tie-breaking for kata-flags
 * - Add score editing/undo functionality
 * - Integrate with TV display for kata scoreboards
 * - Add bracket completion detection and winner announcement
 *
 * Last Updated: 2026-02-13
 * ═══════════════════════════════════════════════════════════════════════════
 */

let currentKataCompetitor = null;
let currentKataRound = null;
let currentKataPerformanceIndex = 0;
let kataJudgeScores = [];
let currentKataScoreboardType = null;

function openKataScoreboard(matId, divisionName, eventId, bracket, scoreboardType) {
    currentOperatorMat = matId;
    currentOperatorDivision = divisionName;
    currentOperatorEventId = eventId;
    currentKataScoreboardType = scoreboardType;

    // Get mat name
    const mats = JSON.parse(localStorage.getItem(_scopedKey('mats')) || '[]');
    const mat = mats.find(m => m.id == matId);
    const matName = mat ? mat.name : `Mat ${matId}`;

    // Determine if using flags or points based on scoreboard type (not bracket type)
    const isFlags = scoreboardType === 'kata-flags';

    // Ranking-list brackets use entries, not rounds — route to ranking list scorer
    if (bracket.type === 'ranking-list') {
        openRankingListScoreboard(matId, divisionName, eventId, bracket, scoreboardType);
        return;
    }

    // Check if bracket has kata structure (rounds array)
    if (!bracket.rounds || !Array.isArray(bracket.rounds)) {
        showToast(`Bracket structure mismatch: generated as "${bracket.type}". Delete and regenerate with correct type.`, 'error', 6000);
        return;
    }

    // Find first incomplete round
    currentKataRound = bracket.rounds.find(r => r.performances.some(p => !p.completed)) || bracket.rounds[0];

    if (!currentKataRound) {
        showToast('No rounds found in this Kata bracket.', 'error');
        return;
    }

    // Find first incomplete performance in this round
    const incompletePerfIndex = currentKataRound.performances.findIndex(p => !p.completed);
    currentKataPerformanceIndex = incompletePerfIndex >= 0 ? incompletePerfIndex : 0;

    const performance = currentKataRound.performances[currentKataPerformanceIndex];
    currentKataCompetitor = rehydrateCompetitor(performance?.competitor);

    // Initialize judge scores
    const numJudges = bracket.numJudges || 5;
    kataJudgeScores = Array(numJudges).fill(isFlags ? false : 0);

    // Show modal
    const modal = document.getElementById('operator-scoreboard-modal');
    const title = document.getElementById('scoreboard-title');
    const content = document.getElementById('operator-scoreboard-content');

    title.textContent = `${matName} - ${divisionName} (KATA)`;

    // Build Kata scoreboard HTML
    const scoringRange = bracket.scoringRange || { min: 0, max: 10 };

    const kataDivProgressHTML = buildDivisionProgressHTML(matId, divisionName, eventId);
    content.innerHTML = `
        <div class="kata-scoreboard">
            <div class="glass-panel" style="text-align: center; flex-shrink: 0;">
                <div style="font-weight: 600; font-size: clamp(13px, 1.5vw, 16px);">${currentKataRound.roundName || `Round ${currentKataRound.roundNumber}`}</div>
                <div style="color: var(--text-secondary); font-size: clamp(11px, 1.2vw, 14px);">Performance ${currentKataPerformanceIndex + 1} of ${currentKataRound.performances.length}</div>
                ${kataDivProgressHTML}
            </div>

            <div class="glass-panel" style="text-align: center; background: linear-gradient(135deg, rgba(220, 38, 38, 0.1), rgba(220, 38, 38, 0.05)); border: 2px solid #dc2626; flex-shrink: 0;">
                <div style="display: flex; align-items: center; justify-content: center; gap: clamp(12px, 2vw, 24px);">
                    ${currentKataCompetitor?.photo ? `
                        <img src="${currentKataCompetitor.photo}" style="width: clamp(50px, 8vh, 100px); height: clamp(50px, 8vh, 100px); border-radius: 50%; object-fit: cover; border: 3px solid #dc2626; flex-shrink: 0;">
                    ` : ''}
                    <div>
                        <div style="font-size: clamp(20px, 2.5vw, 32px); font-weight: 700; color: #dc2626;">
                            ${currentKataCompetitor ? `${currentKataCompetitor.firstName} ${currentKataCompetitor.lastName}`.toUpperCase() : 'NO COMPETITOR'}
                        </div>
                        ${currentKataCompetitor ? `
                            <div style="font-size: clamp(12px, 1.3vw, 16px); color: var(--text-secondary); margin-top: 4px;">
                                ${getDisplayAge(currentKataCompetitor)} yrs | ${currentKataCompetitor.weight}kg | ${currentKataCompetitor.rank} | ${currentKataCompetitor.club}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>

            <div class="glass-panel" style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
                <div style="font-weight: 600; text-align: center; margin-bottom: clamp(6px, 1vh, 16px); font-size: clamp(13px, 1.5vw, 17px);">
                    ${isFlags ? 'Judge Flags' : 'Judge Scores'} (${numJudges} Judges)
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: clamp(8px, 1vw, 16px); margin-bottom: clamp(8px, 1vh, 16px);">
                    ${Array.from({ length: numJudges }, (_, i) => `
                        <div style="text-align: center;">
                            <div style="font-size: clamp(11px, 1.2vw, 14px); color: var(--text-secondary); margin-bottom: clamp(4px, 0.5vh, 8px);">Judge ${i + 1}</div>
                            ${isFlags ? `
                                <button
                                    id="judge-${i}-btn"
                                    onclick="toggleKataFlag(${i})"
                                    style="width: 100%; padding: clamp(10px, 1.5vh, 20px); border-radius: 10px; font-size: clamp(14px, 1.8vw, 18px); font-weight: 700; cursor: pointer; transition: all 0.2s; background: var(--bg-secondary); border: 2px solid var(--glass-border); color: var(--text-secondary);">
                                    ⚐ Flag
                                </button>
                            ` : `
                                <input
                                    type="number"
                                    id="judge-${i}-score"
                                    min="${scoringRange.min}"
                                    max="${scoringRange.max}"
                                    step="0.1"
                                    value="${scoringRange.min}"
                                    onchange="updateKataScore(${i}, this.value)"
                                    style="width: 100%; padding: clamp(8px, 1.2vh, 16px); border-radius: 10px; font-size: clamp(18px, 2.5vw, 24px); font-weight: 700; text-align: center; background: var(--bg-secondary); color: var(--text-primary); border: 2px solid var(--glass-border);">
                            `}
                        </div>
                    `).join('')}
                </div>

                ${!isFlags ? `
                    <div style="text-align: center; padding: clamp(8px, 1vh, 16px); background: rgba(220, 38, 38, 0.1); border-radius: 10px; border: 1px solid #dc2626;">
                        <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">Total Score</div>
                        <div id="kata-total-score" style="font-size: clamp(32px, 4vh, 48px); font-weight: 900; color: #dc2626;">0.0</div>
                        <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">Average: <span id="kata-avg-score">0.0</span></div>
                    </div>
                ` : ''}
            </div>

            <div class="glass-panel" style="text-align: center; flex-shrink: 0;">
                <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                    <button class="btn btn-primary" onclick="submitKataScores(${isFlags})" style="background: #22c55e; font-size: clamp(13px, 1.4vw, 16px); padding: clamp(6px, 1vh, 12px) 16px;">
                        ✓ Submit & Next
                    </button>
                    <button class="btn btn-secondary" onclick="resetKataScores(${isFlags})" style="font-size: clamp(13px, 1.4vw, 16px); padding: clamp(6px, 1vh, 12px) 16px;">
                        ↺ Reset
                    </button>
                </div>
            </div>

            ${currentKataPerformanceIndex > 0 ? `
                <div class="glass-panel" style="flex-shrink: 0;">
                    <div style="font-weight: 600; margin-bottom: 6px; text-align: center; font-size: 13px;">Rankings</div>
                    <div id="kata-leaderboard" style="max-height: clamp(80px, 12vh, 180px); overflow-y: auto;"></div>
                </div>
            ` : ''}
        </div>
    `;

    // Update leaderboard
    updateKataLeaderboard(bracket);

    // Show/hide Edit Results button
    updateEditResultsButtonVisibility(bracket);

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

function toggleKataFlag(judgeIndex) {
    kataJudgeScores[judgeIndex] = !kataJudgeScores[judgeIndex];

    const btn = document.getElementById(`judge-${judgeIndex}-btn`);
    if (kataJudgeScores[judgeIndex]) {
        btn.style.background = '#22c55e';
        btn.style.borderColor = '#22c55e';
        btn.style.color = 'white';
        btn.textContent = '⚑ Raised';
    } else {
        btn.style.background = 'var(--bg-secondary)';
        btn.style.borderColor = 'var(--glass-border)';
        btn.style.color = 'var(--text-secondary)';
        btn.textContent = '⚐ Flag';
    }
}

function updateKataScore(judgeIndex, value) {
    kataJudgeScores[judgeIndex] = parseFloat(value) || 0;

    const total = kataJudgeScores.reduce((sum, score) => sum + score, 0);
    const average = total / kataJudgeScores.length;

    document.getElementById('kata-total-score').textContent = total.toFixed(1);
    document.getElementById('kata-avg-score').textContent = average.toFixed(2);
}

function resetKataScores(isFlags) {
    if (isFlags) {
        kataJudgeScores = kataJudgeScores.map(() => false);
        document.querySelectorAll('[id^="judge-"][id$="-btn"]').forEach((btn, i) => {
            btn.style.background = 'var(--bg-secondary)';
            btn.style.borderColor = 'var(--glass-border)';
            btn.style.color = 'var(--text-secondary)';
            btn.textContent = '⚐ Flag';
        });
    } else {
        kataJudgeScores = kataJudgeScores.map(() => 0);
        document.querySelectorAll('[id^="judge-"][id$="-score"]').forEach(input => {
            input.value = 0;
        });
        document.getElementById('kata-total-score').textContent = '0.0';
        document.getElementById('kata-avg-score').textContent = '0.0';
    }
}

function submitKataScores(isFlags) {
    if (!currentKataCompetitor) {
        showMessage('No competitor loaded', 'error');
        return;
    }

    let finalScore;
    if (isFlags) {
        finalScore = kataJudgeScores.filter(f => f === true).length;
    } else {
        const total = kataJudgeScores.reduce((sum, score) => sum + score, 0);
        finalScore = total / kataJudgeScores.length;
    }

    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
    let bracketId = null;

    for (const id in brackets) {
        const bracket = brackets[id];
        if ((bracket.division === currentOperatorDivision || bracket.divisionName === currentOperatorDivision) && bracket.eventId == currentOperatorEventId) {
            bracketId = id;

            const performance = bracket.rounds[currentKataRound.roundNumber - 1].performances[currentKataPerformanceIndex];
            performance.scores = [...kataJudgeScores];
            performance.totalScore = isFlags ? finalScore : kataJudgeScores.reduce((sum, s) => sum + s, 0);
            performance.averageScore = finalScore;
            performance.completed = true;

            saveBrackets(brackets);
            break;
        }
    }

    showMessage(`Score recorded: ${finalScore.toFixed(isFlags ? 0 : 2)}`);

    setTimeout(() => {
        currentKataPerformanceIndex++;

        if (currentKataPerformanceIndex < currentKataRound.performances.length) {
            openKataScoreboard(currentOperatorMat, currentOperatorDivision, currentOperatorEventId, brackets[bracketId], currentKataScoreboardType);
        } else {
            // Round complete — check if the entire bracket is done
            const divisionComplete = checkBracketComplete(currentOperatorDivision, currentOperatorEventId);
            if (divisionComplete) {
                showMessage('Division complete! All competitors have performed.');
                setTimeout(() => {
                    const results = getDivisionResults(currentOperatorDivision, currentOperatorEventId);
                    showDivisionCompleteCountdown(currentOperatorMat, currentOperatorDivision, currentOperatorEventId, results);
                }, 1500);
            } else {
                showMessage('Round complete! All competitors have performed.');
                closeOperatorScoreboard();
            }
        }
    }, 1500);
}

function updateKataLeaderboard(bracket) {
    const leaderboard = document.getElementById('kata-leaderboard');
    if (!leaderboard) return;

    const performances = currentKataRound.performances
        .filter(p => p.completed)
        .sort((a, b) => b.averageScore - a.averageScore);

    if (performances.length === 0) {
        leaderboard.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No scores yet</p>';
        return;
    }

    leaderboard.innerHTML = performances.map((perf, idx) => `
        <div style="display: flex; justify-content: space-between; padding: 12px; background: ${idx === 0 ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-secondary)'}; border-radius: 8px; margin-bottom: 8px; border: 1px solid ${idx === 0 ? '#22c55e' : 'var(--glass-border)'};">
            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 20px; font-weight: 700; color: ${idx === 0 ? '#22c55e' : 'var(--text-primary)'};">${idx + 1}</span>
                <span style="font-weight: 600;">${perf.competitor.firstName} ${perf.competitor.lastName}</span>
            </div>
            <div style="font-size: 18px; font-weight: 700; color: ${idx === 0 ? '#22c55e' : '#dc2626'};">
                ${perf.averageScore.toFixed(bracket.type === 'kata-flags' ? 0 : 2)}
            </div>
        </div>
    `).join('');
}

function openRankingListScoreboard(matId, divisionName, eventId, bracket, scoreboardType) {
    console.log('=== OPEN RANKING LIST SCOREBOARD ===');
    console.log('Bracket:', bracket);
    console.log('Entries:', bracket.entries);

    // Set active scoreboard type so openTVDisplayFromOperator() knows which TV file to open
    activeScoreboardType = scoreboardType; // e.g. 'kata-points', 'kobudo'
    console.log('Active scoreboard type set to:', scoreboardType);

    currentOperatorMat = matId;
    currentOperatorDivision = divisionName;
    currentOperatorEventId = eventId;

    const mats = JSON.parse(localStorage.getItem(_scopedKey('mats')) || '[]');
    const mat = mats.find(m => m.id == matId);
    const matName = mat ? mat.name : `Mat ${matId}`;

    const entries = bracket.entries || [];
    const scoringRange = bracket.scoringRange || bracket.scoreboardConfig?.settings?.scoringRange || { min: 0, max: 10 };
    const numJudges = bracket.scoreboardConfig?.settings?.judges || bracket.numJudges || 5;
    console.log('Entries count:', entries.length, 'Judges:', numJudges, 'Scoring range:', scoringRange);

    // Find next unscored entry
    const currentIndex = entries.findIndex(e => e.status === 'pending');
    const scoredCount = entries.filter(e => e.status === 'scored').length;

    // Build ranked list of scored entries
    const scoredEntries = entries
        .filter(e => e.status === 'scored' && e.score !== null)
        .sort((a, b) => b.score - a.score);

    const modal = document.getElementById('operator-scoreboard-modal');
    const title = document.getElementById('scoreboard-title');
    const content = document.getElementById('operator-scoreboard-content');

    title.textContent = `${matName} - ${divisionName} (Ranking List)`;

    const currentEntry = currentIndex >= 0 ? entries[currentIndex] : null;
    const competitor = currentEntry?.competitor;

    const rlDivProgressHTML = buildDivisionProgressHTML(matId, divisionName, eventId);
    content.innerHTML = `
        <div class="kata-scoreboard">
            <div class="glass-panel" style="text-align: center; flex-shrink: 0;">
                <div style="font-weight: 600; font-size: clamp(13px, 1.5vw, 16px);">Ranking List - Individual Scoring</div>
                <div style="color: var(--text-secondary); font-size: clamp(11px, 1.2vw, 14px);">Competitor ${scoredCount + 1} of ${entries.length}</div>
                ${rlDivProgressHTML}
            </div>

            ${currentEntry ? `
                <div class="glass-panel" style="text-align: center; background: linear-gradient(135deg, rgba(220, 38, 38, 0.1), rgba(220, 38, 38, 0.05)); border: 2px solid #dc2626; flex-shrink: 0;">
                    <div style="font-size: clamp(20px, 2.5vw, 32px); font-weight: 700; color: #dc2626;">
                        ${competitor ? `${competitor.firstName} ${competitor.lastName}`.toUpperCase() : 'NO COMPETITOR'}
                    </div>
                    ${competitor ? `
                        <div style="font-size: clamp(12px, 1.3vw, 16px); color: var(--text-secondary); margin-top: 4px;">
                            ${getDisplayAge(competitor)} yrs | ${competitor.rank || '-'}
                            ${competitor.club ? ` | ${competitor.club}` : ''}
                        </div>
                    ` : ''}
                </div>

                <div class="glass-panel" style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
                    <div style="font-weight: 600; text-align: center; margin-bottom: clamp(6px, 1vh, 16px); font-size: clamp(13px, 1.5vw, 17px);">Judge Scores (${numJudges} Judges)</div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: clamp(8px, 1vw, 16px); margin-bottom: clamp(8px, 1vh, 16px);">
                        ${Array.from({ length: numJudges }, (_, i) => `
                            <div style="text-align: center;">
                                <div style="font-size: clamp(11px, 1.2vw, 14px); color: var(--text-secondary); margin-bottom: clamp(4px, 0.5vh, 8px);">Judge ${i + 1}</div>
                                <input
                                    type="number"
                                    id="rl-judge-${i}-score"
                                    min="${scoringRange.min}"
                                    max="${scoringRange.max}"
                                    step="0.1"
                                    value=""
                                    placeholder="0.0"
                                    oninput="updateRankingListTotal(${numJudges})"
                                    style="width: 100%; padding: clamp(8px, 1.2vh, 16px); border-radius: 10px; font-size: clamp(18px, 2.5vw, 24px); font-weight: 700; text-align: center; background: var(--bg-secondary); color: var(--text-primary); border: 2px solid var(--glass-border);">
                            </div>
                        `).join('')}
                    </div>

                    <div style="text-align: center; padding: clamp(8px, 1vh, 16px); background: rgba(220, 38, 38, 0.1); border-radius: 10px; border: 1px solid #dc2626;">
                        <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">Total Score</div>
                        <div id="rl-total-score" style="font-size: clamp(32px, 4vh, 48px); font-weight: 900; color: #dc2626;">0.0</div>
                        <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">Average: <span id="rl-avg-score">0.0</span></div>
                    </div>
                </div>

                <div class="glass-panel" style="text-align: center; flex-shrink: 0;">
                    <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                        <button class="btn btn-primary" onclick="submitRankingListScore(${numJudges})" style="background: #22c55e; font-size: clamp(13px, 1.4vw, 16px); padding: clamp(6px, 1vh, 12px) 16px;">
                            ✓ Submit & Next
                        </button>
                        <button class="btn btn-secondary" onclick="resetRankingListScores(${numJudges})" style="font-size: clamp(13px, 1.4vw, 16px); padding: clamp(6px, 1vh, 12px) 16px;">
                            ↺ Reset
                        </button>
                    </div>
                </div>
            ` : `
                <div class="glass-panel" style="text-align: center; flex-shrink: 0;">
                    <div style="font-size: 36px; margin-bottom: 8px;">✅</div>
                    <h3 style="margin-bottom: 8px;">All Competitors Scored</h3>
                    <p style="color: var(--text-secondary);">All ${entries.length} competitors have been scored.</p>
                </div>
            `}

            ${scoredEntries.length > 0 ? `
                <div class="glass-panel" style="flex-shrink: 0;">
                    <div style="font-weight: 600; margin-bottom: 6px; text-align: center; font-size: 13px;">Rankings</div>
                    <div style="max-height: clamp(80px, 12vh, 180px); overflow-y: auto;">
                        ${scoredEntries.map((entry, idx) => {
                            const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
                            const color = idx < 3 ? colors[idx] : 'var(--text-secondary)';
                            const comp = entry.competitor;
                            return `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; border-bottom: 1px solid var(--glass-border); font-size: 13px;">
                                    <div>
                                        <span style="font-weight: 700; color: ${color}; margin-right: 6px;">#${idx + 1}</span>
                                        ${comp.firstName} ${comp.lastName}
                                        <span style="color: var(--text-secondary); font-size: 11px; margin-left: 4px;">${comp.club || ''}</span>
                                    </div>
                                    <div style="font-size: 15px; font-weight: 700; color: ${color};">
                                        ${entry.score.toFixed(2)}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    // Show/hide Edit Results button
    updateEditResultsButtonVisibility(bracket);

    // Sync to TV display
    updateRankingListTVDisplay(bracket, 'scoring');
}

// Build competitor info line, gracefully handling missing/invalid age
function buildCompetitorInfoLine(competitor) {
    if (!competitor) return '';
    const parts = [];
    const age = getDisplayAge(competitor);
    if (age && age !== '-' && age > 0) parts.push(`${age} yrs`);
    if (competitor.rank) parts.push(competitor.rank);
    if (competitor.club) parts.push(competitor.club);
    return parts.join(' | ');
}

// Store current bracket reference for TV sync
let currentRankingListBracket = null;
let currentRankingListNumJudges = 5;

function updateRankingListTVDisplay(bracket, status) {
    currentRankingListBracket = bracket;

    const mats = JSON.parse(localStorage.getItem(_scopedKey('mats')) || '[]');
    const mat = mats.find(m => m.id == currentOperatorMat);
    const matName = mat ? mat.name : `Mat ${currentOperatorMat}`;

    const eventTypes = JSON.parse(localStorage.getItem(_scopedKey('eventTypes')) || '[]');
    const eventType = eventTypes.find(e => e.id == currentOperatorEventId);
    const eventName = eventType?.name || 'Kata';

    const entries = bracket.entries || [];
    const currentIndex = entries.findIndex(e => e.status === 'pending');
    const scoredCount = entries.filter(e => e.status === 'scored').length;
    const currentEntry = currentIndex >= 0 ? entries[currentIndex] : null;
    const competitor = rehydrateCompetitor(currentEntry?.competitor || null);
    const numJudges = bracket.scoreboardConfig?.settings?.judges || bracket.numJudges || 5;
    currentRankingListNumJudges = numJudges;

    // Get current judge scores from DOM
    const judgeScores = [];
    for (let i = 0; i < numJudges; i++) {
        const val = parseFloat(document.getElementById(`rl-judge-${i}-score`)?.value);
        judgeScores.push(isNaN(val) ? null : val);
    }

    // Calculate total/average from entered scores
    const enteredScores = judgeScores.filter(s => s !== null);
    const totalScore = enteredScores.reduce((sum, s) => sum + s, 0);
    const avgScore = enteredScores.length > 0 ? totalScore / enteredScores.length : 0;

    // Next competitor
    let nextCompetitor = null;
    if (currentIndex >= 0 && currentIndex + 1 < entries.length) {
        nextCompetitor = entries[currentIndex + 1]?.competitor || null;
    }

    // Build rankings from scored entries
    const rankings = entries
        .filter(e => e.status === 'scored' && e.score !== null)
        .sort((a, b) => b.score - a.score)
        .map((e, idx) => ({
            rank: idx + 1,
            name: `${e.competitor.firstName} ${e.competitor.lastName}`.toUpperCase(),
            club: e.competitor.club || '',
            score: e.score
        }));

    // Get club logo if available
    let clubLogo = null;
    if (competitor?.club) {
        const clubs = JSON.parse(localStorage.getItem(_scopedKey('clubs')) || '[]');
        const club = clubs.find(c => c.name === competitor.club);
        clubLogo = club?.logo || null;
    }

    const state = {
        scoreboardType: 'kata',
        matName: matName,
        divisionName: currentOperatorDivision || 'Division',
        eventName: eventName,
        scoringMode: 'ranking-list',
        status: status, // 'scoring', 'submitted', 'complete'

        // Current competitor
        competitorName: competitor ? `${competitor.firstName} ${competitor.lastName}`.toUpperCase() : '',
        competitorInfo: competitor ? buildCompetitorInfoLine(competitor) : '',
        competitorPhoto: competitor?.photo || null,
        competitorClub: competitor?.club || null,
        competitorClubLogo: clubLogo,
        competitorAge: competitor ? (getDisplayAge(competitor) || null) : null,
        competitorRank: competitor?.rank || null,
        competitorWeight: competitor?.weight || null,
        competitorNumber: scoredCount + 1,
        totalCompetitors: entries.length,

        // Judge scores (real-time)
        judgeScores: judgeScores,
        numJudges: numJudges,
        totalScore: totalScore,
        avgScore: avgScore,

        // Next competitor
        nextCompetitorName: nextCompetitor ? `${nextCompetitor.firstName} ${nextCompetitor.lastName}`.toUpperCase() : null,
        nextCompetitorInfo: nextCompetitor ? `${nextCompetitor.club || ''}` : null,
        isLastCompetitor: currentIndex >= 0 && currentIndex === entries.length - 1,

        // Rankings
        rankings: rankings
    };

    localStorage.setItem(_scopedKey('scoreboard-state'), JSON.stringify(state));
}

function updateRankingListTotal(numJudges) {
    let total = 0;
    let count = 0;
    for (let i = 0; i < numJudges; i++) {
        const val = parseFloat(document.getElementById(`rl-judge-${i}-score`)?.value);
        if (!isNaN(val)) {
            total += val;
            count++;
        }
    }
    document.getElementById('rl-total-score').textContent = total.toFixed(1);
    document.getElementById('rl-avg-score').textContent = count > 0 ? (total / count).toFixed(2) : '0.0';

    // Sync to TV display in real-time
    if (currentRankingListBracket) {
        updateRankingListTVDisplay(currentRankingListBracket, 'scoring');
    }
}

function resetRankingListScores(numJudges) {
    for (let i = 0; i < numJudges; i++) {
        const input = document.getElementById(`rl-judge-${i}-score`);
        if (input) input.value = '';
    }
    document.getElementById('rl-total-score').textContent = '0.0';
    document.getElementById('rl-avg-score').textContent = '0.0';

    // Sync to TV display
    if (currentRankingListBracket) {
        updateRankingListTVDisplay(currentRankingListBracket, 'scoring');
    }
}

function submitRankingListScore(numJudges) {
    // Collect judge scores
    let total = 0;
    let count = 0;
    for (let i = 0; i < numJudges; i++) {
        const val = parseFloat(document.getElementById(`rl-judge-${i}-score`)?.value);
        if (!isNaN(val)) {
            total += val;
            count++;
        }
    }

    if (count === 0) {
        showMessage('Please enter at least one judge score', 'error');
        return;
    }

    const avgScore = total / count;

    // Find the bracket and update the current entry
    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
    let targetBracketId = null;

    for (const [bracketId, bracket] of Object.entries(brackets)) {
        if (bracket.eventId == currentOperatorEventId &&
            (bracket.division === currentOperatorDivision || bracket.divisionName === currentOperatorDivision)) {
            targetBracketId = bracketId;
            break;
        }
    }

    if (!targetBracketId) {
        showMessage('Bracket not found!', 'error');
        return;
    }

    const bracket = brackets[targetBracketId];
    const pendingIndex = bracket.entries.findIndex(e => e.status === 'pending');

    if (pendingIndex === -1) {
        showMessage('All competitors already scored', 'error');
        return;
    }

    // Update entry
    bracket.entries[pendingIndex].score = avgScore;
    bracket.entries[pendingIndex].status = 'scored';
    bracket.entries[pendingIndex].judgeScores = [];
    for (let i = 0; i < numJudges; i++) {
        const val = parseFloat(document.getElementById(`rl-judge-${i}-score`)?.value);
        bracket.entries[pendingIndex].judgeScores.push(isNaN(val) ? 0 : val);
    }

    // Re-rank all scored entries
    const scored = bracket.entries.filter(e => e.status === 'scored');
    scored.sort((a, b) => b.score - a.score);
    scored.forEach((entry, idx) => {
        entry.rank = idx + 1;
    });

    // Check if all done
    const allScored = bracket.entries.every(e => e.status === 'scored');
    if (allScored) {
        bracket.status = 'completed';
    }

    // Save
    saveBrackets(brackets);

    // Sync 'submitted' status to TV (brief hold before transition)
    updateRankingListTVDisplay(bracket, allScored ? 'complete' : 'submitted');

    if (allScored) {
        // All done — show results + countdown to next division
        showMessage(`Score submitted: ${avgScore.toFixed(2)} — Division complete!`, 'success');

        // Brief delay to let TV display show the final score reveal, then show countdown
        setTimeout(() => {
            const results = getDivisionResults(currentOperatorDivision, currentOperatorEventId);
            showDivisionCompleteCountdown(currentOperatorMat, currentOperatorDivision, currentOperatorEventId, results);
        }, 3000);
    } else {
        // Re-open to show next competitor
        openRankingListScoreboard(
            currentOperatorMat,
            currentOperatorDivision,
            currentOperatorEventId,
            bracket,
            currentKataScoreboardType
        );

        showMessage(`Score submitted: ${avgScore.toFixed(2)}`, 'success');
    }
}

function closeOperatorScoreboard() {
    // Cancel any auto-advance countdown
    cancelAutoAdvance();

    // Stop timer and clear interval
    operatorPauseTimer();

    // Clean up kata-flags click handler to prevent handler accumulation
    if (window._kataFlagsClickHandler) {
        window.removeEventListener('click', window._kataFlagsClickHandler, true);
        window._kataFlagsClickHandler = null;
    }

    // Disable keyboard shortcuts
    operatorKeyboardEnabled = false;
    document.removeEventListener('keydown', handleOperatorKeyboard);

    // Clear the modal UI
    document.getElementById('operator-scoreboard-modal').classList.add('hidden');

    // Clear active scoreboard type
    activeScoreboardType = null;
    console.log('Active scoreboard type cleared');

    // Reset operator scoreboard state variables
    currentOperatorMat = null;
    currentOperatorDivision = null;
    currentOperatorEventId = null;
    operatorRedScore = 0;
    operatorBlueScore = 0;
    operatorRedPenalties = 0;
    operatorBluePenalties = 0;
    operatorTimeRemaining = operatorMatchDuration;

    // Clear any lingering timer interval (defensive programming)
    if (operatorTimerInterval) {
        clearInterval(operatorTimerInterval);
        operatorTimerInterval = null;
    }

    console.log('Operator scoreboard closed and cleaned up');
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-ADVANCE: Division complete → countdown → next division
// ═══════════════════════════════════════════════════════════════════════════

let autoAdvanceTimer = null;
let autoAdvanceCountdown = 10;

function findNextScheduledDivision(matId, currentDivisionName, currentEventId) {
    const matScheduleData = loadMatScheduleData();
    const schedule = (matScheduleData[matId] || []).sort((a, b) => (a.order || 0) - (b.order || 0));
    const currentIdx = schedule.findIndex(s => s.division === currentDivisionName && s.eventId == currentEventId);

    if (currentIdx === -1 || currentIdx >= schedule.length - 1) return null;

    // Find next non-completed division
    for (let i = currentIdx + 1; i < schedule.length; i++) {
        if (schedule[i].status !== 'completed') return schedule[i];
    }
    return null;
}

// Get division position within the mat schedule (which division # out of total)
function getMatSchedulePosition(matId, divisionName, eventId) {
    const matScheduleData = loadMatScheduleData();
    const schedule = (matScheduleData[matId] || []).sort((a, b) => (a.order || 0) - (b.order || 0));
    const currentIdx = schedule.findIndex(s => s.division === divisionName && s.eventId == eventId);
    const total = schedule.length;
    const current = currentIdx >= 0 ? currentIdx + 1 : null;
    const isLast = currentIdx === total - 1;
    const completedCount = schedule.filter(s => s.status === 'completed').length;
    return { current, total, isLast, completedCount };
}

// Build HTML snippet for division progress counter
function buildDivisionProgressHTML(matId, divisionName, eventId) {
    const progress = getMatSchedulePosition(matId, divisionName, eventId);
    if (!progress.current || progress.total <= 1) return '';
    if (progress.isLast) {
        return `<div style="font-size: 11px; color: #ff9500; font-weight: 600; margin-top: 2px;">Division ${progress.current} of ${progress.total} — FINAL DIVISION 🏁</div>`;
    }
    return `<div style="font-size: 11px; color: var(--text-tertiary); margin-top: 2px;">Division ${progress.current} of ${progress.total}</div>`;
}

// Build HTML snippet for match progress bar within a bracket
function buildMatchProgressHTML(bracket) {
    if (!bracket) return '';
    const allMatches = [
        ...(bracket.matches || []),
        ...(bracket.winners || []),
        ...(bracket.losers || []),
        ...(bracket.repechageA || []),
        ...(bracket.repechageB || [])
    ];
    if (bracket.finals) allMatches.push(bracket.finals);
    if (bracket.reset) allMatches.push(bracket.reset);

    // Count real matches (non-empty, non-bye, with at least one competitor)
    const realMatches = allMatches.filter(m => m.status !== 'empty' && m.status !== 'bye' && (m.redCorner || m.blueCorner));
    const completedCount = realMatches.filter(m => m.status === 'completed').length;
    const totalCount = realMatches.length;
    if (totalCount === 0) return '';

    const currentMatchNum = completedCount + 1;
    const percent = Math.round((completedCount / totalCount) * 100);

    return `
        <div style="margin-top: 6px;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">
                <span style="font-weight: 600;">Match ${Math.min(currentMatchNum, totalCount)} of ${totalCount}</span>
                <span style="opacity: 0.6;">(${percent}%)</span>
            </div>
            <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; max-width: 300px; margin: 0 auto;">
                <div style="width: ${percent}%; height: 100%; background: linear-gradient(90deg, #dc2626, #ff4444); border-radius: 3px; transition: width 0.5s ease;"></div>
            </div>
        </div>
    `;
}

function checkBracketComplete(divisionName, eventId) {
    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');

    for (const id in brackets) {
        const bracket = brackets[id];
        if ((bracket.division === divisionName || bracket.divisionName === divisionName) && bracket.eventId == eventId) {
            if (bracket.type === 'ranking-list') {
                return bracket.entries?.every(e => e.status === 'scored') || false;
            } else if (bracket.type === 'single-elimination') {
                // Check if all non-empty, non-bye matches are complete
                // Include matches with only one corner (still waiting for feeder) to prevent premature completion
                const realMatches = (bracket.matches || []).filter(m => m.status !== 'empty' && m.status !== 'bye' && (m.redCorner || m.blueCorner));
                return realMatches.length > 0 && realMatches.every(m => m.status === 'completed');
            } else if (bracket.type === 'round-robin') {
                const realMatches = (bracket.matches || []).filter(m => m.redCorner && m.blueCorner);
                return realMatches.length > 0 && realMatches.every(m => m.status === 'completed');
            } else if (bracket.type === 'double-elimination') {
                // Check winners, losers, finals, and reset
                const realWinners = (bracket.winners || []).filter(m => m.redCorner && m.blueCorner);
                const realLosers = (bracket.losers || []).filter(m => m.redCorner && m.blueCorner);
                if (realWinners.length === 0 && realLosers.length === 0) return false;
                const winnersComplete = realWinners.every(m => m.status === 'completed');
                const losersComplete = realLosers.every(m => m.status === 'completed');
                const finalsComplete = !bracket.finals || !bracket.finals.redCorner || !bracket.finals.blueCorner ||
                    bracket.finals.status === 'completed';
                // If finals winner is WB champion (redCorner), no reset needed
                const finalsWBWon = bracket.finals?.winner && bracket.finals.redCorner &&
                    bracket.finals.winner.id === bracket.finals.redCorner.id;
                const resetComplete = !bracket.reset || bracket.reset.status === 'completed';
                return winnersComplete && losersComplete && finalsComplete && (finalsWBWon || !bracket.finals?.winner || resetComplete);
            } else if (bracket.type === 'repechage') {
                // Main bracket must be complete (include matches with only one corner to prevent premature completion)
                const realMain = (bracket.matches || []).filter(m => m.status !== 'empty' && m.status !== 'bye' && (m.redCorner || m.blueCorner));
                const mainComplete = realMain.length > 0 && realMain.every(m => m.status === 'completed');
                if (!mainComplete) return false;
                // Repechage brackets must also be complete
                if (bracket.repechageGenerated) {
                    const realRepA = (bracket.repechageA || []).filter(m => m.status !== 'empty' && m.status !== 'bye' && (m.redCorner || m.blueCorner));
                    const realRepB = (bracket.repechageB || []).filter(m => m.status !== 'empty' && m.status !== 'bye' && (m.redCorner || m.blueCorner));
                    const repAComplete = realRepA.length === 0 || realRepA.every(m => m.status === 'completed');
                    const repBComplete = realRepB.length === 0 || realRepB.every(m => m.status === 'completed');
                    return repAComplete && repBComplete;
                }
                return false; // Repechage not yet generated means not complete
            } else if (bracket.type === 'pool-play') {
                if (!bracket.pools || bracket.pools.length === 0) return false;
                let allComplete = true;
                let hasMatches = false;
                bracket.pools.forEach(pool => {
                    const poolMatches = (pool.matches || []).filter(m => m.redCorner && m.blueCorner);
                    if (poolMatches.length > 0) hasMatches = true;
                    if (!poolMatches.every(m => m.status === 'completed')) allComplete = false;
                });
                return hasMatches && allComplete;
            } else if (bracket.type === 'kata-flags' || bracket.type === 'kata-points') {
                const rounds = bracket.rounds || [];
                return rounds.length > 0 && rounds.every(round =>
                    (round.performances || []).every(p => p.completed)
                );
            }
            return bracket.status === 'completed';
        }
    }
    return false;
}

function showDivisionCompleteCountdown(matId, divisionName, eventId, resultsSummary) {
    // Clear any existing auto-advance timer
    cancelAutoAdvance();

    // Clear winner from audience display so celebration overlay goes away
    try {
        const currentState = JSON.parse(localStorage.getItem(_scopedKey('scoreboard-state')) || '{}');
        currentState.winner = null;
        localStorage.setItem(_scopedKey('scoreboard-state'), JSON.stringify(currentState));
    } catch(e) {}

    // Mark division completed in schedule
    markDivisionCompleted(matId, divisionName);

    // Refresh schedule timeline to show updated progress
    if (typeof loadScheduleGrid === 'function') {
        loadScheduleGrid();
    }

    const nextDivision = findNextScheduledDivision(matId, divisionName, eventId);
    const divProgress = getMatSchedulePosition(matId, divisionName, eventId);
    const content = document.getElementById('operator-scoreboard-content');
    if (!content) return;

    // Get mat name
    const mats = JSON.parse(localStorage.getItem(_scopedKey('mats')) || '[]');
    const mat = mats.find(m => m.id == matId);
    const matName = mat ? mat.name : `Mat ${matId}`;

    // Build results summary HTML
    let resultsHTML = '';
    if (resultsSummary && resultsSummary.length > 0) {
        resultsHTML = `
            <div class="glass-panel" style="margin-bottom: 20px; padding: 20px;">
                <h4 style="text-align: center; margin-bottom: 16px;">Final Results</h4>
                <div style="max-height: 200px; overflow-y: auto;">
                    ${resultsSummary.map((result, idx) => {
                        const medals = ['🥇', '🥈', '🥉'];
                        const medal = idx < 3 ? medals[idx] : `#${idx + 1}`;
                        const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
                        const color = idx < 3 ? colors[idx] : 'var(--text-secondary)';
                        return `
                            <div style="display: flex; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--glass-border);">
                                <span style="font-size: 20px; margin-right: 12px;">${medal}</span>
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; color: ${color};">${result.name}</div>
                                    ${result.club ? `<div style="font-size: 11px; color: var(--text-secondary);">${result.club}</div>` : ''}
                                </div>
                                ${result.score !== undefined ? `<div style="font-weight: 700; color: ${color}; font-size: 16px;">${typeof result.score === 'number' ? result.score.toFixed(2) : result.score}</div>` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    // Build next division info
    let nextDivHTML = '';
    if (nextDivision) {
        // Check if next division has a bracket
        const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
        let hasBracket = false;
        for (const id in brackets) {
            if ((brackets[id].division === nextDivision.division || brackets[id].divisionName === nextDivision.division) && brackets[id].eventId == nextDivision.eventId) {
                hasBracket = true;
                break;
            }
        }

        const eventTypes = JSON.parse(localStorage.getItem(_scopedKey('eventTypes')) || '[]');
        const nextEvent = eventTypes.find(e => e.id == nextDivision.eventId);

        nextDivHTML = `
            <div class="glass-panel" style="margin-bottom: 20px; padding: 20px; background: rgba(220, 38, 38, 0.1); border-color: #dc2626;">
                <h4 style="text-align: center; margin-bottom: 12px; color: #dc2626;">Up Next</h4>
                <div style="text-align: center; font-size: 18px; font-weight: 700; margin-bottom: 4px;">${nextDivision.division}</div>
                <div style="text-align: center; font-size: 13px; color: var(--text-secondary);">${nextEvent?.name || ''}</div>
                ${!hasBracket ? `
                    <div style="text-align: center; margin-top: 8px; padding: 6px 12px; background: rgba(255, 149, 0, 0.2); border-radius: 6px; font-size: 12px; color: #ff9500;">
                        ⚠️ No bracket created yet
                    </div>
                ` : ''}
            </div>

            <div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">Auto-advancing in</div>
                <div id="auto-advance-countdown" style="font-size: 64px; font-weight: 900; color: #dc2626; font-variant-numeric: tabular-nums;">${autoAdvanceCountdown}</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">seconds</div>
            </div>

            <div style="text-align: center; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                <button class="btn btn-primary" onclick="advanceToNextDivisionNow()" style="font-size: 14px;">
                    ▶ Go Now
                </button>
                <button class="btn btn-secondary" onclick="cancelAutoAdvance()" style="font-size: 14px;">
                    ✕ Cancel
                </button>
            </div>
        `;
    } else {
        nextDivHTML = `
            <div class="glass-panel" style="margin-bottom: 20px; padding: 30px; text-align: center; background: rgba(34, 197, 94, 0.1); border-color: #22c55e;">
                <div style="font-size: 48px; margin-bottom: 16px;">🏁</div>
                <h3 style="color: #22c55e; margin-bottom: 8px;">All Divisions Complete</h3>
                <p style="color: var(--text-secondary);">No more divisions scheduled on ${matName}.</p>
            </div>
            <div style="text-align: center;">
                <button class="btn btn-secondary" onclick="closeOperatorScoreboard()" style="font-size: 14px;">
                    Close Scoreboard
                </button>
            </div>
        `;
    }

    content.innerHTML = `
        <div style="max-height: 75vh; overflow-y: auto;">
            <div class="glass-panel" style="margin-bottom: 20px; text-align: center; padding: 20px; background: rgba(34, 197, 94, 0.1); border-color: #22c55e;">
                <div style="font-size: 32px; margin-bottom: 8px;">${divProgress.isLast ? '🏁' : '✅'}</div>
                <h3 style="color: #22c55e; margin-bottom: 4px;">${divProgress.isLast ? 'Final Division Complete!' : 'Division Complete'}</h3>
                <p style="color: var(--text-secondary); font-size: 14px;">${divisionName}</p>
                ${divProgress.current ? `<p style="color: ${divProgress.isLast ? '#ff9500' : 'var(--text-tertiary)'}; font-size: 12px; font-weight: ${divProgress.isLast ? '600' : '400'}; margin-top: 4px;">${divProgress.isLast ? `All ${divProgress.total} divisions complete 🏁` : `Division ${divProgress.current} of ${divProgress.total} complete`}</p>` : ''}
            </div>
            ${resultsHTML}
            ${nextDivHTML}
        </div>
    `;

    // Start countdown if there's a next division
    if (nextDivision) {
        autoAdvanceCountdown = 10;
        autoAdvanceTimer = setInterval(() => {
            autoAdvanceCountdown--;
            const countdownEl = document.getElementById('auto-advance-countdown');
            if (countdownEl) {
                countdownEl.textContent = autoAdvanceCountdown;
            }
            if (autoAdvanceCountdown <= 0) {
                advanceToNextDivisionNow();
            }
        }, 1000);
    }
}

function advanceToNextDivisionNow() {
    cancelAutoAdvance();

    const matId = currentOperatorMat;
    const divisionName = currentOperatorDivision;
    const eventId = currentOperatorEventId;

    if (!matId || !divisionName) {
        closeOperatorScoreboard();
        return;
    }

    const nextDivision = findNextScheduledDivision(matId, divisionName, eventId);
    if (nextDivision) {
        // Open next division's operator scoreboard
        openOperatorScoreboard(matId, nextDivision.division, nextDivision.eventId);
    } else {
        closeOperatorScoreboard();
    }
}

function cancelAutoAdvance() {
    if (autoAdvanceTimer) {
        clearInterval(autoAdvanceTimer);
        autoAdvanceTimer = null;
    }
    autoAdvanceCountdown = 10;

    // Update the UI to show cancelled state
    const countdownEl = document.getElementById('auto-advance-countdown');
    if (countdownEl) {
        countdownEl.textContent = '—';
        countdownEl.style.color = 'var(--text-secondary)';
        countdownEl.style.fontSize = '48px';

        // Update the label
        const label = countdownEl.previousElementSibling;
        if (label) label.textContent = 'Auto-advance cancelled';
        const sublabel = countdownEl.nextElementSibling;
        if (sublabel) sublabel.textContent = 'Use buttons below to continue';
    }
}

function getDivisionResults(divisionName, eventId) {
    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');

    for (const id in brackets) {
        const bracket = brackets[id];
        if ((bracket.division === divisionName || bracket.divisionName === divisionName) && bracket.eventId == eventId) {
            if (bracket.type === 'ranking-list') {
                return (bracket.entries || [])
                    .filter(e => e.status === 'scored' && e.score !== null)
                    .sort((a, b) => b.score - a.score)
                    .map((e, idx) => ({
                        name: `${e.competitor.firstName} ${e.competitor.lastName}`,
                        club: e.competitor.club || '',
                        score: e.score,
                        rank: idx + 1
                    }));
            } else if (bracket.type === 'single-elimination') {
                const results = [];
                const matches = bracket.matches || [];
                const finalMatch = matches.filter(m => m.status === 'completed')
                    .sort((a, b) => (b.round || 0) - (a.round || 0))[0];
                if (finalMatch && finalMatch.winner) {
                    const loser = finalMatch.redCorner?.id === finalMatch.winner.id ? finalMatch.blueCorner : finalMatch.redCorner;
                    results.push({ name: `${finalMatch.winner.firstName} ${finalMatch.winner.lastName}`, club: finalMatch.winner.club || '', rank: 1, winMethod: finalMatch.winMethod || '', winNote: finalMatch.winNote || '' });
                    if (loser) results.push({ name: `${loser.firstName} ${loser.lastName}`, club: loser.club || '', rank: 2 });

                    // 3rd place: losers of semi-finals
                    if (finalMatch.round > 1) {
                        const semiFinals = matches.filter(m => m.round === finalMatch.round - 1 && (m.status === 'completed'));
                        semiFinals.forEach(sf => {
                            if (sf.winner) {
                                const sfLoser = sf.redCorner?.id === sf.winner.id ? sf.blueCorner : sf.redCorner;
                                if (sfLoser) results.push({ name: `${sfLoser.firstName} ${sfLoser.lastName}`, club: sfLoser.club || '', rank: 3 });
                            }
                        });
                    }
                }
                return results;
            } else if (bracket.type === 'repechage') {
                const results = [];
                const matches = bracket.matches || [];
                const finalMatch = matches.filter(m => m.status === 'completed')
                    .sort((a, b) => (b.round || 0) - (a.round || 0))[0];

                if (finalMatch && finalMatch.winner) {
                    const loser = finalMatch.redCorner?.id === finalMatch.winner.id ? finalMatch.blueCorner : finalMatch.redCorner;
                    results.push({ name: `${finalMatch.winner.firstName} ${finalMatch.winner.lastName}`, club: finalMatch.winner.club || '', rank: 1, winMethod: finalMatch.winMethod || '', winNote: finalMatch.winNote || '' });
                    if (loser) results.push({ name: `${loser.firstName} ${loser.lastName}`, club: loser.club || '', rank: 2 });
                }

                // 3rd place from repechage brackets
                [bracket.repechageA, bracket.repechageB].forEach(repMatches => {
                    if (!repMatches || repMatches.length === 0) return;
                    const maxRound = Math.max(...repMatches.map(m => m.round || 0));
                    const repFinal = repMatches.find(m => m.round === maxRound && m.winner);
                    if (repFinal && repFinal.winner) {
                        results.push({ name: `${repFinal.winner.firstName} ${repFinal.winner.lastName}`, club: repFinal.winner.club || '', rank: 3 });
                    }
                });

                return results;
            } else if (bracket.type === 'double-elimination') {
                const results = [];
                let champion, runnerUp;

                // Check reset match first (played if LB champion won grand finals game 1)
                if (bracket.reset && bracket.reset.winner) {
                    champion = bracket.reset.winner;
                    runnerUp = bracket.reset.redCorner?.id === bracket.reset.winner.id ? bracket.reset.blueCorner : bracket.reset.redCorner;
                } else if (bracket.finals && bracket.finals.winner) {
                    champion = bracket.finals.winner;
                    runnerUp = bracket.finals.redCorner?.id === bracket.finals.winner.id ? bracket.finals.blueCorner : bracket.finals.redCorner;
                }

                // Determine the decisive match for win method
                const decisiveMatch = (bracket.reset && bracket.reset.winner) ? bracket.reset : bracket.finals;

                if (champion) {
                    results.push({ name: `${champion.firstName} ${champion.lastName}`, club: champion.club || '', rank: 1, winMethod: decisiveMatch?.winMethod || '', winNote: decisiveMatch?.winNote || '' });
                }
                if (runnerUp) {
                    results.push({ name: `${runnerUp.firstName} ${runnerUp.lastName}`, club: runnerUp.club || '', rank: 2 });
                }

                // 3rd place: loser of the last losers bracket match
                const losersMatches = bracket.losers || [];
                if (losersMatches.length > 0) {
                    const maxLR = Math.max(...losersMatches.map(m => m.round || 0));
                    const lastLosersMatch = losersMatches.find(m => m.round === maxLR && m.winner);
                    if (lastLosersMatch) {
                        const thirdPlace = lastLosersMatch.redCorner?.id === lastLosersMatch.winner.id
                            ? lastLosersMatch.blueCorner : lastLosersMatch.redCorner;
                        if (thirdPlace) {
                            results.push({ name: `${thirdPlace.firstName} ${thirdPlace.lastName}`, club: thirdPlace.club || '', rank: 3 });
                        }
                    }
                }

                return results;
            } else {
                return [];
            }
        }
    }
    return [];
}

function loadResults() {
    const container = document.getElementById('results-container');
    if (!container) return;

    const divisions = db.load('divisions');
    const eventTypes = db.load('eventTypes');

    let html = '';
    let totalDivisions = 0;
    let completedDivisions = 0;

    Object.keys(divisions).forEach(eventId => {
        const eventData = divisions[eventId];
        if (!eventData || !eventData.generated) return;

        const event = eventTypes.find(e => String(e.id) === String(eventId));
        const eventName = event ? event.name : `Event ${eventId}`;

        let eventHtml = '';

        Object.keys(eventData.generated).forEach(divisionName => {
            totalDivisions++;
            const results = getDivisionResults(divisionName, eventId);

            if (results.length === 0) return;
            completedDivisions++;

            eventHtml += `
                <div style="margin-bottom: 12px; padding: 12px; background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 8px;">
                    <h4 style="margin-bottom: 8px;">${divisionName}</h4>
                    <div>
                        ${results.map((result, idx) => {
                            const medalEmoji = result.rank <= 3 ? ['&#x1F947;','&#x1F948;','&#x1F949;'][result.rank - 1] || `#${result.rank}` : `#${result.rank}`;
                            const winMethodLabel = result.winMethod ? { points: 'Points', decision: 'Decision', hansoku: 'Hansoku', withdrawal: 'Withdrawal', default_win: 'Default Win', ippon: 'Ippon' }[result.winMethod] || result.winMethod : '';
                            const winMethodHTML = winMethodLabel ? `<span style="font-size: 10px; background: var(--bg-secondary); padding: 1px 6px; border-radius: 4px; color: var(--text-secondary); margin-left: 6px;">${winMethodLabel}${result.winNote ? ': ' + result.winNote : ''}</span>` : '';
                            return `<div style="display: flex; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--glass-border);">
                                <span style="width: 40px; text-align: center; font-size: 18px;">${medalEmoji}</span>
                                <div style="flex: 1;">
                                    <div style="font-weight: 600;">${result.name}${winMethodHTML}</div>
                                    ${result.club ? `<div style="font-size: 11px; color: var(--text-secondary);">${result.club}</div>` : ''}
                                </div>
                                ${result.score !== undefined ? `<div style="font-weight: 700;">${typeof result.score === 'number' ? result.score.toFixed(2) : result.score}</div>` : ''}
                            </div>`;
                        }).join('')}
                    </div>
                </div>
            `;
        });

        if (eventHtml) {
            html += `<div class="glass-panel" style="margin-bottom: 20px;">
                <h3 style="margin-bottom: 16px; color: var(--accent-color);">${eventName}</h3>
                ${eventHtml}
            </div>`;
        }
    });

    if (html === '') {
        html = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">No completed divisions yet. Results will appear here once brackets are completed.</p>';
    } else {
        html = `<p style="color: var(--text-secondary); margin-bottom: 16px;">${completedDivisions}/${totalDivisions} divisions completed</p>` + html;
    }

    container.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════════════════
// EDIT SCORES AFTER SUBMISSION
// ═══════════════════════════════════════════════════════════════════════════

function updateEditResultsButtonVisibility(bracket) {
    const btn = document.getElementById('edit-results-btn');
    if (!btn) return;

    if (!bracket) {
        btn.style.display = 'none';
        return;
    }

    let hasCompletedResults = false;

    if (bracket.type === 'ranking-list') {
        hasCompletedResults = (bracket.entries || []).some(e => e.status === 'scored');
    } else if (bracket.type === 'single-elimination' || bracket.type === 'round-robin' || bracket.type === 'repechage') {
        hasCompletedResults = (bracket.matches || []).some(m => m.status === 'completed');
    } else if (bracket.type === 'double-elimination') {
        hasCompletedResults = (bracket.winners || []).some(m => m.status === 'completed') ||
                              (bracket.losers || []).some(m => m.status === 'completed');
    } else if (bracket.type === 'pool-play') {
        bracket.pools?.forEach(pool => {
            if ((pool.matches || []).some(m => m.status === 'completed')) hasCompletedResults = true;
        });
    } else if (bracket.type === 'kata-flags' || bracket.type === 'kata-points') {
        const rounds = bracket.rounds || [];
        hasCompletedResults = rounds.some(round => (round.performances || []).some(p => p.completed));
    }

    btn.style.display = hasCompletedResults ? 'inline-flex' : 'none';
}

function logScoreEdit(bracketId, entryId, field, oldValue, newValue) {
    const edits = JSON.parse(localStorage.getItem(_scopedKey('scoreEditLog')) || '[]');
    edits.push({
        bracketId,
        entryId,
        field,
        oldValue,
        newValue,
        editedAt: new Date().toISOString(),
        division: currentOperatorDivision,
        eventId: currentOperatorEventId
    });
    localStorage.setItem(_scopedKey('scoreEditLog'), JSON.stringify(edits));
}

function openEditResultsPanel(matId, divisionName, eventId) {
    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
    let bracketId = null;
    let bracket = null;

    for (const id in brackets) {
        const b = brackets[id];
        if ((b.division === divisionName || b.divisionName === divisionName) && b.eventId == eventId) {
            bracketId = id;
            bracket = b;
            break;
        }
    }

    if (!bracket) {
        showMessage('No bracket found for this division', 'error');
        return;
    }

    if (bracket.type === 'ranking-list') {
        openEditRankingListPanel(matId, divisionName, eventId, bracketId, bracket);
    } else {
        openEditKumitePanel(matId, divisionName, eventId, bracketId, bracket);
    }
}

function openEditRankingListPanel(matId, divisionName, eventId, bracketId, bracket) {
    const content = document.getElementById('operator-scoreboard-content');
    const entries = bracket.entries || [];
    const numJudges = bracket.scoreboardConfig?.settings?.judges || bracket.numJudges || 5;
    const scoringRange = bracket.scoringRange || bracket.scoreboardConfig?.settings?.scoringRange || { min: 0, max: 10 };

    const scoredEntries = entries
        .filter(e => e.status === 'scored' && e.score !== null)
        .sort((a, b) => b.score - a.score);

    if (scoredEntries.length === 0) {
        showMessage('No scored entries to edit', 'error');
        return;
    }

    content.innerHTML = `
        <div>
            <div class="glass-panel" style="text-align: center; flex-shrink: 0;">
                <h3 style="margin-bottom: 4px; font-size: clamp(14px, 1.8vw, 18px);">Edit Results - ${divisionName}</h3>
                <p style="color: var(--text-secondary); font-size: 12px;">Click on a competitor's scores to edit them</p>
            </div>

            <div class="glass-panel">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--glass-border);">
                            <th style="padding: 6px; text-align: left; font-size: 11px; color: var(--text-secondary);">Rank</th>
                            <th style="padding: 6px; text-align: left; font-size: 11px; color: var(--text-secondary);">Competitor</th>
                            ${Array.from({ length: numJudges }, (_, i) => `
                                <th style="padding: 6px; text-align: center; font-size: 11px; color: var(--text-secondary);">J${i + 1}</th>
                            `).join('')}
                            <th style="padding: 8px; text-align: center; font-size: 12px; color: var(--text-secondary);">Avg</th>
                            <th style="padding: 8px; text-align: center; font-size: 12px; color: var(--text-secondary);">Edit</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${scoredEntries.map((entry, idx) => {
                            const comp = entry.competitor;
                            const judgeScores = entry.judgeScores || [];
                            const entryIndex = entries.indexOf(entry);
                            const isEdited = entry.edited;
                            return `
                                <tr id="edit-row-${entryIndex}" style="border-bottom: 1px solid var(--glass-border);">
                                    <td style="padding: 8px; font-weight: 700;">#${idx + 1}</td>
                                    <td style="padding: 8px;">
                                        ${comp.firstName} ${comp.lastName}
                                        ${isEdited ? '<span style="color: #ff9500; font-size: 10px; margin-left: 4px;" title="Score was edited">✏️</span>' : ''}
                                    </td>
                                    ${Array.from({ length: numJudges }, (_, i) => `
                                        <td style="padding: 8px; text-align: center; font-variant-numeric: tabular-nums;">${judgeScores[i] !== undefined ? judgeScores[i].toFixed(1) : '—'}</td>
                                    `).join('')}
                                    <td style="padding: 8px; text-align: center; font-weight: 700; color: #dc2626;">${entry.score.toFixed(2)}</td>
                                    <td style="padding: 8px; text-align: center;">
                                        <button class="btn btn-secondary" onclick="editRankingListEntry(${entryIndex}, '${bracketId}', ${numJudges}, ${scoringRange.min}, ${scoringRange.max})"
                                            style="font-size: 11px; padding: 4px 10px; border-radius: 6px;">
                                            ✏️ Edit
                                        </button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>

            <div style="text-align: center; margin-top: 16px; display: flex; gap: 12px; justify-content: center;">
                <button class="btn btn-secondary" onclick="openOperatorScoreboard(${matId}, '${divisionName.replace(/'/g, "\\'")}', '${eventId}')">
                    ← Back to Scoreboard
                </button>
            </div>
        </div>
    `;
}

function editRankingListEntry(entryIndex, bracketId, numJudges, minScore, maxScore) {
    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
    const bracket = brackets[bracketId];
    if (!bracket) return;

    const entry = bracket.entries[entryIndex];
    if (!entry) return;

    const comp = entry.competitor;
    const judgeScores = entry.judgeScores || [];

    // Replace the row with editable inputs
    const row = document.getElementById(`edit-row-${entryIndex}`);
    if (!row) return;

    row.innerHTML = `
        <td style="padding: 8px;" colspan="2">
            <strong>${comp.firstName} ${comp.lastName}</strong>
        </td>
        ${Array.from({ length: numJudges }, (_, i) => `
            <td style="padding: 8px; text-align: center;">
                <input type="number" id="edit-judge-${entryIndex}-${i}" value="${judgeScores[i] !== undefined ? judgeScores[i] : ''}"
                    min="${minScore}" max="${maxScore}" step="0.1"
                    style="width: 60px; padding: 4px; border-radius: 6px; text-align: center; font-size: 14px; font-weight: 600;
                    background: var(--bg-secondary); color: var(--text-primary); border: 2px solid #dc2626;">
            </td>
        `).join('')}
        <td style="padding: 8px; text-align: center;">
            <span id="edit-avg-${entryIndex}" style="font-weight: 700; color: #dc2626;">—</span>
        </td>
        <td style="padding: 8px; text-align: center;">
            <button class="btn btn-primary" onclick="saveRankingListEdit(${entryIndex}, '${bracketId}', ${numJudges})"
                style="font-size: 11px; padding: 4px 8px; background: #22c55e; border-radius: 6px; margin-right: 4px;">
                ✓
            </button>
            <button class="btn btn-secondary" onclick="openEditResultsPanel(${currentOperatorMat}, currentOperatorDivision, currentOperatorEventId)"
                style="font-size: 11px; padding: 4px 8px; border-radius: 6px;">
                ✕
            </button>
        </td>
    `;
    row.style.background = 'rgba(220, 38, 38, 0.1)';

    // Add live average calculation
    for (let i = 0; i < numJudges; i++) {
        const input = document.getElementById(`edit-judge-${entryIndex}-${i}`);
        if (input) {
            input.addEventListener('input', () => {
                let total = 0, count = 0;
                for (let j = 0; j < numJudges; j++) {
                    const v = parseFloat(document.getElementById(`edit-judge-${entryIndex}-${j}`)?.value);
                    if (!isNaN(v)) { total += v; count++; }
                }
                const avgEl = document.getElementById(`edit-avg-${entryIndex}`);
                if (avgEl) avgEl.textContent = count > 0 ? (total / count).toFixed(2) : '—';
            });
            // Trigger initial calculation
            input.dispatchEvent(new Event('input'));
        }
    }
}

function saveRankingListEdit(entryIndex, bracketId, numJudges) {
    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
    const bracket = brackets[bracketId];
    if (!bracket) return;

    const entry = bracket.entries[entryIndex];
    if (!entry) return;

    // Collect new judge scores
    const newJudgeScores = [];
    let total = 0, count = 0;
    for (let i = 0; i < numJudges; i++) {
        const val = parseFloat(document.getElementById(`edit-judge-${entryIndex}-${i}`)?.value);
        if (!isNaN(val)) {
            newJudgeScores.push(val);
            total += val;
            count++;
        } else {
            newJudgeScores.push(0);
        }
    }

    if (count === 0) {
        showMessage('Please enter at least one judge score', 'error');
        return;
    }

    const newAvg = total / count;

    // Log the edit
    logScoreEdit(bracketId, entryIndex, 'judgeScores', entry.judgeScores, newJudgeScores);
    logScoreEdit(bracketId, entryIndex, 'score', entry.score, newAvg);

    // Update entry
    entry.judgeScores = newJudgeScores;
    entry.score = newAvg;
    entry.edited = true;
    entry.lastEditedAt = new Date().toISOString();

    // Re-rank all scored entries
    const scored = bracket.entries.filter(e => e.status === 'scored');
    scored.sort((a, b) => b.score - a.score);
    scored.forEach((e, idx) => { e.rank = idx + 1; });

    // Save
    saveBrackets(brackets);

    // Sync TV display
    if (currentRankingListBracket) {
        updateRankingListTVDisplay(bracket, bracket.status === 'completed' ? 'complete' : 'scoring');
    }

    showMessage(`Score updated for ${entry.competitor.firstName} ${entry.competitor.lastName}: ${newAvg.toFixed(2)}`, 'success');

    // Refresh the edit panel
    openEditResultsPanel(currentOperatorMat, currentOperatorDivision, currentOperatorEventId);
}

function openEditKumitePanel(matId, divisionName, eventId, bracketId, bracket) {
    const content = document.getElementById('operator-scoreboard-content');
    const settings = JSON.parse(localStorage.getItem(_scopedKey('scoreboardSettings')) || '{}');
    const corner1Name = settings.corner1Name || 'RED';
    const corner2Name = settings.corner2Name || 'BLUE';

    // Collect all completed matches
    let completedMatches = [];
    if (bracket.type === 'single-elimination' || bracket.type === 'round-robin' || bracket.type === 'repechage') {
        completedMatches = (bracket.matches || []).filter(m => m.status === 'completed');
        if (bracket.type === 'repechage') {
            completedMatches.push(...(bracket.repechageA || []).filter(m => m.status === 'completed'));
            completedMatches.push(...(bracket.repechageB || []).filter(m => m.status === 'completed'));
        }
    } else if (bracket.type === 'double-elimination') {
        completedMatches = [
            ...(bracket.winners || []).filter(m => m.status === 'completed'),
            ...(bracket.losers || []).filter(m => m.status === 'completed')
        ];
        if (bracket.finals?.status === 'completed') {
            completedMatches.push(bracket.finals);
        }
    } else if (bracket.type === 'pool-play') {
        bracket.pools?.forEach(pool => {
            const poolCompleted = (pool.matches || []).filter(m => m.status === 'completed');
            completedMatches.push(...poolCompleted);
        });
    }

    if (completedMatches.length === 0) {
        showMessage('No completed matches to edit', 'error');
        return;
    }

    content.innerHTML = `
        <div>
            <div class="glass-panel" style="text-align: center; flex-shrink: 0;">
                <h3 style="margin-bottom: 4px; font-size: clamp(14px, 1.8vw, 18px);">Edit Match Results - ${divisionName}</h3>
                <p style="color: var(--text-secondary); font-size: 12px;">Click edit to modify a match result</p>
            </div>

            <div class="glass-panel">
                ${completedMatches.map((match, idx) => {
                    const redName = match.redCorner ? `${match.redCorner.firstName} ${match.redCorner.lastName}` : 'Unknown';
                    const blueName = match.blueCorner ? `${match.blueCorner.firstName} ${match.blueCorner.lastName}` : 'Unknown';
                    const winnerIsRed = match.winner && match.redCorner && match.winner.id === match.redCorner.id;
                    const isEdited = match.edited;

                    return `
                        <div id="edit-match-${match.id}" style="padding: 12px; border-bottom: 1px solid var(--glass-border); display: flex; align-items: center; gap: 12px;">
                            <div style="flex: 1; display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 11px; color: var(--text-secondary); min-width: 40px;">R${match.round || '?'}</span>
                                <div style="flex: 1; display: flex; align-items: center; gap: 6px;">
                                    <span style="font-weight: ${winnerIsRed ? '700' : '400'}; color: ${winnerIsRed ? '#22c55e' : 'var(--text-primary)'};">${redName}</span>
                                    <span style="font-variant-numeric: tabular-nums; font-weight: 600;">${match.score1 || 0}</span>
                                    <span style="color: var(--text-secondary); font-size: 12px;">vs</span>
                                    <span style="font-variant-numeric: tabular-nums; font-weight: 600;">${match.score2 || 0}</span>
                                    <span style="font-weight: ${!winnerIsRed ? '700' : '400'}; color: ${!winnerIsRed ? '#22c55e' : 'var(--text-primary)'};">${blueName}</span>
                                    ${isEdited ? '<span style="color: #ff9500; font-size: 10px;" title="Result was edited">✏️</span>' : ''}
                                </div>
                            </div>
                            <button class="btn btn-secondary" onclick="editKumiteMatch('${match.id}', '${bracketId}')"
                                style="font-size: 11px; padding: 4px 10px; border-radius: 6px; flex-shrink: 0;">
                                ✏️ Edit
                            </button>
                        </div>
                    `;
                }).join('')}
            </div>

            <div style="text-align: center; margin-top: 16px; display: flex; gap: 12px; justify-content: center;">
                <button class="btn btn-secondary" onclick="openOperatorScoreboard(${matId}, '${divisionName.replace(/'/g, "\\'")}', '${eventId}')">
                    ← Back to Scoreboard
                </button>
            </div>
        </div>
    `;
}

function editKumiteMatch(matchId, bracketId) {
    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
    const bracket = brackets[bracketId];
    if (!bracket) return;

    // Find the match
    let match = null;
    let matchSource = null; // 'matches', 'winners', 'losers', 'finals', or 'pool-X'
    let poolIndex = -1;

    if (bracket.type === 'single-elimination' || bracket.type === 'round-robin' || bracket.type === 'repechage') {
        match = bracket.matches?.find(m => m.id === matchId);
        matchSource = 'matches';
        if (!match && bracket.type === 'repechage') {
            match = bracket.repechageA?.find(m => m.id === matchId);
            if (match) { matchSource = 'repechageA'; }
            else {
                match = bracket.repechageB?.find(m => m.id === matchId);
                if (match) { matchSource = 'repechageB'; }
            }
        }
    } else if (bracket.type === 'double-elimination') {
        match = bracket.winners?.find(m => m.id === matchId);
        if (match) { matchSource = 'winners'; }
        else {
            match = bracket.losers?.find(m => m.id === matchId);
            if (match) { matchSource = 'losers'; }
            else if (bracket.finals?.id === matchId) {
                match = bracket.finals;
                matchSource = 'finals';
            }
        }
    } else if (bracket.type === 'pool-play') {
        bracket.pools?.forEach((pool, pIdx) => {
            const found = (pool.matches || []).find(m => m.id === matchId);
            if (found) { match = found; matchSource = 'pool'; poolIndex = pIdx; }
        });
    }

    if (!match) {
        showMessage('Match not found', 'error');
        return;
    }

    const redName = match.redCorner ? `${match.redCorner.firstName} ${match.redCorner.lastName}` : 'Unknown';
    const blueName = match.blueCorner ? `${match.blueCorner.firstName} ${match.blueCorner.lastName}` : 'Unknown';

    const settings = JSON.parse(localStorage.getItem(_scopedKey('scoreboardSettings')) || '{}');
    const corner1Color = settings.corner1Custom || '#ff453a';
    const corner2Color = settings.corner2Custom || '#0a84ff';

    const row = document.getElementById(`edit-match-${matchId}`);
    if (!row) return;

    row.innerHTML = `
        <div style="width: 100%; padding: 12px; background: rgba(220, 38, 38, 0.05); border-radius: 8px;">
            <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 16px; align-items: center; margin-bottom: 12px;">
                <div style="text-align: center;">
                    <div style="font-weight: 600; color: ${corner1Color}; margin-bottom: 8px;">${redName}</div>
                    <input type="number" id="edit-score1-${matchId}" value="${match.score1 || 0}" min="0" step="any"
                        style="width: 80px; padding: 8px; border-radius: 8px; text-align: center; font-size: 20px; font-weight: 700;
                        background: var(--bg-secondary); color: var(--text-primary); border: 2px solid ${corner1Color};">
                    <div style="margin-top: 8px;">
                        <label style="display: flex; align-items: center; gap: 6px; justify-content: center; cursor: pointer; font-size: 13px;">
                            <input type="radio" name="edit-winner-${matchId}" value="red" ${match.winner?.id === match.redCorner?.id ? 'checked' : ''}>
                            Winner
                        </label>
                    </div>
                </div>
                <div style="font-size: 16px; font-weight: 700; color: var(--text-secondary);">VS</div>
                <div style="text-align: center;">
                    <div style="font-weight: 600; color: ${corner2Color}; margin-bottom: 8px;">${blueName}</div>
                    <input type="number" id="edit-score2-${matchId}" value="${match.score2 || 0}" min="0" step="any"
                        style="width: 80px; padding: 8px; border-radius: 8px; text-align: center; font-size: 20px; font-weight: 700;
                        background: var(--bg-secondary); color: var(--text-primary); border: 2px solid ${corner2Color};">
                    <div style="margin-top: 8px;">
                        <label style="display: flex; align-items: center; gap: 6px; justify-content: center; cursor: pointer; font-size: 13px;">
                            <input type="radio" name="edit-winner-${matchId}" value="blue" ${match.winner?.id === match.blueCorner?.id ? 'checked' : ''}>
                            Winner
                        </label>
                    </div>
                </div>
            </div>
            <div style="display: flex; gap: 8px; justify-content: center;">
                <button class="btn btn-primary" onclick="saveKumiteEdit('${matchId}', '${bracketId}', '${matchSource}', ${poolIndex})"
                    style="font-size: 13px; padding: 6px 16px; background: #22c55e;">
                    ✓ Save
                </button>
                <button class="btn btn-secondary" onclick="openEditResultsPanel(${currentOperatorMat}, currentOperatorDivision, currentOperatorEventId)"
                    style="font-size: 13px; padding: 6px 16px;">
                    ✕ Cancel
                </button>
            </div>
        </div>
    `;
    row.style.padding = '0';
}

function saveKumiteEdit(matchId, bracketId, matchSource, poolIndex) {
    const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
    const bracket = brackets[bracketId];
    if (!bracket) return;

    // Find the match again
    let match = null;
    if (matchSource === 'matches') {
        match = bracket.matches?.find(m => m.id === matchId);
    } else if (matchSource === 'winners') {
        match = bracket.winners?.find(m => m.id === matchId);
    } else if (matchSource === 'losers') {
        match = bracket.losers?.find(m => m.id === matchId);
    } else if (matchSource === 'finals') {
        match = bracket.finals;
    } else if (matchSource === 'pool') {
        match = bracket.pools?.[poolIndex]?.matches?.find(m => m.id === matchId);
    }

    if (!match) {
        showMessage('Match not found', 'error');
        return;
    }

    const newScore1 = parseInt(document.getElementById(`edit-score1-${matchId}`)?.value) || 0;
    const newScore2 = parseInt(document.getElementById(`edit-score2-${matchId}`)?.value) || 0;
    const winnerRadio = document.querySelector(`input[name="edit-winner-${matchId}"]:checked`);
    const winnerCorner = winnerRadio?.value || 'red';

    const newWinner = winnerCorner === 'red' ? match.redCorner : match.blueCorner;
    const oldWinner = match.winner;

    // Log edits
    logScoreEdit(bracketId, matchId, 'score1', match.score1, newScore1);
    logScoreEdit(bracketId, matchId, 'score2', match.score2, newScore2);
    if (oldWinner?.id !== newWinner?.id) {
        logScoreEdit(bracketId, matchId, 'winner', oldWinner?.firstName + ' ' + oldWinner?.lastName, newWinner?.firstName + ' ' + newWinner?.lastName);
    }

    // Update match
    match.score1 = newScore1;
    match.score2 = newScore2;
    match.winner = newWinner;
    match.edited = true;
    match.lastEditedAt = new Date().toISOString();

    // If winner changed in single-elimination or repechage, update advancement
    if ((bracket.type === 'single-elimination' || bracket.type === 'repechage') && oldWinner?.id !== newWinner?.id) {
        const nextRound = match.round + 1;
        const nextPosition = Math.floor(match.position / 2);
        const nextMatch = bracket.matches?.find(m => m.round === nextRound && m.position === nextPosition);

        if (nextMatch) {
            // Update the correct corner
            if (match.position % 2 === 0) {
                nextMatch.redCorner = newWinner;
            } else {
                nextMatch.blueCorner = newWinner;
            }

            // If next match was also completed, warn that it may need re-evaluation
            if (nextMatch.status === 'completed') {
                showMessage('Warning: Winner changed — downstream match results may need review', 'warning');
            }
        }
    }

    // Save
    saveBrackets(brackets);

    showMessage(`Match result updated`, 'success');

    // Refresh the edit panel
    openEditResultsPanel(currentOperatorMat, currentOperatorDivision, currentOperatorEventId);
}

function openTVDisplayFromOperator() {
    // For kata-flags, currentOperatorMat may be set OR we can fall back to kataFlagsMatId
    const matId = currentOperatorMat || (activeScoreboardType === 'kata-flags' ? kataFlagsMatId : null);
    if (!matId) return;
    const windowName = `TVDisplay_Mat${matId}`;
    const tidParam = currentTournamentId ? `?tid=${currentTournamentId}` : '';
    if (activeScoreboardType === 'kata-points') {
        window.open(`/kata-scoreboard.html${tidParam}`, windowName, 'width=1920,height=1080,fullscreen=yes');
    } else if (activeScoreboardType === 'kumite') {
        window.open(`/kumite-scoreboard.html${tidParam}`, windowName, 'width=1920,height=1080,fullscreen=yes');
        updateOperatorTVDisplay();
    } else if (activeScoreboardType === 'kata-flags') {
        window.open(`/kata-flags-scoreboard.html${tidParam}`, windowName, 'width=1920,height=1080,fullscreen=yes');
        updateKataFlagsTVDisplay();
    } else {
        // Default fallback: kumite scoreboard (auto-redirects if type changes)
        window.open(`/kumite-scoreboard.html${tidParam}`, windowName, 'width=1920,height=1080,fullscreen=yes');
        updateOperatorTVDisplay();
    }
}

function updateOperatorTVDisplay(winner = null) {
    // Only update if kumite is the active scoreboard
    if (activeScoreboardType !== 'kumite') {
        console.log('updateOperatorTVDisplay: Kumite not active, skipping update');
        return;
    }

    // Get mat name
    const mats = JSON.parse(localStorage.getItem(_scopedKey('mats')) || '[]');
    const mat = mats.find(m => m.id == currentOperatorMat);
    const matName = mat ? mat.name : `Mat ${currentOperatorMat}`;

    // Get corner settings — unified config preferred, legacy scoreboardSettings as fallback
    let corner1Name, corner2Name, corner1Color, corner2Color;
    const tvUnifiedCfg = getUnifiedScoreboardConfig();
    if (tvUnifiedCfg && tvUnifiedCfg.kumite) {
        const uk = tvUnifiedCfg.kumite;
        corner1Name  = uk.corner1Name  || 'RED';
        corner2Name  = uk.corner2Name  || 'BLUE';
        corner1Color = uk.corner1Color || '#ff453a';
        corner2Color = uk.corner2Color || '#0a84ff';
    } else {
        const settings = JSON.parse(localStorage.getItem(_scopedKey('scoreboardSettings')) || '{}');
        corner1Name  = settings.corner1Name  || 'RED';
        corner2Name  = settings.corner2Name  || 'BLUE';
        corner1Color = settings.corner1Custom || '#ff453a';
        corner2Color = settings.corner2Custom || '#0a84ff';
    }

    // Build match info
    let matchInfo = 'Current Match';
    if (window.currentMatchId) {
        const brackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
        const bracket = brackets[window.currentBracketId];
        if (bracket) {
            let match = null;
            if (bracket.type === 'single-elimination' || bracket.type === 'round-robin' || bracket.type === 'repechage') {
                match = bracket.matches?.find(m => m.id === window.currentMatchId);
                if (!match && bracket.type === 'repechage') {
                    match = bracket.repechageA?.find(m => m.id === window.currentMatchId) ||
                            bracket.repechageB?.find(m => m.id === window.currentMatchId);
                }
            } else if (bracket.type === 'double-elimination') {
                match = bracket.winners?.find(m => m.id === window.currentMatchId) ||
                        bracket.losers?.find(m => m.id === window.currentMatchId);
            }
            if (match) {
                matchInfo = `Round ${match.round} - Match ${match.id}`;
            }
        }
    }

    // Find next division from mat schedule
    let nextDivision = null;
    const matScheduleForNext = loadMatScheduleData();
    const scheduleForNext = (matScheduleForNext[currentOperatorMat] || []).sort((a, b) => (a.order || 0) - (b.order || 0));
    const currentDivIndex = scheduleForNext.findIndex(s => s.division === currentOperatorDivision && s.eventId == currentOperatorEventId);
    if (currentDivIndex !== -1 && currentDivIndex < scheduleForNext.length - 1) {
        nextDivision = scheduleForNext[currentDivIndex + 1];

        // Get event type name for next division
        const eventTypes = JSON.parse(localStorage.getItem(_scopedKey('eventTypes')) || '[]');
        const nextEvent = eventTypes.find(e => e.id == nextDivision.eventId);
        nextDivision.eventName = nextEvent?.name || 'Unknown Event';

        // Get bracket info for next division
        const allBrackets = JSON.parse(localStorage.getItem(_scopedKey('brackets')) || '{}');
        for (const bracketId in allBrackets) {
            const b = allBrackets[bracketId];
            if (b.division === nextDivision.division && b.eventId == nextDivision.eventId) {
                nextDivision.competitorCount = b.competitors?.length || 0;
                nextDivision.totalMatches = b.matches?.length || 0;
                nextDivision.completedMatches = b.matches?.filter(m => m.status === 'completed').length || 0;
                break;
            }
        }
    }

    const state = {
        // Scoreboard type identifier
        scoreboardType: 'kumite',

        // Header info
        matName: matName,
        divisionName: currentOperatorDivision || 'Division',
        matchInfo: matchInfo,

        // Corner customization
        corner1Name: corner1Name,
        corner2Name: corner2Name,
        corner1Color: corner1Color,
        corner2Color: corner2Color,

        // Competitor data
        redName: operatorRedCompetitor ? `${operatorRedCompetitor.firstName} ${operatorRedCompetitor.lastName}`.toUpperCase() : corner1Name,
        redInfo: operatorRedCompetitor ? `${getDisplayAge(operatorRedCompetitor)} yrs | ${operatorRedCompetitor.weight}kg | ${operatorRedCompetitor.rank} | ${operatorRedCompetitor.club}` : '',
        redPhoto: operatorRedCompetitor?.photo || null,
        redClubLogo: operatorRedCompetitor?.clubLogo || null,
        redScore: operatorRedScore,
        redPenalties: operatorRedPenalties,

        blueName: operatorBlueCompetitor ? `${operatorBlueCompetitor.firstName} ${operatorBlueCompetitor.lastName}`.toUpperCase() : corner2Name,
        blueInfo: operatorBlueCompetitor ? `${getDisplayAge(operatorBlueCompetitor)} yrs | ${operatorBlueCompetitor.weight}kg | ${operatorBlueCompetitor.rank} | ${operatorBlueCompetitor.club}` : '',
        bluePhoto: operatorBlueCompetitor?.photo || null,
        blueClubLogo: operatorBlueCompetitor?.clubLogo || null,
        blueScore: operatorBlueScore,
        bluePenalties: operatorBluePenalties,

        timer: document.getElementById('operator-timer')?.textContent || '2:00',
        scoringType: operatorCurrentOrg,
        matchFormat: operatorMatchFormat,
        senshu: operatorSenshu,
        winner: winner,

        // Penalty track details
        redPenaltyDetail: operatorRedPenaltyTracks,
        bluePenaltyDetail: operatorBluePenaltyTracks,

        // Timer state
        atoshiBaraku: operatorAtoshiBaraku,
        isOvertime: operatorIsOvertime,

        // Score breakdown
        redIpponCount: operatorIpponCountRed,
        redWazaariCount: operatorWazaariCountRed,
        redYukoCount: operatorYukoCountRed,
        blueIpponCount: operatorIpponCountBlue,
        blueWazaariCount: operatorWazaariCountBlue,
        blueYukoCount: operatorYukoCountBlue,

        // Next division info
        nextDivision: nextDivision
    };

    localStorage.setItem(_scopedKey('scoreboard-state'), JSON.stringify(state));
}

function generateMats() {
    const numMatsInput = document.getElementById('num-mats');
    const numMats = numMatsInput ? parseInt(numMatsInput.value) : 2;
    const existingMats = db.load('mats');
    const mats = [];

    for (let i = 1; i <= numMats; i++) {
        // Preserve existing mat if it exists, otherwise create new one with default name
        const existingMat = existingMats.find(m => m.id === i);
        mats.push({
            id: i,
            name: existingMat ? existingMat.name : `Mat ${i}`,
            active: true
        });
    }

    db.save('mats', mats);
    displayMats();
    loadMatSelects();
}

// Duplicate displayMats() removed - using the one at line ~4971 with inline mat name editing

function loadMatSelects() {
    const mats = db.load('mats');
    const select = document.getElementById('match-mat');

    if (select) {
        select.innerHTML = '<option value="">Select Mat</option>';
        mats.forEach(mat => {
            const option = document.createElement('option');
            option.value = mat.id;
            option.textContent = mat.name;
            select.appendChild(option);
        });
    }
}

function loadCompetitorSelectsForMatches() {
    const competitors = db.load('competitors');
    const selects = [
        document.getElementById('match-red'),
        document.getElementById('match-blue')
    ];

    selects.forEach(select => {
        if (!select) return;
        select.innerHTML = '<option value="">Select Competitor</option>';
        competitors.forEach(comp => {
            const option = document.createElement('option');
            option.value = comp.id;
            option.textContent = `${comp.firstName} ${comp.lastName} - ${comp.club}`;
            select.appendChild(option);
        });
    });
}

function showMatchForm() {
    document.getElementById('match-form-container').classList.remove('hidden');
}

function hideMatchForm() {
    document.getElementById('match-form-container').classList.add('hidden');
    document.getElementById('match-form').reset();
}

document.getElementById('match-form')?.addEventListener('submit', (e) => {
    e.preventDefault();

    const match = {
        matId: parseInt(document.getElementById('match-mat').value),
        division: document.getElementById('match-division').value,
        redId: parseInt(document.getElementById('match-red').value),
        blueId: parseInt(document.getElementById('match-blue').value),
        time: document.getElementById('match-time').value || null,
        type: document.getElementById('match-type').value,
        status: 'scheduled',
        createdAt: new Date().toISOString()
    };

    db.add('matches', match);
    showMessage('Match scheduled successfully!');
    hideMatchForm();
    loadSchedule();
});

function loadSchedule() {
    const matches = db.load('matches');
    const competitors = db.load('competitors');
    const mats = db.load('mats');
    const container = document.getElementById('schedule-container');

    if (!container) return; // Element doesn't exist

    if (matches.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">No matches scheduled yet.</p>';
        return;
    }

    container.innerHTML = '';

    matches.sort((a, b) => {
        if (a.time && b.time) return a.time.localeCompare(b.time);
        return a.matId - b.matId;
    }).forEach(match => {
        const red = competitors.find(c => c.id === match.redId);
        const blue = competitors.find(c => c.id === match.blueId);
        const mat = mats.find(m => m.id === match.matId);

        if (!red || !blue || !mat) return;

        const row = document.createElement('div');
        row.className = 'schedule-row';
        row.innerHTML = `
            <div class="schedule-time">${match.time || 'TBD'}</div>
            <div class="schedule-mat">${mat.name}</div>
            <div class="schedule-competitors">
                <div class="schedule-competitor">
                    <strong style="color: var(--accent-red);">RED:</strong> ${red.firstName} ${red.lastName}
                </div>
                <div style="font-size: 1.5em;">vs</div>
                <div class="schedule-competitor">
                    <strong style="color: var(--accent-blue);">BLUE:</strong> ${blue.firstName} ${blue.lastName}
                </div>
            </div>
            <div class="schedule-division">${match.division}</div>
            <div>
                <button class="btn btn-small btn-primary" onclick="loadMatchToScoreboard(${match.id})">Start</button>
                <button class="btn btn-small btn-danger" onclick="deleteMatch(${match.id})">Delete</button>
            </div>
        `;
        container.appendChild(row);
    });
}

function deleteMatch(id) {
    if (confirm('Are you sure you want to delete this match?')) {
        db.delete('matches', id);
        loadSchedule();
        showMessage('Match deleted successfully!');
    }
}

function loadMatchToScoreboard(matchId) {
    const matches = db.load('matches');
    const match = matches.find(m => m.id === matchId);

    if (match) {
        activeMat = match.matId;
        // Switch to scoreboard view
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-view="scoreboards"]')?.classList.add('active');
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById('scoreboards-view')?.classList.add('active');

        loadScoreboardView();
        selectMatScoreboard(match.matId);

        // Load competitors for this mat
        const matScoreboards = JSON.parse(localStorage.getItem(_scopedKey('matScoreboards')) || '{}');
        if (!matScoreboards[match.matId]) {
            matScoreboards[match.matId] = {
                redId: match.redId,
                blueId: match.blueId,
                redScore: 0,
                blueScore: 0,
                redPenalties: 0,
                bluePenalties: 0,
                timeRemaining: 120
            };
            localStorage.setItem(_scopedKey('matScoreboards'), JSON.stringify(matScoreboards));
        }

        renderActiveScoreboard();
    }
}

function exportSchedule() {
    const matches = db.load('matches');
    const competitors = db.load('competitors');
    const mats = db.load('mats');

    let csvContent = 'Time,Mat,Division,Red Corner,Blue Corner,Type,Status\n';

    matches.forEach(match => {
        const red = competitors.find(c => c.id === match.redId);
        const blue = competitors.find(c => c.id === match.blueId);
        const mat = mats.find(m => m.id === match.matId);

        if (red && blue && mat) {
            csvContent += `${match.time || 'TBD'},"${mat.name}","${match.division}","${red.firstName} ${red.lastName}","${blue.firstName} ${blue.lastName}",${match.type},${match.status}\n`;
        }
    });

    downloadCSV(csvContent, 'tournament-schedule.csv');
}

function openScheduleDisplay() {
    showMessage('Schedule display coming soon — this feature is under development.', 'info');
}

// Multi-Mat Scoreboard
let currentMatScoreboard = 1;

function loadScoreboardView() {
    const mats = db.load('mats');
    const selector = document.getElementById('mat-selector');

    if (!selector) return;

    selector.innerHTML = '';
    mats.forEach(mat => {
        const btn = document.createElement('button');
        btn.className = 'mat-btn' + (mat.id === currentMatScoreboard ? ' active' : '');
        btn.textContent = mat.name;
        btn.onclick = () => selectMatScoreboard(mat.id);
        selector.appendChild(btn);
    });

    renderActiveScoreboard();
}

function selectMatScoreboard(matId) {
    currentMatScoreboard = matId;

    // Update button states
    document.querySelectorAll('.mat-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const btns = document.querySelectorAll('.mat-btn');
    if (btns[matId - 1]) {
        btns[matId - 1].classList.add('active');
    }

    renderActiveScoreboard();
}

function renderActiveScoreboard() {
    const container = document.getElementById('active-scoreboard-container');
    if (!container) return;

    const matScoreboards = JSON.parse(localStorage.getItem(_scopedKey('matScoreboards')) || '{}');
    const matData = matScoreboards[currentMatScoreboard] || {
        redId: null,
        blueId: null,
        redScore: 0,
        blueScore: 0,
        redPenalties: 0,
        bluePenalties: 0,
        timeRemaining: 120
    };

    const competitors = db.load('competitors');
    const redComp = matData.redId ? competitors.find(c => c.id === matData.redId) : null;
    const blueComp = matData.blueId ? competitors.find(c => c.id === matData.blueId) : null;

    container.innerHTML = `
        <div class="glass-panel">
            <h3>Mat ${currentMatScoreboard} - Control Panel</h3>

            <div class="competitor-selection">
                <div class="form-group">
                    <label>Red Corner</label>
                    <select id="mat-red-select" onchange="selectMatCompetitor('red')">
                        <option value="">-- Select Competitor --</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Blue Corner</label>
                    <select id="mat-blue-select" onchange="selectMatCompetitor('blue')">
                        <option value="">-- Select Competitor --</option>
                    </select>
                </div>
            </div>
        </div>

        <div class="scoreboard-controls">
            <label>
                <input type="radio" name="mat-scoreboard-type" value="wkf" checked> WKF Scoring
            </label>
            <label>
                <input type="radio" name="mat-scoreboard-type" value="aau"> AAU Scoring
            </label>
        </div>

        <div id="scoreboard-container">
            <div class="scoreboard">
                <div class="competitor red-corner">
                    <img id="mat-red-photo" class="competitor-photo hidden" alt="Red Corner">
                    <div class="competitor-name" id="mat-red-name">${redComp ? (redComp.firstName + ' ' + redComp.lastName).toUpperCase() : 'RED CORNER'}</div>
                    <div class="competitor-info" id="mat-red-info">${redComp ? `${getDisplayAge(redComp)} yrs | ${redComp.weight}kg | ${redComp.rank} | ${redComp.club}` : ''}</div>
                    <div class="score" id="mat-red-score">${matData.redScore}</div>
                    <div class="controls">
                        <button class="btn btn-small" onclick="addMatScore('red', 1)">+1</button>
                        <button class="btn btn-small" onclick="addMatScore('red', 2)">+2</button>
                        <button class="btn btn-small" onclick="addMatScore('red', 3)">+3</button>
                        <button class="btn btn-small btn-warning" onclick="addMatPenalty('red')">Penalty</button>
                    </div>
                    <div class="penalties">Penalties: <span id="mat-red-penalties">${matData.redPenalties}</span></div>
                </div>
                <div class="timer-section">
                    <div class="timer" id="mat-timer">${Math.floor(matData.timeRemaining / 60)}:${(matData.timeRemaining % 60).toString().padStart(2, '0')}</div>
                    <div class="timer-controls">
                        <button class="btn btn-primary" onclick="startMatTimer()">Start</button>
                        <button class="btn btn-secondary" onclick="pauseMatTimer()">Pause</button>
                        <button class="btn btn-secondary" onclick="resetMatTimer()">Reset</button>
                    </div>
                </div>
                <div class="competitor blue-corner">
                    <img id="mat-blue-photo" class="competitor-photo hidden" alt="Blue Corner">
                    <div class="competitor-name" id="mat-blue-name">${blueComp ? (blueComp.firstName + ' ' + blueComp.lastName).toUpperCase() : 'BLUE CORNER'}</div>
                    <div class="competitor-info" id="mat-blue-info">${blueComp ? `${getDisplayAge(blueComp)} yrs | ${blueComp.weight}kg | ${blueComp.rank} | ${blueComp.club}` : ''}</div>
                    <div class="score" id="mat-blue-score">${matData.blueScore}</div>
                    <div class="controls">
                        <button class="btn btn-small" onclick="addMatScore('blue', 1)">+1</button>
                        <button class="btn btn-small" onclick="addMatScore('blue', 2)">+2</button>
                        <button class="btn btn-small" onclick="addMatScore('blue', 3)">+3</button>
                        <button class="btn btn-small btn-warning" onclick="addMatPenalty('blue')">Penalty</button>
                    </div>
                    <div class="penalties">Penalties: <span id="mat-blue-penalties">${matData.bluePenalties}</span></div>
                </div>
            </div>
            <div class="match-controls">
                <button class="btn btn-success" onclick="declareMatWinner()">Declare Winner</button>
                <button class="btn btn-secondary" onclick="resetMatScoreboard()">New Match</button>
                <button class="btn btn-primary" onclick="openMatDisplay(${currentMatScoreboard})">📺 Open Mat ${currentMatScoreboard} Display</button>
            </div>
        </div>
    `;

    // Update competitor selects (reuse competitors already loaded above)
    const redSelect = document.getElementById('mat-red-select');
    const blueSelect = document.getElementById('mat-blue-select');

    [redSelect, blueSelect].forEach(select => {
        if (!select) return;
        competitors.forEach(comp => {
            const option = document.createElement('option');
            option.value = comp.id;
            option.textContent = `${comp.firstName} ${comp.lastName} - ${comp.club}`;
            select.appendChild(option);
        });
    });

    if (matData.redId) redSelect.value = matData.redId;
    if (matData.blueId) blueSelect.value = matData.blueId;

    // Update photos
    if (redComp?.photo) {
        document.getElementById('mat-red-photo').src = redComp.photo;
        document.getElementById('mat-red-photo').classList.remove('hidden');
    }
    if (blueComp?.photo) {
        document.getElementById('mat-blue-photo').src = blueComp.photo;
        document.getElementById('mat-blue-photo').classList.remove('hidden');
    }
}

function selectMatCompetitor(corner) {
    const selectId = corner === 'red' ? 'mat-red-select' : 'mat-blue-select';
    const competitorId = parseInt(document.getElementById(selectId).value);

    const matScoreboards = JSON.parse(localStorage.getItem(_scopedKey('matScoreboards')) || '{}');
    if (!matScoreboards[currentMatScoreboard]) {
        matScoreboards[currentMatScoreboard] = {
            redScore: 0,
            blueScore: 0,
            redPenalties: 0,
            bluePenalties: 0,
            timeRemaining: 120
        };
    }

    if (corner === 'red') {
        matScoreboards[currentMatScoreboard].redId = competitorId || null;
    } else {
        matScoreboards[currentMatScoreboard].blueId = competitorId || null;
    }

    localStorage.setItem(_scopedKey('matScoreboards'), JSON.stringify(matScoreboards));
    renderActiveScoreboard();
    updateAllMatDisplays();
}

let matTimerIntervals = {};

function addMatScore(corner, points) {
    const matScoreboards = JSON.parse(localStorage.getItem(_scopedKey('matScoreboards')) || '{}');
    if (!matScoreboards[currentMatScoreboard]) return;

    if (corner === 'red') {
        matScoreboards[currentMatScoreboard].redScore += points;
    } else {
        matScoreboards[currentMatScoreboard].blueScore += points;
    }

    localStorage.setItem(_scopedKey('matScoreboards'), JSON.stringify(matScoreboards));
    document.getElementById(`mat-${corner}-score`).textContent = matScoreboards[currentMatScoreboard][`${corner}Score`];
    updateAllMatDisplays();
}

function addMatPenalty(corner) {
    const matScoreboards = JSON.parse(localStorage.getItem(_scopedKey('matScoreboards')) || '{}');
    if (!matScoreboards[currentMatScoreboard]) return;

    const mat = matScoreboards[currentMatScoreboard];
    const opponentCorner = corner === 'red' ? 'blue' : 'red';

    if (corner === 'red') {
        mat.redPenalties++;
    } else {
        mat.bluePenalties++;
    }

    const penaltyCount = corner === 'red' ? mat.redPenalties : mat.bluePenalties;

    // WKF-style escalation based on penalty count:
    // 1st (Chukoku): Warning only - no score
    // 2nd (Keikoku): +1 point to opponent (Yuko)
    // 3rd (Hansoku-chui): +2 points to opponent (Waza-ari)
    // 4th+ (Hansoku): Disqualification
    if (penaltyCount === 2) {
        if (opponentCorner === 'red') { mat.redScore += 1; } else { mat.blueScore += 1; }
    } else if (penaltyCount === 3) {
        if (opponentCorner === 'red') { mat.redScore += 2; } else { mat.blueScore += 2; }
    } else if (penaltyCount >= 4) {
        showToast(`${corner.toUpperCase()} corner is disqualified! (Hansoku - 4th penalty)`, 'error', 5000);
    }

    localStorage.setItem(_scopedKey('matScoreboards'), JSON.stringify(matScoreboards));
    renderActiveScoreboard();
    updateAllMatDisplays();
}

function startMatTimer() {
    if (matTimerIntervals[currentMatScoreboard]) return;

    matTimerIntervals[currentMatScoreboard] = setInterval(() => {
        const matScoreboards = JSON.parse(localStorage.getItem(_scopedKey('matScoreboards')) || '{}');
        if (!matScoreboards[currentMatScoreboard]) return;

        matScoreboards[currentMatScoreboard].timeRemaining--;
        localStorage.setItem(_scopedKey('matScoreboards'), JSON.stringify(matScoreboards));

        const minutes = Math.floor(matScoreboards[currentMatScoreboard].timeRemaining / 60);
        const seconds = matScoreboards[currentMatScoreboard].timeRemaining % 60;
        document.getElementById('mat-timer').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        updateAllMatDisplays();

        if (matScoreboards[currentMatScoreboard].timeRemaining <= 0) {
            pauseMatTimer();
            showToast('Time is up!', 'warning');
        }
    }, 1000);
}

function pauseMatTimer() {
    if (matTimerIntervals[currentMatScoreboard]) {
        clearInterval(matTimerIntervals[currentMatScoreboard]);
        delete matTimerIntervals[currentMatScoreboard];
    }
}

function resetMatTimer() {
    pauseMatTimer();
    const matScoreboards = JSON.parse(localStorage.getItem(_scopedKey('matScoreboards')) || '{}');
    if (matScoreboards[currentMatScoreboard]) {
        matScoreboards[currentMatScoreboard].timeRemaining = 120;
        localStorage.setItem(_scopedKey('matScoreboards'), JSON.stringify(matScoreboards));
        document.getElementById('mat-timer').textContent = '2:00';
        updateAllMatDisplays();
    }
}

function declareMatWinner() {
    pauseMatTimer();
    const matScoreboards = JSON.parse(localStorage.getItem(_scopedKey('matScoreboards')) || '{}');
    const matData = matScoreboards[currentMatScoreboard];

    if (!matData) return;

    const winner = matData.redScore > matData.blueScore ? 'Red Corner' : matData.blueScore > matData.redScore ? 'Blue Corner' : 'Draw';
    showToast(`Winner: ${winner} | Red: ${matData.redScore} - Blue: ${matData.blueScore}`, 'success', 5000);

    // Update display with winner
    matData.winner = winner;
    localStorage.setItem(_scopedKey('matScoreboards'), JSON.stringify(matScoreboards));
    updateAllMatDisplays();
}

function resetMatScoreboard() {
    const matScoreboards = JSON.parse(localStorage.getItem(_scopedKey('matScoreboards')) || '{}');
    matScoreboards[currentMatScoreboard] = {
        redId: null,
        blueId: null,
        redScore: 0,
        blueScore: 0,
        redPenalties: 0,
        bluePenalties: 0,
        timeRemaining: 120
    };
    localStorage.setItem(_scopedKey('matScoreboards'), JSON.stringify(matScoreboards));
    renderActiveScoreboard();
    updateAllMatDisplays();
}

function openMatDisplay(matId) {
    // Route to the correct React-based scoreboard for this mat
    const activeMatId = currentOperatorMat || (activeScoreboardType === 'kata-flags' ? kataFlagsMatId : null);
    let url = 'kumite-scoreboard.html'; // Default — auto-redirects based on scoreboard-state
    if (matId && matId == activeMatId) {
        if (activeScoreboardType === 'kata-points') url = 'kata-scoreboard.html';
        else if (activeScoreboardType === 'kata-flags') url = 'kata-flags-scoreboard.html';
    }
    // Pass tournament ID so the scoreboard reads the correct scoped localStorage key
    const tidParam = currentTournamentId ? `?tid=${currentTournamentId}` : '';
    window.open(url + tidParam, `MatDisplay${matId}`, 'width=1920,height=1080,fullscreen=yes');
    updateAllMatDisplays();
}

function openAllScoreboards() {
    const mats = db.load('mats');
    mats.forEach(mat => {
        openMatDisplay(mat.id);
    });
}

function updateAllMatDisplays() {
    // Trigger storage event for all mat displays
    localStorage.setItem('mat-update-trigger', Date.now().toString());
}

// Load Mat Scoreboards View
function loadMatScoreboards() {
    const container = document.getElementById('mat-scoreboards-container');
    if (!container) return;

    const mats = db.load('mats');
    const matSchedule = loadMatScheduleData();
    const divisions = db.load('divisions');
    const eventTypes = db.load('eventTypes');

    container.innerHTML = '';

    mats.forEach(mat => {
        // Get scheduled divisions for this mat
        const scheduledDivisions = (matSchedule[mat.id] || []).sort((a, b) => (a.order || 0) - (b.order || 0));

        const matPanel = document.createElement('div');
        matPanel.className = 'glass-panel';
        matPanel.style.marginTop = '20px';

        matPanel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3>${mat.name}</h3>
                <button class="btn btn-primary" onclick="openTVDisplay(${mat.id})">📺 Open TV Display</button>
            </div>

            <div class="scheduled-divisions" style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 12px; color: var(--text-secondary); font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Scheduled Divisions</h4>
                ${scheduledDivisions.length > 0 ? `
                    <div class="division-list" style="display: flex; flex-direction: column; gap: 8px;">
                        ${scheduledDivisions.map(item => {
                            const eventType = eventTypes.find(et => et.id === item.eventId);
                            return `
                                <div class="division-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--glass-border); border-radius: 10px;">
                                    <div>
                                        <div style="font-weight: 600; margin-bottom: 4px;">${item.division}</div>
                                        <div style="font-size: 12px; color: var(--text-secondary);">${eventType ? eventType.name : 'Unknown Event'}</div>
                                    </div>
                                    <div style="color: var(--text-secondary); font-size: 14px;">${item.estimatedStartTime || item.legacyTime || '--:--'}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : `
                    <p style="color: var(--text-secondary); font-style: italic;">No divisions scheduled for this mat yet.</p>
                `}
            </div>

            <div class="scoreboard-controls">
                <h4 style="margin-bottom: 16px;">Scoreboard Controls</h4>
                <div id="mat-${mat.id}-scoreboard">
                    <!-- Scoreboard controls will be loaded here when a match starts -->
                    <p style="color: var(--text-secondary); font-style: italic;">Select a division from the schedule to start a match</p>
                </div>
            </div>
        `;

        container.appendChild(matPanel);
    });

    if (mats.length === 0) {
        container.innerHTML = `
            <div class="glass-panel" style="margin-top: 20px;">
                <p style="color: var(--text-secondary);">No mats configured yet. Go to <strong>Schedule</strong> to set up mats.</p>
            </div>
        `;
    }
}

// Scoreboard Settings
function saveScoreboardSettings() {
    const settings = {
        showCompetitorPhoto: document.getElementById('show-competitor-photo')?.checked ?? true,
        showClubLogo: document.getElementById('show-club-logo')?.checked ?? true,
        doubleLineNames: document.getElementById('double-line-names')?.checked ?? true,
        hideDescriptions: document.getElementById('hide-descriptions')?.checked ?? true,
        corner1Name: document.getElementById('corner1-name')?.value || 'RED',
        corner2Name: document.getElementById('corner2-name')?.value || 'BLUE',
        corner1Color: document.getElementById('corner1-color')?.value || 'red',
        corner1Custom: document.getElementById('corner1-custom')?.value || '#ff453a',
        corner2Color: document.getElementById('corner2-color')?.value || 'blue',
        corner2Custom: document.getElementById('corner2-custom')?.value || '#0a84ff',
        updatedAt: new Date().toISOString()
    };

    localStorage.setItem(_scopedKey('scoreboardSettings'), JSON.stringify(settings));
    showMessage('Scoreboard settings saved successfully!');
}

// Load scoreboard settings on page load
function loadScoreboardSettings() {
    const settings = JSON.parse(localStorage.getItem(_scopedKey('scoreboardSettings')) || '{}');

    if (document.getElementById('corner1-name')) {
        document.getElementById('corner1-name').value = settings.corner1Name || 'RED';
    }
    if (document.getElementById('corner2-name')) {
        document.getElementById('corner2-name').value = settings.corner2Name || 'BLUE';
    }
    if (document.getElementById('corner1-color')) {
        document.getElementById('corner1-color').value = settings.corner1Color || 'red';
    }
    if (document.getElementById('corner2-color')) {
        document.getElementById('corner2-color').value = settings.corner2Color || 'blue';
    }
    if (document.getElementById('corner1-custom')) {
        document.getElementById('corner1-custom').value = settings.corner1Custom || '#ff453a';
    }
    if (document.getElementById('corner2-custom')) {
        document.getElementById('corner2-custom').value = settings.corner2Custom || '#0a84ff';
    }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MAT SCHEDULE & MANAGEMENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ROUTE: Schedule tab → Configure mats and assign divisions
 *
 * FLOW:
 * 1. User sets number of mats via updateMats()
 * 2. displayMats() shows mat cards with inline editable names
 * 3. User can rename mats via updateMatName()
 * 4. Mat names persist when mat count changes
 * 5. Mat names appear in:
 *    - Schedule grid headers
 *    - Operator scoreboard title
 *    - TV display header (replaces "KARATE TOURNAMENT")
 *
 * DATA STRUCTURE:
 * mats = [
 *   {id: 1, name: "Mat 1", active: true},
 *   {id: 2, name: "Championship Ring", active: true}
 * ]
 *
 * ✅ FEATURES (2026-02-13):
 * 1. ✅ Inline editable mat name fields in mat cards
 * 2. ✅ updateMatName() function to save custom mat names
 * 3. ✅ Mat names persist when updating mat count
 * 4. ✅ updateMats() preserves existing mat names
 * 5. ✅ Mat names appear in schedule grid
 * 6. ✅ Mat names sent to TV display via updateOperatorTVDisplay()
 * 7. ✅ Input fields support blur-to-save and Enter key to save
 * 8. ✅ Max length 30 characters for mat names
 *
 * ⚠️ KNOWN ISSUES:
 * 1. No validation for duplicate mat names
 * 2. No undo for mat name changes
 * 3. Mat deletion doesn't clean up schedules
 *
 * 📝 TODO:
 * - Add duplicate name validation
 * - Add mat name history/undo
 * - Clean up schedules when mats are deleted
 * - Add mat color customization
 *
 * Last Updated: 2026-02-13
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Mat Schedule Functions
function updateMats() {
    const numMats = parseInt(document.getElementById('num-mats')?.value || 2);
    const existingMats = db.load('mats');
    const mats = [];

    for (let i = 1; i <= numMats; i++) {
        // Preserve existing mat if it exists, otherwise create new one with default name
        const existingMat = existingMats.find(m => m.id === i);
        mats.push({
            id: i,
            name: existingMat ? existingMat.name : `Mat ${i}`,
            active: true
        });
    }

    db.save('mats', mats);
    displayMats();
    showMessage(`Updated to ${numMats} mats`);
}

function displayMats() {
    const mats = db.load('mats');
    const grid = document.getElementById('mats-grid');

    if (!grid) return;

    grid.innerHTML = '';

    mats.forEach(mat => {
        const card = document.createElement('div');
        card.className = 'mat-card';
        card.innerHTML = `
            <div style="margin-bottom: 12px;">
                <label style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Mat Name</label>
                <input
                    type="text"
                    value="${mat.name}"
                    onblur="updateMatName(${mat.id}, this.value)"
                    onkeypress="if(event.key === 'Enter') { this.blur(); }"
                    style="width: 100%; padding: 8px; border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--glass-border); font-size: 14px;"
                    placeholder="Mat ${mat.id}"
                    maxlength="30"
                />
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Ring ${mat.id}</div>
            <div class="mat-status ${mat.active ? 'active' : 'inactive'}">
                ${mat.active ? 'Active' : 'Inactive'}
            </div>
        `;
        grid.appendChild(card);
    });
}

function updateMatName(matId, newName) {
    const mats = db.load('mats');
    const mat = mats.find(m => m.id === matId);

    if (mat) {
        mat.name = newName.trim() || `Mat ${matId}`;
        db.save('mats', mats);
        showMessage(`Mat renamed to "${mat.name}"`);

        // Refresh displays
        displayMats(); // Refresh the mat cards

        const scheduleView = document.getElementById('schedule-view');
        if (scheduleView && scheduleView.classList.contains('active')) {
            loadMatSchedule();
        }
    }
}

// Display Functions
function openStagingDisplay() {
    showMessage('Staging display coming soon — this feature is under development.', 'info');
}

// Certificate Functions
// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS & CERTIFICATE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

function loadSettings() {
    // Settings view now contains only Staff Roles — no additional loading needed
    // Staff roles render via createStaffRole()/etc. on demand
}

function loadTournamentInfoView() {
    loadTournamentSelector();
    const content = document.getElementById('tournament-info-content');
    const deleteNameEl = document.getElementById('delete-tournament-name');

    if (!currentTournamentId) {
        if (content) content.innerHTML = '<p class="hint">No tournament selected.</p>';
        if (deleteNameEl) deleteNameEl.textContent = '';
        return;
    }

    const tournaments = db.load('tournaments');
    const t = tournaments.find(t => String(t.id) === String(currentTournamentId));
    if (!t) {
        if (content) content.innerHTML = '<p class="hint">Tournament not found.</p>';
        return;
    }

    if (content) {
        const dateStr = t.date ? new Date(typeof t.date === 'string' && t.date.length === 10 ? t.date + 'T12:00:00' : t.date).toLocaleDateString() : '\u2014';
        content.innerHTML = `
            <div style="display: grid; gap: 10px; font-size: 14px;">
                <div><strong>Name:</strong> ${t.name || '\u2014'}</div>
                <div><strong>Date:</strong> ${dateStr}</div>
                <div><strong>Location:</strong> ${t.location || t.venue || '\u2014'}</div>
                <div><strong>Sanctioning Body:</strong> ${t.sanctioningBody ? t.sanctioningBody.toUpperCase() : '\u2014'}</div>
                <div><strong>Status:</strong> ${t.published ? 'Published' : 'Draft'}</div>
            </div>
        `;
    }

    if (deleteNameEl) {
        deleteNameEl.textContent = `You are about to delete: "${t.name}"`;
    }
}

function loadCertificatesView() {
    const template = JSON.parse(localStorage.getItem(_scopedKey('certificateTemplate')) || 'null');
    if (template && template.data) {
        const previewImg = document.getElementById('certificate-preview-img');
        const previewDiv = document.getElementById('certificate-template-preview');
        if (previewImg && previewDiv) {
            previewImg.src = template.data;
            previewDiv.style.display = 'block';
        }
        const mergePanel = document.getElementById('merge-tag-config-panel');
        if (mergePanel) mergePanel.style.display = 'block';
        loadMergeTagEditors();
    }
}

function loadSettingsEvents() {
    const container = document.getElementById('settings-events-list');
    if (!container) return;

    const eventTypes = db.load('eventTypes');
    if (!eventTypes || eventTypes.length === 0) {
        container.innerHTML = '<p class="hint">No event types configured for this tournament.</p>';
        return;
    }

    container.innerHTML = eventTypes.map(ev => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 8px; margin-bottom: 8px;">
            <div>
                <strong>${ev.name}</strong>
                ${ev.eventType ? `<span style="margin-left: 8px; opacity: 0.6; font-size: 0.85em;">${ev.eventType}</span>` : ''}
            </div>
            <button class="btn btn-small btn-danger" onclick="deleteEventFromServer(${ev.id})">Delete</button>
        </div>
    `).join('');
}

async function deleteEventFromServer(eventId) {
    if (!currentTournamentId) {
        showMessage('No tournament selected', 'error');
        return;
    }
    if (!confirm('Are you sure you want to delete this event type? This will also remove its divisions and brackets.')) {
        return;
    }

    try {
        const res = await fetch(`/api/tournaments/${currentTournamentId}/events/${eventId}`, {
            method: 'DELETE',
            credentials: 'include',
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Failed to delete event');
        }

        // Remove from localStorage
        db.delete('eventTypes', eventId);

        // Remove associated divisions
        const allDivisions = JSON.parse(localStorage.getItem(_scopedKey('divisions')) || '{}');
        delete allDivisions[eventId];
        localStorage.setItem(_scopedKey('divisions'), JSON.stringify(allDivisions));

        // Refresh UI
        loadSettingsEvents();
        loadEventTypes();
        loadEventTypeSelector();
        showMessage('Event deleted successfully');
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

async function deleteTournamentFromServer() {
    if (!currentTournamentId) {
        showMessage('No tournament selected', 'error');
        return;
    }

    // Look up tournament name for the confirmation dialog
    const tournaments = db.load('tournaments');
    const tournament = tournaments.find(t => String(t.id) === String(currentTournamentId));
    const tournamentName = tournament ? tournament.name : 'this tournament';

    if (!confirm(`Are you sure you want to permanently delete "${tournamentName}"?\n\nThis will remove all events, registrations, and brackets. This cannot be undone.`)) {
        return;
    }

    try {
        const res = await fetch(`/api/tournaments/${currentTournamentId}`, {
            method: 'DELETE',
            credentials: 'include',
        });

        // 404 means it's already gone from the server — still clean up locally
        if (!res.ok && res.status !== 404) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Failed to delete tournament');
        }

        // Clear scoped localStorage keys
        localStorage.removeItem(_scopedKey('eventTypes'));
        localStorage.removeItem(_scopedKey('divisions'));
        localStorage.removeItem(_scopedKey('scoreboardConfig'));

        // Remove from the tournaments array in localStorage so it disappears from dropdown
        const remaining = tournaments.filter(t => String(t.id) !== String(currentTournamentId));
        localStorage.setItem('tournaments', JSON.stringify(remaining));

        currentTournamentId = null;

        // Update UI immediately
        loadTournamentSelector();
        document.getElementById('main-nav').classList.add('hidden');
        const nameEl = document.getElementById('delete-tournament-name');
        if (nameEl) nameEl.textContent = '';

        showToast(`Tournament "${tournamentName}" deleted`, 'success');

        // Stay on page if there are more tournaments to delete, otherwise redirect
        const leftover = JSON.parse(localStorage.getItem('tournaments') || '[]');
        if (leftover.length === 0) {
            setTimeout(() => {
                window.location.href = '/account.html#tournaments';
            }, 1200);
        }
    } catch (err) {
        showToast(err.message || 'Failed to delete tournament', 'error');
    }
}

async function cloneTournamentFromManage() {
    if (!currentTournamentId) {
        showToast('No tournament selected', 'error');
        return;
    }
    if (!confirm('Clone this tournament? A new draft copy will be created with all events, pricing periods, and staff roles.')) return;

    const btn = document.getElementById('clone-tournament-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Cloning...'; }

    try {
        const res = await fetch(`/api/tournaments/${currentTournamentId}/clone`, {
            method: 'POST',
            credentials: 'include',
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Failed to clone tournament');
        }
        const data = await res.json();
        showToast('Tournament cloned successfully!', 'success');
        if (data.tournament && data.tournament.id) {
            setTimeout(() => {
                window.location.href = `/director/tournaments/${data.tournament.id}/manage`;
            }, 1000);
        }
    } catch (err) {
        showToast(err.message || 'Failed to clone tournament', 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Clone This Tournament'; }
    }
}

function previewCertificateTemplate() {
    const fileInput = document.getElementById('settings-certificate-template');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const previewImg = document.getElementById('certificate-preview-img');
        const previewDiv = document.getElementById('certificate-template-preview');
        previewImg.src = e.target.result;
        previewDiv.style.display = 'block';
        document.getElementById('merge-tag-config-panel').style.display = 'block';
        loadMergeTagEditors();
    };
    reader.readAsDataURL(fileInput.files[0]);
}

function clearCertificateTemplate() {
    localStorage.removeItem(_scopedKey('certificateTemplate'));
    const previewDiv = document.getElementById('certificate-template-preview');
    if (previewDiv) previewDiv.style.display = 'none';
    document.getElementById('merge-tag-config-panel').style.display = 'none';
    document.getElementById('certificate-live-preview-panel').style.display = 'none';
    const fileInput = document.getElementById('settings-certificate-template');
    if (fileInput) fileInput.value = '';
    showMessage('Certificate template removed');
}

function saveCertificateTemplate() {
    const fileInput = document.getElementById('settings-certificate-template') || document.getElementById('certificate-template');

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        showMessage('Please select a certificate template file', 'error');
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        const template = {
            fileName: file.name,
            fileType: file.type,
            data: e.target.result,
            uploadedAt: new Date().toISOString()
        };

        localStorage.setItem(_scopedKey('certificateTemplate'), JSON.stringify(template));
        showMessage('Certificate template saved successfully!');

        // Show merge tag config
        document.getElementById('merge-tag-config-panel').style.display = 'block';
        loadMergeTagEditors();
    };

    reader.readAsDataURL(file);
}

const DEFAULT_CERTIFICATE_TAGS = {
    name: { enabled: true, x: 50, y: 45, fontSize: 36, fontColor: '#000000', fontFamily: 'serif', textAlign: 'center' },
    place: { enabled: true, x: 50, y: 35, fontSize: 28, fontColor: '#DAA520', fontFamily: 'serif', textAlign: 'center' },
    division: { enabled: true, x: 50, y: 55, fontSize: 20, fontColor: '#333333', fontFamily: 'sans-serif', textAlign: 'center' },
    tournament: { enabled: true, x: 50, y: 20, fontSize: 24, fontColor: '#000000', fontFamily: 'serif', textAlign: 'center' },
    date: { enabled: true, x: 50, y: 80, fontSize: 16, fontColor: '#666666', fontFamily: 'sans-serif', textAlign: 'center' },
    club: { enabled: true, x: 50, y: 62, fontSize: 18, fontColor: '#333333', fontFamily: 'sans-serif', textAlign: 'center' }
};

const TAG_LABELS = {
    name: '{{name}} - Competitor Name',
    place: '{{place}} - Placement (1st, 2nd, 3rd)',
    division: '{{division}} - Division Name',
    tournament: '{{tournament}} - Tournament Name',
    date: '{{date}} - Tournament Date',
    club: '{{club}} - Dojo Name'
};

function loadMergeTagEditors() {
    const config = JSON.parse(localStorage.getItem(_scopedKey('certificateConfig')) || 'null');
    const tags = config?.tags || DEFAULT_CERTIFICATE_TAGS;

    const container = document.getElementById('merge-tag-list');
    if (!container) return;

    const tagNames = ['name', 'place', 'division', 'tournament', 'date', 'club'];

    container.innerHTML = tagNames.map(tag => {
        const t = tags[tag] || DEFAULT_CERTIFICATE_TAGS[tag];
        return `
            <div style="margin-bottom: 12px; padding: 12px; background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 8px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" id="tag-${tag}-enabled" ${t.enabled ? 'checked' : ''} onchange="updateCertificatePreview()">
                        <strong>${TAG_LABELS[tag]}</strong>
                    </label>
                </div>
                <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;">
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 11px;">X Position (%)</label>
                        <input type="number" id="tag-${tag}-x" value="${t.x}" min="0" max="100" onchange="updateCertificatePreview()">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 11px;">Y Position (%)</label>
                        <input type="number" id="tag-${tag}-y" value="${t.y}" min="0" max="100" onchange="updateCertificatePreview()">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 11px;">Font Size (px)</label>
                        <input type="number" id="tag-${tag}-fontSize" value="${t.fontSize}" min="8" max="120" onchange="updateCertificatePreview()">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 11px;">Color</label>
                        <input type="color" id="tag-${tag}-fontColor" value="${t.fontColor}" onchange="updateCertificatePreview()">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 11px;">Align</label>
                        <select id="tag-${tag}-textAlign" onchange="updateCertificatePreview()">
                            <option value="left" ${t.textAlign === 'left' ? 'selected' : ''}>Left</option>
                            <option value="center" ${t.textAlign === 'center' ? 'selected' : ''}>Center</option>
                            <option value="right" ${t.textAlign === 'right' ? 'selected' : ''}>Right</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function getCertificateConfigFromForm() {
    const tagNames = ['name', 'place', 'division', 'tournament', 'date', 'club'];
    const tags = {};
    tagNames.forEach(tag => {
        tags[tag] = {
            enabled: document.getElementById(`tag-${tag}-enabled`)?.checked ?? true,
            x: parseFloat(document.getElementById(`tag-${tag}-x`)?.value) || 50,
            y: parseFloat(document.getElementById(`tag-${tag}-y`)?.value) || 50,
            fontSize: parseInt(document.getElementById(`tag-${tag}-fontSize`)?.value) || 20,
            fontColor: document.getElementById(`tag-${tag}-fontColor`)?.value || '#000000',
            fontFamily: 'sans-serif',
            textAlign: document.getElementById(`tag-${tag}-textAlign`)?.value || 'center'
        };
    });
    return { tags, savedAt: new Date().toISOString() };
}

function saveCertificateConfig() {
    const config = getCertificateConfigFromForm();
    localStorage.setItem(_scopedKey('certificateConfig'), JSON.stringify(config));
    showMessage('Certificate configuration saved!');
}

function updateCertificatePreview() {
    const previewPanel = document.getElementById('certificate-live-preview-panel');
    if (!previewPanel || previewPanel.style.display === 'none') return;

    renderCertificateOnCanvas(document.getElementById('certificate-preview-canvas'), {
        name: 'John Smith',
        place: '1st Place',
        division: 'Boys 10-11 Kumite',
        tournament: 'International Karate Championship',
        date: new Date().toLocaleDateString(),
        club: 'Tiger Dojo'
    });
}

function previewCertificateWithSampleData() {
    document.getElementById('certificate-live-preview-panel').style.display = 'block';
    renderCertificateOnCanvas(document.getElementById('certificate-preview-canvas'), {
        name: 'John Smith',
        place: '1st Place',
        division: 'Boys 10-11 Kumite',
        tournament: 'International Karate Championship',
        date: new Date().toLocaleDateString(),
        club: 'Tiger Dojo'
    });
}

function renderCertificateOnCanvas(canvas, data, callback) {
    const template = JSON.parse(localStorage.getItem(_scopedKey('certificateTemplate')) || 'null');
    if (!template || !template.data) {
        if (callback) callback(null);
        return;
    }

    // Get config from form if on settings page, otherwise from localStorage
    let config;
    const formEl = document.getElementById('tag-name-enabled');
    if (formEl) {
        config = getCertificateConfigFromForm();
    } else {
        config = JSON.parse(localStorage.getItem(_scopedKey('certificateConfig')) || 'null');
    }
    if (!config) config = { tags: DEFAULT_CERTIFICATE_TAGS };

    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.onload = function() {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);

        const tagNames = ['name', 'place', 'division', 'tournament', 'date', 'club'];
        tagNames.forEach(tag => {
            const tagConfig = config.tags[tag];
            if (!tagConfig || !tagConfig.enabled) return;

            const text = data[tag] || '';
            if (!text) return;

            const x = (tagConfig.x / 100) * canvas.width;
            const y = (tagConfig.y / 100) * canvas.height;

            ctx.font = `${tagConfig.fontSize}px ${tagConfig.fontFamily || 'sans-serif'}`;
            ctx.fillStyle = tagConfig.fontColor || '#000000';
            ctx.textAlign = tagConfig.textAlign || 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, x, y);
        });

        if (callback) callback(canvas);
    };
    img.onerror = function() {
        if (callback) callback(null);
    };
    img.src = template.data;
}

function generateAllCertificates() {
    const template = JSON.parse(localStorage.getItem(_scopedKey('certificateTemplate')) || 'null');
    if (!template) {
        showMessage('Please upload a certificate template first in Settings', 'error');
        return;
    }

    const config = JSON.parse(localStorage.getItem(_scopedKey('certificateConfig')) || 'null');
    if (!config) {
        showMessage('Please configure merge tag positions in Settings first', 'error');
        return;
    }

    const divisions = db.load('divisions');
    const eventTypes = db.load('eventTypes');

    // Get tournament info
    const publicSiteConfig = JSON.parse(localStorage.getItem(_scopedKey('publicSiteConfig')) || '{}');
    const tournamentName = publicSiteConfig.tournamentName || 'Tournament';
    const tournamentDate = publicSiteConfig.tournamentDate || new Date().toLocaleDateString();

    // Collect all placements
    const certificates = [];

    Object.keys(divisions).forEach(eventId => {
        const eventData = divisions[eventId];
        if (!eventData || !eventData.generated) return;

        Object.keys(eventData.generated).forEach(divisionName => {
            const results = getDivisionResults(divisionName, eventId);
            const placeLabels = ['1st Place', '2nd Place', '3rd Place'];

            results.forEach((result, idx) => {
                if (idx > 2) return; // Top 3 only
                certificates.push({
                    name: result.name,
                    place: placeLabels[result.rank - 1] || `${result.rank}th Place`,
                    division: divisionName,
                    tournament: tournamentName,
                    date: tournamentDate,
                    club: result.club || ''
                });
            });
        });
    });

    if (certificates.length === 0) {
        showMessage('No completed divisions with results found.', 'error');
        return;
    }

    showMessage(`Generating ${certificates.length} certificates...`, 'info');

    let generated = 0;
    const offscreenCanvas = document.createElement('canvas');

    function generateNext() {
        if (generated >= certificates.length) {
            showMessage(`Successfully generated ${generated} certificates!`);
            return;
        }

        const certData = certificates[generated];
        renderCertificateOnCanvas(offscreenCanvas, certData, function(canvas) {
            if (!canvas) {
                generated++;
                setTimeout(generateNext, 50);
                return;
            }

            const link = document.createElement('a');
            link.download = `certificate_${certData.name.replace(/\s+/g, '_')}_${certData.division.replace(/\s+/g, '_')}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

            generated++;
            setTimeout(generateNext, 300);
        });
    }

    generateNext();
}

// ═══════════════════════════════════════════════════════════════════════════
// CERTIFICATE SERVER SYNC
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Upload the current certificate template (from file input) to the server.
 */
async function syncCertificateTemplateToServer() {
    if (!currentTournamentId) {
        showMessage('No tournament selected', 'error');
        return;
    }

    const fileInput = document.getElementById('settings-certificate-template');
    const statusEl = document.getElementById('cert-sync-status');

    // Check for a file in the file input first
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const formData = new FormData();
        formData.append('template', fileInput.files[0]);

        try {
            if (statusEl) statusEl.textContent = 'Uploading template to server...';
            const res = await fetch(`/api/tournaments/${currentTournamentId}/certificate-template`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Upload failed');
            }

            // Also sync the config if available
            await syncCertificateConfigToServerSilent();

            if (statusEl) statusEl.textContent = 'Template synced to server successfully.';
            showMessage('Certificate template synced to server!');
        } catch (err) {
            if (statusEl) statusEl.textContent = 'Sync failed: ' + err.message;
            showMessage('Failed to sync template: ' + err.message, 'error');
        }
        return;
    }

    // Fallback: try to upload from localStorage base64 data
    const template = JSON.parse(localStorage.getItem(_scopedKey('certificateTemplate')) || 'null');
    if (!template || !template.data) {
        showMessage('No certificate template to sync. Please select or save a template first.', 'error');
        return;
    }

    // Convert base64 data URL back to a Blob for upload
    try {
        if (statusEl) statusEl.textContent = 'Uploading template to server...';

        const dataUrlParts = template.data.split(',');
        const mimeMatch = dataUrlParts[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/png';
        const byteString = atob(dataUrlParts[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mime });

        const formData = new FormData();
        const ext = mime.split('/')[1] || 'png';
        formData.append('template', blob, template.fileName || `template.${ext}`);

        const res = await fetch(`/api/tournaments/${currentTournamentId}/certificate-template`, {
            method: 'POST',
            credentials: 'include',
            body: formData,
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Upload failed');
        }

        // Also sync the config
        await syncCertificateConfigToServerSilent();

        if (statusEl) statusEl.textContent = 'Template synced to server successfully.';
        showMessage('Certificate template synced to server!');
    } catch (err) {
        if (statusEl) statusEl.textContent = 'Sync failed: ' + err.message;
        showMessage('Failed to sync template: ' + err.message, 'error');
    }
}

/**
 * Save the current merge-tag config to the server (silently, used as part of template sync).
 */
async function syncCertificateConfigToServerSilent() {
    if (!currentTournamentId) return;

    const config = JSON.parse(localStorage.getItem(_scopedKey('certificateConfig')) || 'null');
    if (!config) return;

    try {
        await fetch(`/api/tournaments/${currentTournamentId}/certificate-template/config`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
        });
    } catch (err) {
        console.warn('Could not sync certificate config:', err.message);
    }
}

/**
 * Save the certificate merge-tag config to the server (with user feedback).
 */
async function saveCertificateConfigToServer() {
    if (!currentTournamentId) {
        showMessage('No tournament selected', 'error');
        return;
    }

    const config = getCertificateConfigFromForm();
    // Also save locally
    localStorage.setItem(_scopedKey('certificateConfig'), JSON.stringify(config));

    try {
        const res = await fetch(`/api/tournaments/${currentTournamentId}/certificate-template/config`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Save failed');
        }

        showMessage('Certificate configuration saved to server!');
    } catch (err) {
        showMessage('Failed to save config to server: ' + err.message, 'error');
    }
}

/**
 * Load the certificate template and config from the server into localStorage.
 */
async function loadCertificateTemplateFromServer() {
    if (!currentTournamentId) {
        showMessage('No tournament selected', 'error');
        return;
    }

    const statusEl = document.getElementById('cert-sync-status');

    try {
        if (statusEl) statusEl.textContent = 'Loading template from server...';

        const res = await fetch(`/api/tournaments/${currentTournamentId}/certificate-template`, {
            credentials: 'include',
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Load failed');
        }

        const { template } = await res.json();
        if (!template) {
            if (statusEl) statusEl.textContent = 'No template found on server.';
            showMessage('No certificate template found on server for this tournament.', 'info');
            return;
        }

        // Save template data to localStorage
        if (template.template_data) {
            const templateObj = {
                fileName: 'server-template.png',
                fileType: 'image/png',
                data: template.template_data,
                uploadedAt: template.updated_at || new Date().toISOString(),
            };
            localStorage.setItem(_scopedKey('certificateTemplate'), JSON.stringify(templateObj));

            // Update preview
            const previewImg = document.getElementById('certificate-preview-img');
            const previewDiv = document.getElementById('certificate-template-preview');
            if (previewImg && previewDiv) {
                previewImg.src = template.template_data;
                previewDiv.style.display = 'block';
            }
        }

        // Save merge tag config to localStorage
        if (template.merge_tag_config && Object.keys(template.merge_tag_config).length > 0) {
            localStorage.setItem(_scopedKey('certificateConfig'), JSON.stringify(template.merge_tag_config));
            document.getElementById('merge-tag-config-panel').style.display = 'block';
            loadMergeTagEditors();
        }

        if (statusEl) statusEl.textContent = 'Template loaded from server.';
        showMessage('Certificate template loaded from server!');
    } catch (err) {
        if (statusEl) statusEl.textContent = 'Load failed: ' + err.message;
        showMessage('Failed to load template: ' + err.message, 'error');
    }
}

/**
 * Download a batch PDF of all certificates from the server.
 */
async function downloadBatchCertificatePDF() {
    if (!currentTournamentId) {
        showMessage('No tournament selected', 'error');
        return;
    }

    showMessage('Generating batch certificate PDF...', 'info');

    try {
        const res = await fetch(`/api/tournaments/${currentTournamentId}/certificates/batch.pdf`, {
            credentials: 'include',
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'PDF generation failed');
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `certificates-${currentTournamentId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showMessage('Batch certificate PDF downloaded!');
    } catch (err) {
        showMessage('Failed to generate PDF: ' + err.message, 'error');
    }
}

// Scoreboard (keeping old single scoreboard for compatibility)
let redScore = 0;
let blueScore = 0;
let redPenalties = 0;
let bluePenalties = 0;
let timerInterval = null;
let timeRemaining = 120;
let redCompetitor = null;
let blueCompetitor = null;

function updateCompetitorSelects() {
    const competitors = db.load('competitors');
    const selects = [
        document.getElementById('red-competitor-select'),
        document.getElementById('blue-competitor-select')
    ];

    selects.forEach(select => {
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = '<option value="">-- Select Competitor --</option>';
        competitors.forEach(comp => {
            const option = document.createElement('option');
            option.value = comp.id;
            option.textContent = `${comp.firstName} ${comp.lastName} - ${comp.club}`;
            select.appendChild(option);
        });
        select.value = currentValue;
    });
}

function selectCompetitor(corner) {
    const selectId = corner === 'red' ? 'red-competitor-select' : 'blue-competitor-select';
    const competitorId = parseInt(document.getElementById(selectId).value);

    if (!competitorId) {
        if (corner === 'red') {
            redCompetitor = null;
            document.getElementById('red-name').textContent = 'Red Corner';
            document.getElementById('red-info').textContent = '';
            document.getElementById('red-photo').classList.add('hidden');
        } else {
            blueCompetitor = null;
            document.getElementById('blue-name').textContent = 'Blue Corner';
            document.getElementById('blue-info').textContent = '';
            document.getElementById('blue-photo').classList.add('hidden');
        }
        updateTVDisplay();
        return;
    }

    const competitors = db.load('competitors');
    const competitor = competitors.find(c => c.id === competitorId);

    if (competitor) {
        const info = `${getDisplayAge(competitor)} yrs | ${competitor.weight}kg | ${competitor.rank} | ${competitor.club}`;

        if (corner === 'red') {
            redCompetitor = competitor;
            document.getElementById('red-name').textContent = `${competitor.firstName} ${competitor.lastName}`.toUpperCase();
            document.getElementById('red-info').textContent = info;

            const photoEl = document.getElementById('red-photo');
            if (competitor.photo) {
                photoEl.src = competitor.photo;
                photoEl.classList.remove('hidden');
            } else {
                photoEl.classList.add('hidden');
            }
        } else {
            blueCompetitor = competitor;
            document.getElementById('blue-name').textContent = `${competitor.firstName} ${competitor.lastName}`.toUpperCase();
            document.getElementById('blue-info').textContent = info;

            const photoEl = document.getElementById('blue-photo');
            if (competitor.photo) {
                photoEl.src = competitor.photo;
                photoEl.classList.remove('hidden');
            } else {
                photoEl.classList.add('hidden');
            }
        }

        updateTVDisplay();
    }
}

function openTVDisplay(matId) {
    const windowName = matId ? `TVDisplay_Mat${matId}` : 'TVDisplay';
    const tidParam = currentTournamentId ? `?tid=${currentTournamentId}` : '';

    // If there's an active operator session for this mat, route to the right scoreboard file
    const activeMatId = currentOperatorMat || (activeScoreboardType === 'kata-flags' ? kataFlagsMatId : null);
    if (matId && matId == activeMatId) {
        if (activeScoreboardType === 'kata-points') {
            window.open(`/kata-scoreboard.html${tidParam}`, windowName, 'width=1920,height=1080,fullscreen=yes');
            return;
        } else if (activeScoreboardType === 'kumite') {
            window.open(`/kumite-scoreboard.html${tidParam}`, windowName, 'width=1920,height=1080,fullscreen=yes');
            updateOperatorTVDisplay();
            return;
        } else if (activeScoreboardType === 'kata-flags') {
            window.open(`/kata-flags-scoreboard.html${tidParam}`, windowName, 'width=1920,height=1080,fullscreen=yes');
            updateKataFlagsTVDisplay();
            return;
        }
    }

    // Default: kumite scoreboard (auto-redirects if scoreboard type changes)
    window.open(`/kumite-scoreboard.html${tidParam}`, windowName, 'width=1920,height=1080,fullscreen=yes');
    updateTVDisplay();
}

function updateTVDisplay() {
    // Only update if standalone scoreboard is active (or no operator is active)
    if (activeScoreboardType !== null && activeScoreboardType !== 'standalone') {
        console.log('updateTVDisplay: Standalone not active, skipping update');
        return;
    }

    const scoreboardType = document.querySelector('input[name="scoreboard-type"]:checked')?.value || 'wkf';

    const state = {
        scoreboardType: 'kumite', // Standalone scoreboard is kumite-style
        redName: redCompetitor ? `${redCompetitor.firstName} ${redCompetitor.lastName}`.toUpperCase() : 'RED CORNER',
        redInfo: redCompetitor ? `${getDisplayAge(redCompetitor)} yrs | ${redCompetitor.weight}kg | ${redCompetitor.rank} | ${redCompetitor.club}` : '',
        redPhoto: redCompetitor?.photo || null,
        redScore: redScore,
        redPenalties: redPenalties,

        blueName: blueCompetitor ? `${blueCompetitor.firstName} ${blueCompetitor.lastName}`.toUpperCase() : 'BLUE CORNER',
        blueInfo: blueCompetitor ? `${getDisplayAge(blueCompetitor)} yrs | ${blueCompetitor.weight}kg | ${blueCompetitor.rank} | ${blueCompetitor.club}` : '',
        bluePhoto: blueCompetitor?.photo || null,
        blueScore: blueScore,
        bluePenalties: bluePenalties,

        timer: document.getElementById('timer')?.textContent || '2:00',
        scoringType: scoreboardType,
        winner: null
    };

    localStorage.setItem(_scopedKey('scoreboard-state'), JSON.stringify(state));
}

function addScore(corner, points) {
    const scoreboardType = document.querySelector('input[name="scoreboard-type"]:checked').value;

    if (corner === 'red') {
        redScore += points;
        document.getElementById('red-score').textContent = redScore;
    } else {
        blueScore += points;
        document.getElementById('blue-score').textContent = blueScore;
    }

    updateTVDisplay();

    if (scoreboardType === 'wkf' && Math.abs(redScore - blueScore) >= 8) {
        pauseTimer();
        setTimeout(() => {
            showToast(`${redScore > blueScore ? 'Red' : 'Blue'} corner wins by 8-point difference!`, 'success', 5000);
        }, 100);
    }
}

function addPenalty(corner) {
    if (corner === 'red') {
        redPenalties++;
        document.getElementById('red-penalties').textContent = redPenalties;
    } else {
        bluePenalties++;
        document.getElementById('blue-penalties').textContent = bluePenalties;
    }

    const penaltyCount = corner === 'red' ? redPenalties : bluePenalties;

    // WKF-style escalation based on penalty count:
    // 1st (Chukoku): Warning only - no score
    // 2nd (Keikoku): +1 point to opponent (Yuko)
    // 3rd (Hansoku-chui): +2 points to opponent (Waza-ari)
    // 4th+ (Hansoku): Disqualification
    if (penaltyCount === 2) {
        addScore(corner === 'red' ? 'blue' : 'red', 1);
    } else if (penaltyCount === 3) {
        addScore(corner === 'red' ? 'blue' : 'red', 2);
    } else if (penaltyCount >= 4) {
        pauseTimer();
        setTimeout(() => {
            showToast(`${corner.charAt(0).toUpperCase() + corner.slice(1)} corner is disqualified! (Hansoku - 4th penalty)`, 'error', 5000);
        }, 100);
    }

    updateTVDisplay();
}

function startTimer() {
    if (timerInterval) return;

    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();

        if (timeRemaining <= 0) {
            pauseTimer();
            setTimeout(() => {
                showToast('Time is up!', 'warning');
            }, 100);
        }
    }, 1000);
}

function pauseTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function resetTimer() {
    pauseTimer();
    timeRemaining = 120;
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    document.getElementById('timer').textContent =
        `${minutes}:${seconds.toString().padStart(2, '0')}`;
    updateTVDisplay();
}

function declareWinner() {
    pauseTimer();
    let winner;
    let winnerName;

    if (redScore > blueScore) {
        winner = 'Red Corner';
        winnerName = redCompetitor ? `${redCompetitor.firstName} ${redCompetitor.lastName}`.toUpperCase() : 'RED CORNER';
    } else if (blueScore > redScore) {
        winner = 'Blue Corner';
        winnerName = blueCompetitor ? `${blueCompetitor.firstName} ${blueCompetitor.lastName}`.toUpperCase() : 'BLUE CORNER';
    } else {
        winner = 'Draw';
        winnerName = 'DRAW';
    }

    // Update TV display with winner
    const state = JSON.parse(localStorage.getItem(_scopedKey('scoreboard-state')) || '{}');
    state.winner = winnerName;
    localStorage.setItem(_scopedKey('scoreboard-state'), JSON.stringify(state));

    showToast(`Winner: ${winner} | Red: ${redScore} - Blue: ${blueScore}`, 'success', 5000);
}

function resetScoreboard() {
    redScore = 0;
    blueScore = 0;
    redPenalties = 0;
    bluePenalties = 0;

    document.getElementById('red-score').textContent = '0';
    document.getElementById('blue-score').textContent = '0';
    document.getElementById('red-penalties').textContent = '0';
    document.getElementById('blue-penalties').textContent = '0';

    resetTimer();
    updateTVDisplay();
}

// Utility Functions
function convertToCSV(objArray) {
    const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray;
    let str = '';

    if (array.length === 0) return str;

    const headers = Object.keys(array[0]);
    str += headers.map(h => escapeCSV(h)).join(',') + '\n';

    array.forEach(obj => {
        const line = headers.map(header => escapeCSV(obj[header]));
        str += line.join(',') + '\n';
    });

    return str;
}

function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Search functionality for competitors
document.getElementById('competitor-search')?.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#competitors-tbody tr');

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
});

// Public Site Configuration
let currentPublicCoverData = null;
let currentPublicLogoData = null;

document.getElementById('public-cover-image')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            currentPublicCoverData = event.target.result;
            document.getElementById('public-cover-preview-img').src = currentPublicCoverData;
            document.getElementById('public-cover-preview').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('public-logo')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            currentPublicLogoData = event.target.result;
            document.getElementById('public-logo-preview-img').src = currentPublicLogoData;
            document.getElementById('public-logo-preview').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
});

function clearPublicCover() {
    currentPublicCoverData = null;
    document.getElementById('public-cover-image').value = '';
    document.getElementById('public-cover-preview').classList.add('hidden');
}

function clearPublicLogo() {
    currentPublicLogoData = null;
    document.getElementById('public-logo').value = '';
    document.getElementById('public-logo-preview').classList.add('hidden');
}

const publicSiteForm = document.getElementById('public-site-form');
if (publicSiteForm) {
    publicSiteForm.addEventListener('submit', (e) => {
        e.preventDefault();

        try {
            const config = {
                tournamentId: currentTournamentId || null,
                tournamentName: document.getElementById('public-tournament-name')?.value || '',
                tournamentDate: document.getElementById('public-tournament-date')?.value || '',
                location: document.getElementById('public-location')?.value || '',
                description: document.getElementById('public-description')?.value || '',
                primaryColor: document.getElementById('public-primary-color')?.value || '#0071e3',
                coverImage: currentPublicCoverData || JSON.parse(localStorage.getItem(_scopedKey('publicSiteConfig')) || '{}').coverImage || null,
                logo: currentPublicLogoData || JSON.parse(localStorage.getItem(_scopedKey('publicSiteConfig')) || '{}').logo || null,
                footerText: document.getElementById('public-footer-text')?.value || '',
                showSchedule: document.getElementById('public-show-schedule')?.checked || false,
                showResults: document.getElementById('public-show-results')?.checked || false,
                updatedAt: new Date().toISOString()
            };

            localStorage.setItem(_scopedKey('publicSiteConfig'), JSON.stringify(config));
            showMessage('Public site configuration saved successfully!');

            // Trigger storage event for public.html to update
            window.dispatchEvent(new Event('storage'));
        } catch (error) {
            console.error('Error saving public site config:', error);
            showMessage('Error saving configuration. Check console for details.');
        }
    });
}

function loadPublicSiteConfig() {
    const config = JSON.parse(localStorage.getItem(_scopedKey('publicSiteConfig')) || '{}');

    const nameInput = document.getElementById('public-tournament-name');
    const dateInput = document.getElementById('public-tournament-date');
    const locationInput = document.getElementById('public-location');
    const descInput = document.getElementById('public-description');
    const colorInput = document.getElementById('public-primary-color');
    const footerInput = document.getElementById('public-footer-text');
    const scheduleCheckbox = document.getElementById('public-show-schedule');
    const resultsCheckbox = document.getElementById('public-show-results');

    if (config.tournamentName && nameInput) {
        nameInput.value = config.tournamentName;
    }
    if (config.tournamentDate && dateInput) {
        dateInput.value = config.tournamentDate;
    }
    if (config.location && locationInput) {
        locationInput.value = config.location;
    }
    if (config.description && descInput) {
        descInput.value = config.description;
    }
    if (config.primaryColor && colorInput) {
        colorInput.value = config.primaryColor;
    }
    if (config.footerText && footerInput) {
        footerInput.value = config.footerText;
    }
    if (config.showSchedule && scheduleCheckbox) {
        scheduleCheckbox.checked = true;
    }
    if (config.showResults && resultsCheckbox) {
        resultsCheckbox.checked = true;
    }

    // Load preview images
    if (config.coverImage) {
        currentPublicCoverData = config.coverImage;
        const coverImg = document.getElementById('public-cover-preview-img');
        const coverPreview = document.getElementById('public-cover-preview');
        if (coverImg) coverImg.src = config.coverImage;
        if (coverPreview) coverPreview.classList.remove('hidden');
    }
    if (config.logo) {
        currentPublicLogoData = config.logo;
        const logoImg = document.getElementById('public-logo-preview-img');
        const logoPreview = document.getElementById('public-logo-preview');
        if (logoImg) logoImg.src = config.logo;
        if (logoPreview) logoPreview.classList.remove('hidden');
    }
}

function openPublicSite() {
    window.open('/public.html', 'PublicSite', 'width=1200,height=800');
}

function copyPublicSiteUrl() {
    const url = window.location.href.replace('index.html', 'public.html');
    document.getElementById('public-site-url').value = url;

    navigator.clipboard.writeText(url).then(() => {
        showMessage('Public site URL copied to clipboard!');
    }).catch(() => {
        // Fallback for older browsers
        document.getElementById('public-site-url').select();
        document.execCommand('copy');
        showMessage('Public site URL copied to clipboard!');
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// DOJO VIEW — Coach dashboard for managing dojo, members, registrations
// ═══════════════════════════════════════════════════════════════════════════

let currentAcademy = null;
let currentAcademyMembers = [];

async function checkCoachAcademySetup() {
    try {
        const res = await fetch('/api/academies/my', { credentials: 'include' });
        if (res.status === 404) {
            // No academy yet — auto-navigate to academy setup
            const academyBtn = document.querySelector('[data-view="academy"]');
            if (academyBtn) academyBtn.click();
        }
    } catch (err) {
        // Silently fail
    }
}

async function loadAcademyView() {
    const setupPanel = document.getElementById('academy-setup-panel');
    const dashboard = document.getElementById('academy-dashboard');

    try {
        const res = await fetch('/api/academies/my', { credentials: 'include' });
        if (res.status === 404) {
            // No academy — show setup
            setupPanel.classList.remove('hidden');
            dashboard.classList.add('hidden');
            return;
        }

        const data = await res.json();
        currentAcademy = data.academy;
        currentAcademyMembers = data.members || [];

        setupPanel.classList.add('hidden');
        dashboard.classList.remove('hidden');

        renderAcademyProfile();
        loadAcademyRoster();
        loadMembershipRequests();
    } catch (err) {
        console.error('Failed to load academy:', err);
    }
}

function renderAcademyProfile() {
    if (!currentAcademy) return;

    const nameEl = document.getElementById('academy-name-display');
    const coachEl = document.getElementById('academy-coach-display');
    const countEl = document.getElementById('academy-member-count');
    const locationEl = document.getElementById('academy-location-display');
    const logoImg = document.getElementById('academy-logo-img');
    const logoPlaceholder = document.getElementById('academy-logo-placeholder');

    nameEl.textContent = currentAcademy.name;
    const coach = Auth.currentUser;
    coachEl.textContent = coach ? `Head Coach: ${coach.firstName} ${coach.lastName}` : 'Head Coach: —';
    countEl.textContent = `${currentAcademyMembers.length} Member${currentAcademyMembers.length !== 1 ? 's' : ''}`;

    const parts = [currentAcademy.city, currentAcademy.state].filter(Boolean);
    locationEl.textContent = parts.length > 0 ? parts.join(', ') : '';

    if (currentAcademy.logo_url) {
        logoImg.src = currentAcademy.logo_url;
        logoImg.style.display = 'block';
        logoPlaceholder.style.display = 'none';
    } else {
        logoImg.style.display = 'none';
        logoPlaceholder.style.display = 'flex';
    }

    // Re-init lucide icons
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function handleCreateAcademy(e) {
    e.preventDefault();
    try {
        const res = await fetch('/api/academies', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: document.getElementById('setup-academy-name').value,
                address: document.getElementById('setup-academy-address').value || undefined,
                city: document.getElementById('setup-academy-city').value || undefined,
                state: document.getElementById('setup-academy-state').value || undefined,
                website: document.getElementById('setup-academy-website').value || undefined,
            }),
        });

        const data = await res.json();
        if (!res.ok) {
            showToast(data.error || 'Failed to create dojo', 'error');
            return;
        }

        sessionStorage.setItem('academyPromptDismissed', '1');
        loadAcademyView();
    } catch (err) {
        showToast('Error creating dojo: ' + err.message, 'error');
    }
}

async function handleLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
        showToast('Logo must be under 2MB', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('logo', file);

    try {
        const res = await fetch(`/api/academies/${currentAcademy.id}/logo`, {
            method: 'POST',
            credentials: 'include',
            body: formData,
        });

        const data = await res.json();
        if (!res.ok) {
            showToast(data.error || 'Failed to upload logo', 'error');
            return;
        }

        currentAcademy = data.academy;
        renderAcademyProfile();
    } catch (err) {
        showToast('Error uploading logo: ' + err.message, 'error');
    }
}

function showEditAcademyForm() {
    document.getElementById('academy-edit-form').classList.remove('hidden');
    document.getElementById('edit-academy-btn').classList.add('hidden');
    document.getElementById('edit-academy-name').value = currentAcademy.name || '';
    document.getElementById('edit-academy-address').value = currentAcademy.address || '';
    document.getElementById('edit-academy-city').value = currentAcademy.city || '';
    document.getElementById('edit-academy-state').value = currentAcademy.state || '';
    document.getElementById('edit-academy-website').value = currentAcademy.website || '';
}

function hideEditAcademyForm() {
    document.getElementById('academy-edit-form').classList.add('hidden');
    document.getElementById('edit-academy-btn').classList.remove('hidden');
}

async function handleEditAcademy() {
    try {
        const res = await fetch(`/api/academies/${currentAcademy.id}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: document.getElementById('edit-academy-name').value,
                address: document.getElementById('edit-academy-address').value || null,
                city: document.getElementById('edit-academy-city').value || null,
                state: document.getElementById('edit-academy-state').value || null,
                website: document.getElementById('edit-academy-website').value || null,
            }),
        });

        const data = await res.json();
        if (!res.ok) {
            showToast(data.error || 'Failed to update dojo', 'error');
            return;
        }

        currentAcademy = data.academy;
        renderAcademyProfile();
        hideEditAcademyForm();
    } catch (err) {
        showToast('Error updating dojo: ' + err.message, 'error');
    }
}

function switchAcademyTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.academy-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-academy-tab="${tab}"]`)?.classList.add('active');

    // Update tab panels
    document.querySelectorAll('.academy-tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`academy-tab-${tab}`)?.classList.add('active');

    // Load data for tab
    if (tab === 'roster') loadAcademyRoster();
    if (tab === 'registrations') loadAcademyRegistrations();
    if (tab === 'requests') loadMembershipRequests();
}

function loadAcademyRoster() {
    const container = document.getElementById('academy-roster-list');
    if (!currentAcademyMembers || currentAcademyMembers.length === 0) {
        container.innerHTML = '<p class="hint">No members yet. Go to "Add Member" to register competitors or coaches.</p>';
        return;
    }

    const roleLabels = { head_coach: 'Head Coach', assistant_coach: 'Assistant Coach', competitor: 'Competitor' };
    const roleColors = { head_coach: '#f39c12', assistant_coach: '#3498db', competitor: '#2ecc71' };

    let html = '<table class="data-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead><tbody>';
    for (const m of currentAcademyMembers) {
        const initial = (m.firstName || '?')[0].toUpperCase();
        const roleLabel = roleLabels[m.role] || m.role;
        const roleColor = roleColors[m.role] || '#888';
        const isHeadCoach = m.role === 'head_coach';

        html += `<tr>
            <td>
                <div style="display:flex;align-items:center;gap:8px;">
                    <div class="member-avatar" style="background:${roleColor}20;color:${roleColor};">${initial}</div>
                    <span>${m.firstName || ''} ${m.lastName || ''}</span>
                </div>
            </td>
            <td>${m.email || '—'}</td>
            <td><span class="member-role-badge" style="background:${roleColor}20;color:${roleColor};">${roleLabel}</span></td>
            <td>${isHeadCoach ? '' : `<button class="btn btn-ghost btn-sm" style="color:var(--error);" onclick="handleRemoveMember('${m.id}')" title="Remove">✕</button>`}</td>
        </tr>`;
    }
    html += '</tbody></table>';
    container.innerHTML = html;
}

function checkCompetitorMinor() {
    const dob = document.getElementById('reg-comp-dob').value;
    const notice = document.getElementById('minor-guardian-notice');
    if (!dob) {
        notice.classList.add('hidden');
        return;
    }
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;

    if (age < 18) {
        notice.classList.remove('hidden');
    } else {
        notice.classList.add('hidden');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function handleRegisterCompetitor(e) {
    e.preventDefault();
    const statusEl = document.getElementById('reg-comp-status');
    statusEl.textContent = 'Registering...';
    statusEl.className = 'form-status';

    try {
        const res = await fetch(`/api/academies/${currentAcademy.id}/register-competitor`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                firstName: document.getElementById('reg-comp-first').value,
                lastName: document.getElementById('reg-comp-last').value,
                email: document.getElementById('reg-comp-email').value,
                dateOfBirth: document.getElementById('reg-comp-dob').value || undefined,
                phone: document.getElementById('reg-comp-phone').value || undefined,
            }),
        });

        const data = await res.json();
        if (!res.ok) {
            statusEl.textContent = data.error || 'Registration failed';
            statusEl.className = 'form-status error';
            return;
        }

        statusEl.textContent = data.message;
        statusEl.className = 'form-status success';
        document.getElementById('register-competitor-form').reset();
        document.getElementById('minor-guardian-notice').classList.add('hidden');

        // Refresh roster
        loadAcademyView();
    } catch (err) {
        statusEl.textContent = 'Error: ' + err.message;
        statusEl.className = 'form-status error';
    }
}

async function handleRegisterAssistant(e) {
    e.preventDefault();
    const statusEl = document.getElementById('reg-asst-status');
    statusEl.textContent = 'Registering...';
    statusEl.className = 'form-status';

    try {
        const res = await fetch(`/api/academies/${currentAcademy.id}/register-assistant`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                firstName: document.getElementById('reg-asst-first').value,
                lastName: document.getElementById('reg-asst-last').value,
                email: document.getElementById('reg-asst-email').value,
            }),
        });

        const data = await res.json();
        if (!res.ok) {
            statusEl.textContent = data.error || 'Registration failed';
            statusEl.className = 'form-status error';
            return;
        }

        statusEl.textContent = data.message;
        statusEl.className = 'form-status success';
        document.getElementById('register-assistant-form').reset();

        // Refresh roster
        loadAcademyView();
    } catch (err) {
        statusEl.textContent = 'Error: ' + err.message;
        statusEl.className = 'form-status error';
    }
}

async function handleRemoveMember(userId) {
    if (!confirm('Remove this member from your dojo?')) return;

    try {
        const res = await fetch(`/api/academies/${currentAcademy.id}/members/${userId}`, {
            method: 'DELETE',
            credentials: 'include',
        });

        if (!res.ok) {
            const data = await res.json();
            showToast(data.error || 'Failed to remove member', 'error');
            return;
        }

        loadAcademyView();
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

async function loadAcademyRegistrations() {
    const container = document.getElementById('academy-registrations-list');
    container.innerHTML = '<p class="hint">Loading...</p>';

    try {
        const res = await fetch(`/api/academies/${currentAcademy.id}/registrations`, { credentials: 'include' });
        const data = await res.json();

        if (!data.registrations || data.registrations.length === 0) {
            container.innerHTML = '<p class="hint">No registrations yet.</p>';
            return;
        }

        let html = '<table class="data-table"><thead><tr><th>Competitor</th><th>Status</th><th>Payment</th><th>Total Due</th><th>Date</th></tr></thead><tbody>';
        for (const r of data.registrations) {
            const statusClass = r.status === 'active' ? 'success' : (r.status === 'pending_guardian' ? 'warning' : '');
            html += `<tr>
                <td>${r.firstName || ''} ${r.lastName || ''}</td>
                <td><span class="status-badge ${statusClass}">${r.status || 'active'}</span></td>
                <td><span class="status-badge">${r.paymentStatus}</span></td>
                <td>$${(r.totalDue || 0).toFixed(2)}</td>
                <td>${r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}</td>
            </tr>`;
        }
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = '<p class="hint" style="color:var(--error);">Failed to load registrations.</p>';
    }
}

async function loadMembershipRequests() {
    const container = document.getElementById('academy-requests-list');
    const badge = document.getElementById('requests-badge');

    if (!currentAcademy) return;

    try {
        const res = await fetch(`/api/academies/${currentAcademy.id}/membership-requests`, { credentials: 'include' });
        const data = await res.json();

        const requests = data.requests || [];

        // Update badge
        if (requests.length > 0) {
            badge.textContent = requests.length;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }

        if (requests.length === 0) {
            container.innerHTML = '<p class="hint">No pending requests.</p>';
            return;
        }

        let html = '';
        for (const r of requests) {
            html += `<div class="request-card">
                <div class="request-info">
                    <strong>${r.firstName || ''} ${r.lastName || ''}</strong>
                    <span class="hint">${r.email}</span>
                    <span class="hint">Requested: ${new Date(r.requestedAt).toLocaleDateString()}</span>
                </div>
                <div class="request-actions">
                    <button class="btn btn-primary btn-sm" onclick="handleReviewRequest('${r.id}', 'approve')">Approve</button>
                    <button class="btn btn-ghost btn-sm" onclick="handleReviewRequest('${r.id}', 'deny')">Deny</button>
                </div>
            </div>`;
        }
        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = '<p class="hint">Unable to load requests.</p>';
    }
}

async function handleReviewRequest(requestId, action) {
    try {
        const res = await fetch(`/api/academies/${currentAcademy.id}/membership-requests/${requestId}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action }),
        });

        if (!res.ok) {
            const data = await res.json();
            showToast(data.error || 'Failed to review request', 'error');
            return;
        }

        loadMembershipRequests();
        if (action === 'approve') loadAcademyView(); // Refresh roster too
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVER SYNC — Pull registrations from PostgreSQL into localStorage
// ═══════════════════════════════════════════════════════════════════════════

let syncInterval = null;

async function syncRegistrationsFromServer() {
    const btn = document.getElementById('sync-server-btn');
    const status = document.getElementById('sync-status');
    if (btn) { btn.disabled = true; btn.textContent = '🔄 Syncing...'; }

    try {
        const tournamentId = currentTournamentId || '';
        const url = tournamentId
            ? `/api/registrations?tournamentId=${tournamentId}`
            : '/api/registrations';

        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) {
            if (res.status === 401) throw new Error('Not authenticated');
            throw new Error('Sync failed');
        }
        const data = await res.json();
        const serverRegistrations = data.registrations || [];

        // Filter to competitors only
        const serverCompetitors = serverRegistrations.filter(r => !r.type || r.type === undefined);

        if (serverCompetitors.length === 0) {
            if (status) {
                status.textContent = 'No server registrations found.';
                status.classList.remove('hidden');
                setTimeout(() => status.classList.add('hidden'), 3000);
            }
            return;
        }

        // Merge into localStorage — dedup by email OR firstName+lastName+dateOfBirth
        const existing = db.load('competitors');
        let added = 0;

        serverCompetitors.forEach(sc => {
            const isDuplicate = existing.some(ec => {
                // Match by email
                if (sc.email && ec.email && sc.email.toLowerCase() === ec.email.toLowerCase()) return true;
                // Match by name + DOB
                if (sc.firstName && ec.firstName && sc.lastName && ec.lastName &&
                    sc.firstName.toLowerCase() === ec.firstName.toLowerCase() &&
                    sc.lastName.toLowerCase() === ec.lastName.toLowerCase() &&
                    sc.dateOfBirth === ec.dateOfBirth) return true;
                // Match by serverRegistrationId (already synced)
                if (sc.serverRegistrationId && ec.serverRegistrationId &&
                    sc.serverRegistrationId === ec.serverRegistrationId) return true;
                return false;
            });

            if (!isDuplicate) {
                // Assign a numeric ID for localStorage compatibility
                sc.id = Date.now() + Math.random();
                existing.push(sc);
                added++;
            }
        });

        if (added > 0) {
            localStorage.setItem(_scopedKey('competitors'), JSON.stringify(existing));
            loadCompetitors();
        }

        if (status) {
            status.textContent = added > 0
                ? `Synced ${added} new registration${added > 1 ? 's' : ''} from server.`
                : 'All server registrations already synced.';
            status.classList.remove('hidden');
            setTimeout(() => status.classList.add('hidden'), 4000);
        }
    } catch (err) {
        if (status && err.message !== 'Not authenticated') {
            status.textContent = 'Sync failed: ' + err.message;
            status.style.borderColor = 'rgba(239,68,68,0.3)';
            status.style.background = 'rgba(239,68,68,0.1)';
            status.style.color = 'var(--red)';
            status.classList.remove('hidden');
            setTimeout(() => {
                status.classList.add('hidden');
                status.style.borderColor = '';
                status.style.background = '';
                status.style.color = '';
            }, 4000);
        }
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '🔄 Refresh from Server'; }
    }
}

// Auto-poll every 30 seconds when competitor view is active
function startSyncPolling() {
    stopSyncPolling();
    syncInterval = setInterval(() => {
        const competitorView = document.getElementById('competitors-view');
        if (competitorView && !competitorView.classList.contains('hidden') && Auth.isLoggedIn()) {
            syncRegistrationsFromServer();
        }
    }, 30000);
}

function stopSyncPolling() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH GATE — Login/Signup UI handlers
// ═══════════════════════════════════════════════════════════════════════════

function authSwitchTab(tab) {
    // Hide all forms
    document.getElementById('auth-login-form').classList.add('hidden');
    document.getElementById('auth-signup-form').classList.add('hidden');
    document.getElementById('auth-forgot-form').classList.add('hidden');
    // Deactivate all tabs
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    // Show selected
    if (tab === 'login') {
        document.getElementById('auth-login-form').classList.remove('hidden');
        document.querySelector('.auth-tab[data-tab="login"]').classList.add('active');
    } else if (tab === 'signup') {
        document.getElementById('auth-signup-form').classList.remove('hidden');
        document.querySelector('.auth-tab[data-tab="signup"]').classList.add('active');
    } else if (tab === 'forgot') {
        document.getElementById('auth-forgot-form').classList.remove('hidden');
        // Keep login tab visually active for forgot (sub-view of login)
    }
    // Clear errors
    document.querySelectorAll('.auth-error, .auth-success').forEach(el => {
        el.classList.add('hidden');
        el.textContent = '';
    });
}

function showAuthError(formId, message) {
    const el = document.getElementById(`auth-${formId}-error`);
    if (el) { el.textContent = message; el.classList.remove('hidden'); }
}

function showAuthSuccess(formId, message) {
    const el = document.getElementById(`auth-${formId}-success`);
    if (el) { el.textContent = message; el.classList.remove('hidden'); }
}

async function handleAdminLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('auth-login-btn');
    btn.disabled = true;
    btn.textContent = 'Signing in...';
    try {
        const email = document.getElementById('auth-login-email').value;
        const password = document.getElementById('auth-login-password').value;
        await Auth.login(email, password);
    } catch (err) {
        showAuthError('login', err.error || 'Login failed. Please try again.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Sign In';
    }
}

async function handleAdminSignup(e) {
    e.preventDefault();
    const btn = document.getElementById('auth-signup-btn');
    const password = document.getElementById('auth-signup-password').value;
    const confirm = document.getElementById('auth-signup-confirm').value;
    if (password !== confirm) {
        showAuthError('signup', 'Passwords do not match.');
        return;
    }
    btn.disabled = true;
    btn.textContent = 'Creating account...';
    try {
        const roles = [];
        document.querySelectorAll('.role-pills input[type="checkbox"]:checked').forEach(cb => roles.push(cb.value));
        await Auth.signup({
            email: document.getElementById('auth-signup-email').value,
            password,
            firstName: document.getElementById('auth-signup-first').value,
            lastName: document.getElementById('auth-signup-last').value,
            roles,
        });
        // Show success, switch to login
        document.getElementById('auth-signup-form').reset();
        showAuthSuccess('signup', 'Account created! Check your email to verify, then log in.');
    } catch (err) {
        const msg = err.errors ? err.errors.map(e => e.msg).join('. ') : (err.error || 'Signup failed.');
        showAuthError('signup', msg);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Create Account';
    }
}

async function handleForgotPassword(e) {
    e.preventDefault();
    const btn = document.getElementById('auth-forgot-btn');
    btn.disabled = true;
    btn.textContent = 'Sending...';
    try {
        await Auth.forgotPassword(document.getElementById('auth-forgot-email').value);
        showAuthSuccess('forgot', 'If an account with that email exists, a reset link has been sent.');
    } catch (err) {
        showAuthError('forgot', err.error || 'Something went wrong. Please try again.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Send Reset Link';
    }
}

function updatePasswordStrength(password) {
    const bar = document.getElementById('password-strength-bar');
    const text = document.getElementById('password-strength-text');
    if (!bar) return;
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (password.length >= 12) score++;
    const pct = (score / 5) * 100;
    bar.style.width = pct + '%';
    if (score <= 1) { bar.style.background = '#ef4444'; text.textContent = 'Weak'; }
    else if (score <= 3) { bar.style.background = '#eab308'; text.textContent = 'Fair'; }
    else { bar.style.background = '#22c55e'; text.textContent = 'Strong'; }
}

// Role pill toggle behavior
document.addEventListener('click', (e) => {
    const pill = e.target.closest('.role-pill');
    if (!pill) return;
    const cb = pill.querySelector('input[type="checkbox"]');
    if (e.target !== cb) {
        cb.checked = !cb.checked;
    }
    pill.classList.toggle('selected', cb.checked);
});

function handleLogout() {
    Auth.logout();
}

function updateUserMenu(user) {
    const menu = document.getElementById('user-menu');
    if (!user) {
        menu.classList.add('hidden');
        return;
    }
    menu.classList.remove('hidden');
    const initial = (user.firstName || '?')[0].toUpperCase();
    document.getElementById('user-avatar').textContent = initial;
    document.getElementById('user-name').textContent = `${user.firstName} ${user.lastName}`;
    const rolesEl = document.getElementById('user-roles');
    rolesEl.innerHTML = (user.roles || []).map(r =>
        `<span class="user-role-badge">${r.replace('_', ' ')}</span>`
    ).join('');
    // Re-render lucide icons for the logout button
    if (window.lucide) lucide.createIcons();
}

// Initialize app
window.addEventListener('load', () => {
    updateClubSelects();
    loadCompetitors();
    loadClubs();
    loadTemplateSelector();
    loadPublicSiteConfig();
    loadScoreboardSettings();

    // Role-based nav visibility for judges/staff (restricted view of manage.html)
    function applyRoleBasedNavVisibility(user) {
        const isAdmin = user.roles.includes('admin') || user.roles.includes('super_admin');
        if (isAdmin) return; // Admins see everything

        const isJudge = user.roles.includes('judge');
        const isStaff = user.roles.includes('staff');
        const isCoach = user.roles.includes('coach');
        const isTournamentMember = isJudge || isStaff || isCoach;

        // If user has no tournament-level role, they're the tournament owner — show everything
        if (!isTournamentMember) return;

        // Tournament-level nav items to hide for non-owners
        let viewsToHide = [];

        if (isJudge) {
            // Judges see: Dashboard, Scoreboards, Brackets, Schedule, Results
            viewsToHide = ['competitors', 'clubs', 'instructors'];
        } else if (isStaff) {
            // Staff sees: Dashboard, Schedule, Results
            viewsToHide = ['competitors', 'clubs', 'instructors', 'scoreboards', 'brackets'];
        }

        viewsToHide.forEach(view => {
            const btn = document.querySelector(`.nav-btn[data-view="${view}"]`);
            if (btn) btn.style.display = 'none';
        });

        // Hide entire Settings nav group for non-owners (coaches/judges/staff)
        const settingsGroup = document.getElementById('settings-nav-group');
        if (settingsGroup) settingsGroup.style.display = 'none';

        // Hide nav group labels for empty groups
        document.querySelectorAll('.nav-group').forEach(group => {
            const visibleBtns = [...group.querySelectorAll('.nav-btn')].filter(b => b.style.display !== 'none');
            if (visibleBtns.length === 0) {
                group.style.display = 'none';
            }
        });
    }

    // Auth initialization
    Auth.onAuthChange = (user) => {
        const gate = document.getElementById('auth-gate');
        const academyNavGroup = document.getElementById('academy-nav-group');
        if (user) {
            gate.classList.add('hidden');
            updateUserMenu(user);
            startSyncPolling();
            applyRoleBasedNavVisibility(user);

            // Academy nav is hidden — dojo management moved to account.html
            if (academyNavGroup) academyNavGroup.style.display = 'none';
        } else {
            gate.classList.remove('hidden');
            updateUserMenu(null);
            stopSyncPolling();
            if (academyNavGroup) academyNavGroup.style.display = 'none';
        }
    };
    Auth.init();
});

// ═══════════════════════════════════════════════════════════════════════════
// MEDICAL INCIDENTS
// ═══════════════════════════════════════════════════════════════════════════

// HTML-escape helper for safe template rendering
function escHtml(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

async function loadMedicalIncidents() {
    if (!currentTournamentId) return;
    const tbody = document.getElementById('medical-incidents-tbody');
    const countSpan = document.getElementById('medical-incident-count');
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:30px;">Loading...</td></tr>';

    try {
        const res = await fetch(`/api/tournaments/${currentTournamentId}/medical-incidents`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load medical incidents');
        const data = await res.json();
        const incidents = data.incidents || [];

        countSpan.textContent = `${incidents.length} incident${incidents.length !== 1 ? 's' : ''} logged`;

        if (incidents.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:30px;">No incidents logged yet.</td></tr>';
            return;
        }

        tbody.innerHTML = incidents.map(i => {
            const time = i.created_at
                ? new Date(i.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                : '';
            const loggedBy = [i.logged_by_first_name, i.logged_by_last_name].filter(Boolean).join(' ') || '—';
            const continueFlag = i.able_to_continue
                ? '<span style="color:var(--success, #22c55e);">Yes</span>'
                : '<span style="color:var(--red, #ef4444);">No</span>';
            const emsFlag = i.medical_staff_called
                ? '<span style="color:var(--red, #ef4444);">Yes</span>'
                : '<span style="color:var(--text-muted);">No</span>';

            return `<tr>
                <td style="white-space:nowrap;">${escHtml(time)}</td>
                <td>${escHtml(i.competitor_name || '')}</td>
                <td>${escHtml(i.mat_number || '—')}</td>
                <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(i.description || '')}">${escHtml(i.description || '')}</td>
                <td>${escHtml(i.official_present || '—')}</td>
                <td>${continueFlag}</td>
                <td>${emsFlag}</td>
                <td>${escHtml(loggedBy)}</td>
            </tr>`;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--red);padding:30px;">${escHtml(err.message)}</td></tr>`;
    }

    // Populate the competitor selector for the log form
    loadIncidentCompetitorSelector();
}

async function loadIncidentCompetitorSelector() {
    const select = document.getElementById('incident-competitor');
    if (!select || !currentTournamentId) return;

    // Keep the first "manual" option
    select.innerHTML = '<option value="">-- Select or type manually --</option>';

    try {
        const res = await fetch(`/api/tournaments/${currentTournamentId}/registrations`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const registrants = data.registrants || [];

        registrants.forEach(r => {
            const name = `${r.first_name || ''} ${r.last_name || ''}`.trim();
            if (!name) return;
            const opt = document.createElement('option');
            opt.value = r.registration_id || '';
            opt.textContent = name + (r.academy_name ? ` (${r.academy_name})` : '');
            opt.dataset.name = name;
            select.appendChild(opt);
        });
    } catch (err) {
        // Silently fail — user can still type manually
    }
}

function onIncidentCompetitorChange() {
    const select = document.getElementById('incident-competitor');
    const nameInput = document.getElementById('incident-competitor-name');
    const selectedOption = select.options[select.selectedIndex];
    if (selectedOption && selectedOption.dataset.name) {
        nameInput.value = selectedOption.dataset.name;
    }
}

function showLogIncidentForm() {
    document.getElementById('log-incident-form-panel').style.display = 'block';
    document.getElementById('log-incident-form').reset();
    document.getElementById('incident-competitor-name').value = '';
}

function hideLogIncidentForm() {
    document.getElementById('log-incident-form-panel').style.display = 'none';
}

async function submitMedicalIncident(e) {
    e.preventDefault();
    if (!currentTournamentId) return;

    const btn = document.getElementById('incident-submit-btn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const competitorName = document.getElementById('incident-competitor-name').value.trim();
        const matNumber = document.getElementById('incident-mat').value.trim();
        const description = document.getElementById('incident-description').value.trim();
        const officialPresent = document.getElementById('incident-official').value.trim();
        const ableToContinue = document.getElementById('incident-able-to-continue').checked;
        const medicalStaffCalled = document.getElementById('incident-medical-staff').checked;

        if (!competitorName) {
            showToast('Competitor name is required', 'error');
            return;
        }
        if (!description) {
            showToast('Description is required', 'error');
            return;
        }

        const res = await fetch(`/api/tournaments/${currentTournamentId}/medical-incidents`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                competitorName,
                matNumber,
                description,
                officialPresent,
                ableToContinue,
                medicalStaffCalled,
            }),
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to log incident');
        }

        showToast('Medical incident logged', 'success');
        hideLogIncidentForm();
        loadMedicalIncidents();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Incident';
    }
}

function exportMedicalIncidentsCSV() {
    if (!currentTournamentId) return;
    window.open(`/api/tournaments/${currentTournamentId}/medical-incidents/export.csv`, '_blank');
}

// ═══════════════════════════════════════════════════════════════════════════
// JUDGE PERFORMANCE ANALYTICS VIEW
// ═══════════════════════════════════════════════════════════════════════════

async function loadJudgeAnalyticsView() {
    if (!currentTournamentId) return;

    const loading = document.getElementById('judge-analytics-loading');
    const empty = document.getElementById('judge-analytics-empty');
    const content = document.getElementById('judge-analytics-content');

    if (loading) loading.style.display = 'block';
    if (empty) empty.style.display = 'none';
    if (content) content.style.display = 'none';

    try {
        const res = await fetch(`/api/tournaments/${currentTournamentId}/judge-analytics`, { credentials: 'include' });
        if (!res.ok) {
            // If 403 or 404, show empty state gracefully
            if (res.status === 403 || res.status === 404) {
                if (loading) loading.style.display = 'none';
                if (empty) empty.style.display = 'block';
                return;
            }
            throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        if (loading) loading.style.display = 'none';

        if (!data.judges || data.judges.length === 0) {
            if (empty) empty.style.display = 'block';
            return;
        }

        if (content) content.style.display = 'block';

        // Populate summary cards
        document.getElementById('ja-total-matches').textContent = data.summary.totalMatches || 0;
        document.getElementById('ja-total-votes').textContent = data.summary.totalVotes || 0;

        const overallEl = document.getElementById('ja-overall-consistency');
        const overallVal = data.summary.overallConsistency || 0;
        overallEl.textContent = overallVal + '%';
        overallEl.style.color = _jaConsistencyColor(overallVal);

        // Populate per-judge table
        const tbody = document.getElementById('ja-judges-tbody');
        tbody.innerHTML = data.judges.map(j => {
            const consistency = parseFloat(j.consistency_rate) || 0;
            const consistencyColor = _jaConsistencyColor(consistency);
            const avgTime = j.avg_vote_duration != null ? parseFloat(j.avg_vote_duration).toFixed(1) + 's' : '--';

            let biasHtml = '--';
            if (j.biasFlags && j.biasFlags.length > 0) {
                biasHtml = j.biasFlags.map(b =>
                    `<span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;background:rgba(239,68,68,0.15);color:#ef4444;margin:2px;" title="Voted for ${escHtml(b.dojo)} ${b.rate}% of the time (${b.votesForDojo}/${b.matchesWithDojo} matches)">${escHtml(b.dojo)} (${b.rate}%)</span>`
                ).join(' ');
            }

            return `<tr>
                <td style="font-weight:600;">${escHtml(j.judge_name)}</td>
                <td>${j.total_votes}</td>
                <td>
                    <span style="font-weight:700;color:${consistencyColor};">${consistency}%</span>
                    <span style="font-size:11px;color:var(--text-muted);margin-left:4px;">(${j.votes_with_majority}/${j.total_votes})</span>
                </td>
                <td>${avgTime}</td>
                <td>${biasHtml}</td>
            </tr>`;
        }).join('');
    } catch (err) {
        if (loading) loading.style.display = 'none';
        if (empty) {
            empty.style.display = 'block';
            empty.querySelector('p').textContent = 'Failed to load analytics: ' + err.message;
        }
        console.error('[Judge Analytics] Load failed:', err);
    }
}

function _jaConsistencyColor(pct) {
    if (pct >= 80) return '#22c55e'; // green
    if (pct >= 60) return '#eab308'; // yellow
    return '#ef4444'; // red
}

// ═══════════════════════════════════════════════════════════════════════════
// SPONSORS & VENDORS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

let sponsorsCache = [];

async function loadSponsorsView() {
    if (!currentTournamentId) return;
    const container = document.getElementById('sponsors-list');
    container.innerHTML = '<p style="color: var(--text-muted); font-size: 14px;">Loading sponsors...</p>';

    try {
        const res = await fetch(`/api/tournaments/${currentTournamentId}/sponsors`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load sponsors');
        const data = await res.json();
        sponsorsCache = data.sponsors || [];
        renderSponsorsList(sponsorsCache);
    } catch (err) {
        container.innerHTML = '<p style="color: var(--text-muted); font-size: 14px;">Failed to load sponsors.</p>';
        console.error('Error loading sponsors:', err);
    }
}

function renderSponsorsList(sponsors) {
    const container = document.getElementById('sponsors-list');

    if (sponsors.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-size: 14px;">No sponsors added yet. Click "Add Sponsor" to get started.</p>';
        return;
    }

    const categoryLabels = {
        sponsor: 'Sponsor',
        hotel: 'Hotel',
        restaurant: 'Restaurant',
        dojo: 'Dojo',
        other: 'Other',
    };

    let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';
    sponsors.forEach((s, idx) => {
        const catLabel = categoryLabels[s.category] || s.category || 'Sponsor';
        const visIcon = s.visible ? 'eye' : 'eye-off';
        const visTitle = s.visible ? 'Visible (click to hide)' : 'Hidden (click to show)';
        const visStyle = s.visible ? '' : 'opacity: 0.5;';

        html += `
        <div class="glass-card" style="padding: 16px; display: flex; align-items: center; gap: 16px; ${visStyle}" data-sponsor-id="${s.id}">
            <div style="display: flex; flex-direction: column; gap: 4px; min-width: 32px; align-items: center;">
                ${idx > 0 ? `<button class="btn-icon" onclick="moveSponsor('${s.id}', 'up')" title="Move up" style="padding:4px;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;">&#9650;</button>` : '<div style="height:24px;"></div>'}
                ${idx < sponsors.length - 1 ? `<button class="btn-icon" onclick="moveSponsor('${s.id}', 'down')" title="Move down" style="padding:4px;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;">&#9660;</button>` : '<div style="height:24px;"></div>'}
            </div>
            <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <strong style="font-size: 15px;">${escHtml(s.name)}</strong>
                    <span style="padding: 2px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; background: rgba(255,255,255,0.06); color: var(--text-muted);">${escHtml(catLabel)}</span>
                    ${s.discount_code ? `<span style="padding: 2px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; background: rgba(39,174,96,0.15); color: #27ae60;">CODE: ${escHtml(s.discount_code)}</span>` : ''}
                </div>
                ${s.description ? `<p style="margin: 4px 0 0; font-size: 13px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escHtml(s.description)}</p>` : ''}
                ${s.website_url ? `<p style="margin: 2px 0 0; font-size: 12px;"><a href="${escHtml(s.website_url)}" target="_blank" rel="noopener" style="color: var(--accent-blue, #0071e3);">${escHtml(s.website_url)}</a></p>` : ''}
            </div>
            <div style="display: flex; gap: 6px; flex-shrink: 0;">
                <button class="btn btn-secondary btn-sm" onclick="toggleSponsorVisibility('${s.id}')" title="${visTitle}" style="padding: 6px 10px;"><i data-lucide="${visIcon}" style="width:16px;height:16px;"></i></button>
                <button class="btn btn-secondary btn-sm" onclick="editSponsor('${s.id}')" title="Edit" style="padding: 6px 10px;"><i data-lucide="pencil" style="width:16px;height:16px;"></i></button>
                <button class="btn btn-secondary btn-sm" onclick="deleteSponsor('${s.id}')" title="Delete" style="padding: 6px 10px; color: var(--danger, #e74c3c);"><i data-lucide="trash-2" style="width:16px;height:16px;"></i></button>
            </div>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;

    // Re-initialize lucide icons for the new buttons
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function openSponsorForm(sponsorId) {
    const panel = document.getElementById('sponsor-form-panel');
    const title = document.getElementById('sponsor-form-title');
    const editId = document.getElementById('sponsor-edit-id');

    // Reset form
    document.getElementById('sponsor-name').value = '';
    document.getElementById('sponsor-category').value = 'sponsor';
    document.getElementById('sponsor-website').value = '';
    document.getElementById('sponsor-discount').value = '';
    document.getElementById('sponsor-description').value = '';
    editId.value = '';

    if (sponsorId) {
        const s = sponsorsCache.find(sp => sp.id === sponsorId);
        if (s) {
            title.textContent = 'Edit Sponsor';
            editId.value = s.id;
            document.getElementById('sponsor-name').value = s.name || '';
            document.getElementById('sponsor-category').value = s.category || 'sponsor';
            document.getElementById('sponsor-website').value = s.website_url || '';
            document.getElementById('sponsor-discount').value = s.discount_code || '';
            document.getElementById('sponsor-description').value = s.description || '';
        }
    } else {
        title.textContent = 'Add Sponsor';
    }

    panel.style.display = '';
    document.getElementById('sponsor-name').focus();
}

function closeSponsorForm() {
    document.getElementById('sponsor-form-panel').style.display = 'none';
}

async function saveSponsor() {
    if (!currentTournamentId) return;

    const editId = document.getElementById('sponsor-edit-id').value;
    const name = document.getElementById('sponsor-name').value.trim();
    const category = document.getElementById('sponsor-category').value;
    const website_url = document.getElementById('sponsor-website').value.trim() || null;
    const discount_code = document.getElementById('sponsor-discount').value.trim() || null;
    const description = document.getElementById('sponsor-description').value.trim() || null;

    if (!name) {
        showToast('Sponsor name is required', 'error');
        return;
    }

    const body = { name, category, website_url, discount_code, description };

    try {
        let res;
        if (editId) {
            res = await fetch(`/api/tournaments/${currentTournamentId}/sponsors/${editId}`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
        } else {
            res = await fetch(`/api/tournaments/${currentTournamentId}/sponsors`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
        }

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to save sponsor');
        }

        showToast(editId ? 'Sponsor updated' : 'Sponsor added', 'success');
        closeSponsorForm();
        loadSponsorsView();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function editSponsor(sponsorId) {
    openSponsorForm(sponsorId);
}

async function deleteSponsor(sponsorId) {
    if (!currentTournamentId) return;
    if (!confirm('Delete this sponsor?')) return;

    try {
        const res = await fetch(`/api/tournaments/${currentTournamentId}/sponsors/${sponsorId}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to delete sponsor');
        }
        showToast('Sponsor deleted', 'success');
        loadSponsorsView();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function toggleSponsorVisibility(sponsorId) {
    if (!currentTournamentId) return;

    try {
        const res = await fetch(`/api/tournaments/${currentTournamentId}/sponsors/${sponsorId}/toggle`, {
            method: 'PATCH',
            credentials: 'include',
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to toggle visibility');
        }
        const data = await res.json();
        showToast(data.sponsor.visible ? 'Sponsor is now visible' : 'Sponsor is now hidden', 'success');
        loadSponsorsView();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function moveSponsor(sponsorId, direction) {
    if (!currentTournamentId) return;

    const idx = sponsorsCache.findIndex(s => s.id === sponsorId);
    if (idx === -1) return;

    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= sponsorsCache.length) return;

    // Swap in local array
    const ids = sponsorsCache.map(s => s.id);
    [ids[idx], ids[newIdx]] = [ids[newIdx], ids[idx]];

    try {
        const res = await fetch(`/api/tournaments/${currentTournamentId}/sponsors/reorder`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderedIds: ids }),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to reorder');
        }
        const data = await res.json();
        sponsorsCache = data.sponsors || [];
        renderSponsorsList(sponsorsCache);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Simple global function to open TV display - always accessible
window.openTVDisplay = function() {
    const tidParam = currentTournamentId ? `?tid=${currentTournamentId}` : '';
    if (activeScoreboardType === 'kata-points') {
        window.open(`/kata-scoreboard.html${tidParam}`, 'TVDisplay', 'width=1920,height=1080,fullscreen=yes');
    } else if (activeScoreboardType === 'kumite') {
        window.open(`/kumite-scoreboard.html${tidParam}`, 'TVDisplay', 'width=1920,height=1080,fullscreen=yes');
        updateOperatorTVDisplay();
    } else if (activeScoreboardType === 'kata-flags') {
        window.open(`/kata-flags-scoreboard.html${tidParam}`, 'TVDisplay', 'width=1920,height=1080,fullscreen=yes');
        updateKataFlagsTVDisplay();
    } else {
        // Default fallback: kumite scoreboard (auto-redirects if type changes)
        window.open(`/kumite-scoreboard.html${tidParam}`, 'TVDisplay', 'width=1920,height=1080,fullscreen=yes');
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// ══ POST-TOURNAMENT FEEDBACK ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════

let feedbackFormData = null;
let feedbackQuestions = [];

const DEFAULT_FEEDBACK_QUESTIONS = [
    { id: 'q1', text: 'How would you rate the overall event organization?', type: 'rating', required: true },
    { id: 'q2', text: 'How would you rate the judging quality?', type: 'rating', required: true },
    { id: 'q3', text: 'How would you rate the venue and facilities?', type: 'rating', required: true },
    { id: 'q4', text: 'How likely are you to participate in future events?', type: 'rating', required: true },
    { id: 'q5', text: 'Any additional comments or suggestions?', type: 'text', required: false },
];

async function loadFeedbackView() {
    const tid = typeof currentTournamentId !== 'undefined' ? currentTournamentId : null;
    if (!tid) return;

    try {
        const res = await fetch(`/api/tournaments/${tid}/feedback-form`, { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            feedbackFormData = data.form;
        } else {
            feedbackFormData = null;
        }
    } catch (err) {
        console.error('Failed to load feedback form:', err);
        feedbackFormData = null;
    }

    if (feedbackFormData) {
        feedbackQuestions = feedbackFormData.questions || [];
        document.getElementById('feedback-enabled').checked = feedbackFormData.enabled || false;
        document.getElementById('feedback-delay-hours').value = feedbackFormData.delay_hours ?? 24;
        document.getElementById('feedback-recipients').value = feedbackFormData.recipients || 'competitors';

        // Show feedback link
        const linkBox = document.getElementById('feedback-form-link-box');
        const linkInput = document.getElementById('feedback-form-link');
        if (linkBox && linkInput) {
            const baseUrl = window.location.origin;
            linkInput.value = `${baseUrl}/feedback?form=${feedbackFormData.id}`;
            linkBox.style.display = 'block';
        }
    } else {
        // Pre-populate with defaults
        feedbackQuestions = JSON.parse(JSON.stringify(DEFAULT_FEEDBACK_QUESTIONS));
        document.getElementById('feedback-enabled').checked = false;
        document.getElementById('feedback-delay-hours').value = 24;
        document.getElementById('feedback-recipients').value = 'competitors';
        const linkBox = document.getElementById('feedback-form-link-box');
        if (linkBox) linkBox.style.display = 'none';
    }

    renderFeedbackQuestions();
    loadFeedbackStats();
}

function renderFeedbackQuestions() {
    const container = document.getElementById('feedback-questions-list');

    if (!feedbackQuestions.length) {
        container.innerHTML = '<p style="color: var(--text-muted); font-size: 14px;">No questions added. Click "Add Question" to get started.</p>';
        return;
    }

    let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';
    feedbackQuestions.forEach((q, idx) => {
        const typeLabel = q.type === 'rating' ? 'Star Rating (1-5)' : 'Text Response';
        const reqLabel = q.required ? '<span style="color: var(--accent); font-size: 11px; font-weight: 600;">REQUIRED</span>' : '';
        html += `
        <div class="glass-card" style="padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
                <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px;">
                        <strong style="font-size: 14px;">Q${idx + 1}.</strong>
                        <span style="padding: 2px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; background: rgba(255,255,255,0.06); color: var(--text-muted);">${escHtml(typeLabel)}</span>
                        ${reqLabel}
                    </div>
                    <div style="font-size: 14px; color: var(--text-primary);">${escHtml(q.text)}</div>
                </div>
                <div style="display: flex; gap: 4px; flex-shrink: 0;">
                    <button class="btn btn-secondary btn-sm" onclick="editFeedbackQuestion(${idx})" title="Edit" style="padding: 6px 10px;"><i data-lucide="pencil" style="width:14px;height:14px;"></i></button>
                    ${idx > 0 ? `<button class="btn btn-secondary btn-sm" onclick="moveFeedbackQuestion(${idx}, -1)" title="Move up" style="padding: 6px 10px;">&#9650;</button>` : ''}
                    ${idx < feedbackQuestions.length - 1 ? `<button class="btn btn-secondary btn-sm" onclick="moveFeedbackQuestion(${idx}, 1)" title="Move down" style="padding: 6px 10px;">&#9660;</button>` : ''}
                    <button class="btn btn-secondary btn-sm" onclick="removeFeedbackQuestion(${idx})" title="Remove" style="padding: 6px 10px; color: var(--danger, #e74c3c);">&#10005;</button>
                </div>
            </div>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function addFeedbackQuestion() {
    const id = 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const text = prompt('Enter the question text:');
    if (!text || !text.trim()) return;

    const typeInput = prompt('Question type: "rating" (star rating 1-5) or "text" (free text)?', 'rating');
    const type = (typeInput || '').trim().toLowerCase() === 'text' ? 'text' : 'rating';

    const reqInput = prompt('Is this question required? (yes/no)', 'yes');
    const required = (reqInput || '').trim().toLowerCase() !== 'no';

    feedbackQuestions.push({ id, text: text.trim(), type, required });
    renderFeedbackQuestions();
}

function editFeedbackQuestion(idx) {
    const q = feedbackQuestions[idx];
    if (!q) return;

    const text = prompt('Edit question text:', q.text);
    if (text === null) return;
    if (!text.trim()) {
        alert('Question text cannot be empty.');
        return;
    }

    const typeInput = prompt('Question type: "rating" or "text"?', q.type);
    const type = (typeInput || '').trim().toLowerCase() === 'text' ? 'text' : 'rating';

    const reqInput = prompt('Is this question required? (yes/no)', q.required ? 'yes' : 'no');
    const required = (reqInput || '').trim().toLowerCase() !== 'no';

    feedbackQuestions[idx] = { ...q, text: text.trim(), type, required };
    renderFeedbackQuestions();
}

function removeFeedbackQuestion(idx) {
    if (!confirm('Remove this question?')) return;
    feedbackQuestions.splice(idx, 1);
    renderFeedbackQuestions();
}

function moveFeedbackQuestion(idx, direction) {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= feedbackQuestions.length) return;
    const temp = feedbackQuestions[idx];
    feedbackQuestions[idx] = feedbackQuestions[newIdx];
    feedbackQuestions[newIdx] = temp;
    renderFeedbackQuestions();
}

async function saveFeedbackForm() {
    const tid = typeof currentTournamentId !== 'undefined' ? currentTournamentId : null;
    if (!tid) return;

    const statusEl = document.getElementById('feedback-save-status');
    statusEl.textContent = 'Saving...';
    statusEl.style.color = 'var(--text-muted)';

    const payload = {
        questions: feedbackQuestions,
        recipients: document.getElementById('feedback-recipients').value,
        delay_hours: parseInt(document.getElementById('feedback-delay-hours').value) || 24,
        enabled: document.getElementById('feedback-enabled').checked,
    };

    try {
        const res = await fetch(`/api/tournaments/${tid}/feedback-form`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to save');
        }
        const data = await res.json();
        feedbackFormData = data.form;

        // Update the feedback link
        const linkBox = document.getElementById('feedback-form-link-box');
        const linkInput = document.getElementById('feedback-form-link');
        if (linkBox && linkInput && feedbackFormData) {
            const baseUrl = window.location.origin;
            linkInput.value = `${baseUrl}/feedback?form=${feedbackFormData.id}`;
            linkBox.style.display = 'block';
        }

        statusEl.textContent = 'Saved successfully.';
        statusEl.style.color = 'var(--green, #22c55e)';
        setTimeout(() => { statusEl.textContent = ''; }, 3000);

        loadFeedbackStats();
    } catch (err) {
        statusEl.textContent = 'Error: ' + err.message;
        statusEl.style.color = '#e74c3c';
    }
}

function copyFeedbackLink() {
    const input = document.getElementById('feedback-form-link');
    if (!input) return;
    navigator.clipboard.writeText(input.value).then(() => {
        if (typeof showToast === 'function') showToast('Link copied!');
    }).catch(() => {
        input.select();
        document.execCommand('copy');
    });
}

async function loadFeedbackStats() {
    const tid = typeof currentTournamentId !== 'undefined' ? currentTournamentId : null;
    if (!tid) return;

    const container = document.getElementById('feedback-stats-container');

    if (!feedbackFormData) {
        container.innerHTML = '<p style="color: var(--text-muted); font-size: 14px;">Save and enable the form to view responses.</p>';
        return;
    }

    try {
        const res = await fetch(`/api/tournaments/${tid}/feedback-form/stats`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load stats');
        const data = await res.json();
        const stats = data.stats;

        if (!stats || stats.totalResponses === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); font-size: 14px;">No responses yet.</p>';
            return;
        }

        let html = `<div style="margin-bottom: 16px; font-size: 15px; font-weight: 600;">${stats.totalResponses} Response${stats.totalResponses !== 1 ? 's' : ''}</div>`;
        html += '<div style="display: flex; flex-direction: column; gap: 16px;">';

        for (const qs of stats.questionStats) {
            html += '<div style="padding: 12px 16px; background: var(--glass); border-radius: 10px;">';
            html += `<div style="font-size: 14px; font-weight: 600; margin-bottom: 6px;">${escHtml(qs.text)}</div>`;

            if (qs.type === 'rating' && qs.averageRating != null) {
                const pct = (qs.averageRating / 5) * 100;
                const fullStars = Math.floor(qs.averageRating);
                const starsHtml = renderStarsHtml(qs.averageRating);
                html += `<div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">`;
                html += `<div style="font-size: 24px; font-weight: 700; color: #f59e0b;">${qs.averageRating.toFixed(1)}</div>`;
                html += `<div style="font-size: 18px; letter-spacing: 2px;">${starsHtml}</div>`;
                html += `<div style="font-size: 12px; color: var(--text-muted);">${qs.totalAnswers} rating${qs.totalAnswers !== 1 ? 's' : ''}</div>`;
                html += `</div>`;
                // Rating bar
                html += `<div style="margin-top: 8px; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden;">`;
                html += `<div style="height: 100%; width: ${pct}%; background: #f59e0b; border-radius: 3px;"></div>`;
                html += `</div>`;
            } else if (qs.type === 'text' && qs.textResponses && qs.textResponses.length > 0) {
                html += `<div style="font-size: 12px; color: var(--text-muted); margin-bottom: 6px;">${qs.totalAnswers} text response${qs.totalAnswers !== 1 ? 's' : ''}</div>`;
                const maxShow = 5;
                const shown = qs.textResponses.slice(0, maxShow);
                for (const t of shown) {
                    html += `<div style="padding: 8px 12px; margin-bottom: 4px; background: var(--bg-secondary); border-radius: 8px; font-size: 13px; color: var(--text-muted); line-height: 1.5;">${escHtml(t)}</div>`;
                }
                if (qs.textResponses.length > maxShow) {
                    html += `<div style="font-size: 12px; color: var(--text-dim);">... and ${qs.textResponses.length - maxShow} more</div>`;
                }
            } else {
                html += `<div style="font-size: 13px; color: var(--text-dim);">No responses for this question.</div>`;
            }

            html += '</div>';
        }

        html += '</div>';
        container.innerHTML = html;
    } catch (err) {
        console.error('Failed to load feedback stats:', err);
        container.innerHTML = '<p style="color: var(--text-muted); font-size: 14px;">Failed to load stats.</p>';
    }
}

function renderStarsHtml(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= Math.floor(rating)) {
            html += '<span style="color: #f59e0b;">&#9733;</span>';
        } else if (i - rating < 1 && i - rating > 0) {
            html += '<span style="color: #f59e0b;">&#9733;</span>';
        } else {
            html += '<span style="color: rgba(255,255,255,0.15);">&#9733;</span>';
        }
    }
    return html;
}

function exportFeedbackCSV() {
    const tid = typeof currentTournamentId !== 'undefined' ? currentTournamentId : null;
    if (!tid) return;
    window.open(`/api/tournaments/${tid}/feedback-form/export.csv`, '_blank');
}
