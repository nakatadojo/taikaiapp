const pool = require('../db/pool');
const BracketQueries = require('../db/queries/brackets');
const DirectorCompetitorQueries = require('../db/queries/directorCompetitors');
const { broadcastBracketUpdate } = require('../websocket');
const { sendBracketPublishedEmails } = require('../email');

async function getBrackets(req, res, next) {
  try {
    const rows = await BracketQueries.getAll(req.params.id);
    const byId = {};
    // Embed __v (server version) in the bracket data so clients can track it
    // without requiring a schema change to the bracket object format.
    for (const b of rows) {
      byId[b.id] = { ...b.data, __v: b.version };
    }
    res.json({ brackets: byId });
  } catch (err) { next(err); }
}

/**
 * GET /api/tournaments/:id/brackets/started
 *
 * Public-friendly endpoint that returns whether any brackets for this tournament
 * have recorded results (i.e., competition has started for at least one division).
 * Used by the registration form to warn late registrants.
 */
async function getBracketsStartedStatus(req, res, next) {
  try {
    // Validate UUID to prevent a PostgreSQL cast error (500) on bad input
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    const rows = await BracketQueries.getAll(req.params.id);
    const startedEventIds = new Set();
    for (const row of rows) {
      if (_bracketHasResults(row.data)) {
        startedEventIds.add(row.event_id);
      }
    }
    res.json({ hasStarted: startedEventIds.size > 0, startedEventIds: [...startedEventIds] });
  } catch (err) { next(err); }
}

async function getSingleBracket(req, res, next) {
  try {
    const { id: tournamentId, bracketId } = req.params;
    const row = await BracketQueries.getOne(tournamentId, bracketId);
    if (!row) return res.status(404).json({ error: 'Bracket not found' });
    // Embed version in the returned data so polling clients stay version-aware
    res.json({ bracket: { ...row.data, __v: row.version } });
  } catch (err) { next(err); }
}

/**
 * Extract all UUID-like strings from a serialised bracket object.
 * Used to identify which director competitors appear in a bracket so we can
 * set bracket_placed = true on them (preventing credit refunds).
 */
function _extractUUIDs(obj) {
  const str = JSON.stringify(obj);
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  return [...new Set(str.match(uuidRegex) || [])];
}

/**
 * Return true if a bracket contains any entered results.
 * Checks for winner fields (non-null) or completed/scored matches.
 */
function _bracketHasResults(bracketData) {
  if (!bracketData) return false;
  const str = JSON.stringify(bracketData);
  if (/"winner"\s*:\s*(?!null\b)[^,}\]\s]/.test(str)) return true;
  if (/"completed"\s*:\s*true/.test(str)) return true;
  if (/"(?:score1?|score2|points|redScore|blueScore)"\s*:\s*[0-9]/.test(str)) return true;
  return false;
}

/**
 * PUT /api/tournaments/:id/brackets/:bracketId
 *
 * Write a single bracket. Supports optimistic locking via the `If-Match` header.
 *
 * If the client sends `If-Match: <version>`, the write only succeeds when the
 * stored version equals the client version. On mismatch, returns 409 with the
 * current server bracket so the client can resolve the conflict.
 *
 * If no `If-Match` header is sent (legacy clients or bulk-sync path), falls
 * back to the unconditional upsert so nothing breaks.
 */
async function upsertSingleBracket(req, res, next) {
  try {
    const { id: tournamentId, bracketId } = req.params;
    const { bracket } = req.body;
    if (!bracket || typeof bracket !== 'object') {
      return res.status(400).json({ error: 'bracket object is required' });
    }

    const ifMatch = req.headers['if-match'];
    const useVersioning = ifMatch !== undefined;
    const clientVersion = useVersioning ? parseInt(ifMatch, 10) || 0 : null;

    let row;
    if (useVersioning) {
      const result = await BracketQueries.upsertWithVersion({
        id: bracketId,
        tournamentId,
        eventId: String(bracket.eventId || ''),
        divisionName: bracket.divisionName || bracket.division || '',
        bracketType: bracket.type || 'single-elimination',
        data: bracket,
        clientVersion,
      });

      if (result.conflict) {
        // Another device has written a newer version — return 409 with current state
        return res.status(409).json({
          error: 'conflict',
          message: 'A newer version of this bracket has been saved by another device.',
          bracket: result.row ? { ...result.row.data, __v: result.row.version } : null,
        });
      }
      row = result.row;
    } else {
      // No version header — legacy unconditional upsert
      row = await BracketQueries.upsert({
        id: bracketId,
        tournamentId,
        eventId: String(bracket.eventId || ''),
        divisionName: bracket.divisionName || bracket.division || '',
        bracketType: bracket.type || 'single-elimination',
        data: bracket,
      });
    }

    // Mark any director competitors that appear in this bracket as bracket_placed.
    const uuids = _extractUUIDs(bracket);
    if (uuids.length > 0) {
      DirectorCompetitorQueries.setBracketPlaced(uuids, tournamentId).catch(err =>
        console.warn('[bracket] setBracketPlaced failed:', err.message)
      );
    }

    // Broadcast to all clients subscribed to this bracket's channel
    const outBracket = { ...row.data, __v: row.version };
    broadcastBracketUpdate(tournamentId, bracketId, outBracket);
    res.json({ bracket: outBracket });
  } catch (err) { next(err); }
}

async function syncBrackets(req, res, next) {
  try {
    const tournamentId = req.params.id;
    const { brackets } = req.body;

    const t = await pool.query('SELECT created_by FROM tournaments WHERE id = $1', [tournamentId]);
    if (!t.rows[0]) return res.status(404).json({ error: 'Tournament not found' });
    if (t.rows[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const bracketArray = Object.values(brackets || {});
    if (bracketArray.length === 0) return res.json({ message: 'No brackets to sync', count: 0 });

    // Bulk sync uses unconditional upsert — it's a fallback path and not
    // appropriate for conflict checking (no per-bracket version info available).
    const results = await BracketQueries.bulkUpsert(tournamentId, bracketArray);

    const allUUIDs = [...new Set(bracketArray.flatMap(_extractUUIDs))];
    if (allUUIDs.length > 0) {
      DirectorCompetitorQueries.setBracketPlaced(allUUIDs, tournamentId).catch(err =>
        console.warn('[bracket] setBracketPlaced (bulk) failed:', err.message)
      );
    }

    res.json({ message: `Synced ${results.length} bracket(s)`, count: results.length });
  } catch (err) { next(err); }
}

/**
 * POST /api/tournaments/:id/match-results
 *
 * Append a match result to the audit log. Fire-and-forget from the operator —
 * the response is always 201 as long as the payload is valid; logging failures
 * are non-fatal and do not affect bracket state.
 */
async function appendMatchResult(req, res, next) {
  try {
    const tournamentId = req.params.id;
    const {
      bracketId, matchId, winnerId, winnerName, loserId, loserName,
      divisionName, eventId, scoreboardType, method, winNote, scores, matId,
    } = req.body;

    if (!bracketId) return res.status(400).json({ error: 'bracketId is required' });

    // Fire-and-forget — failures are logged but never block the caller
    BracketQueries.logMatchResult({
      tournamentId, bracketId, matchId, winnerId, winnerName, loserId, loserName,
      divisionName, eventId, scoreboardType, method, winNote, scores, matId,
    }).catch(err => console.warn('[match-results] Failed to log:', err.message));

    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
}

async function deleteBracket(req, res, next) {
  try {
    const tournamentId = req.params.id;
    const { bracketId } = req.params;

    const t = await pool.query('SELECT created_by FROM tournaments WHERE id = $1', [tournamentId]);
    if (!t.rows[0]) return res.status(404).json({ error: 'Tournament not found' });
    if (t.rows[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const existing = await BracketQueries.getOne(tournamentId, bracketId);
    if (!existing) return res.status(404).json({ error: 'Bracket not found' });

    if (_bracketHasResults(existing.data)) {
      return res.status(409).json({
        error: 'This bracket has recorded results and cannot be deleted. Edit results directly.',
        code: 'BRACKET_HAS_RESULTS',
      });
    }

    const deleted = await BracketQueries.remove(tournamentId, bracketId);
    if (!deleted) return res.status(404).json({ error: 'Bracket not found' });
    res.json({ message: 'Bracket deleted', id: deleted.id });
  } catch (err) { next(err); }
}

async function setBracketPublished(req, res, next) {
  try {
    const tournamentId = req.params.id;
    const { bracketId } = req.params;
    const { published } = req.body;

    const t = await pool.query('SELECT created_by FROM tournaments WHERE id = $1', [tournamentId]);
    if (!t.rows[0]) return res.status(404).json({ error: 'Tournament not found' });
    if (t.rows[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const result = await BracketQueries.setPublished(tournamentId, bracketId, !!published);
    if (!result) return res.status(404).json({ error: 'Bracket not found' });

    // Fire bracket-published notification emails (fire-and-forget)
    if (published) {
      const bracket = await BracketQueries.getOne(tournamentId, bracketId);
      const divisionName = bracket?.division_name || null;
      sendBracketPublishedEmails(tournamentId, bracketId, divisionName)
        .catch(e => console.warn('[email] bracket notify failed:', e.message));
    }

    res.json(result);
  } catch (err) { next(err); }
}

async function setAllBracketsPublished(req, res, next) {
  try {
    const tournamentId = req.params.id;
    const { published } = req.body;

    const t = await pool.query('SELECT created_by FROM tournaments WHERE id = $1', [tournamentId]);
    if (!t.rows[0]) return res.status(404).json({ error: 'Tournament not found' });
    if (t.rows[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const results = await BracketQueries.setAllPublished(tournamentId, !!published);
    res.json({ message: `Updated ${results.length} bracket(s)`, count: results.length });
  } catch (err) { next(err); }
}

function _clearBracketResults(bracket) {
  const b = JSON.parse(JSON.stringify(bracket));

  function clearMatch(m) {
    if (!m || typeof m !== 'object') return m;
    m.winner = null;
    m.status = 'pending';
    delete m.completed;
    ['score1','score2','score','points','redScore','blueScore',
     'penaltiesA','penaltiesB','winner_id'].forEach(k => delete m[k]);
    if (Array.isArray(m.bouts)) m.bouts = m.bouts.map(clearMatch);
    return m;
  }

  ['matches','winners','losers','repechageA','repechageB'].forEach(k => {
    if (Array.isArray(b[k])) b[k] = b[k].map(clearMatch);
  });
  if (b.finals) b.finals = clearMatch(b.finals);
  if (b.reset)  b.reset  = clearMatch(b.reset);
  if (Array.isArray(b.pools)) {
    b.pools = b.pools.map(pool => {
      if (Array.isArray(pool.matches)) pool.matches = pool.matches.map(clearMatch);
      delete pool.standings;
      return pool;
    });
  }
  if (Array.isArray(b.entries)) {
    b.entries = b.entries.map(e => { delete e.status; delete e.scores; return e; });
  }
  if (Array.isArray(b.rounds)) {
    b.rounds = b.rounds.map(round => {
      if (Array.isArray(round.performances)) {
        round.performances = round.performances.map(p => { delete p.completed; delete p.scores; return p; });
      }
      return round;
    });
  }
  return b;
}

async function resetBracket(req, res, next) {
  try {
    const { id: tournamentId, bracketId } = req.params;

    const t = await pool.query('SELECT created_by FROM tournaments WHERE id = $1', [tournamentId]);
    if (!t.rows[0]) return res.status(404).json({ error: 'Tournament not found' });
    if (t.rows[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const existing = await BracketQueries.getOne(tournamentId, bracketId);
    if (!existing) return res.status(404).json({ error: 'Bracket not found' });

    const cleared = _clearBracketResults(existing.data);

    const uuids = _extractUUIDs(existing.data);
    if (uuids.length > 0) {
      DirectorCompetitorQueries.clearBracketPlaced(uuids, tournamentId).catch(err =>
        console.warn('[bracket] clearBracketPlaced failed:', err.message)
      );
    }

    const updated = await BracketQueries.upsert({
      id: bracketId,
      tournamentId,
      eventId: String(existing.event_id || ''),
      divisionName: existing.division_name || '',
      bracketType: cleared.type || existing.bracket_type,
      data: cleared,
    });

    const outBracket = { ...updated.data, __v: updated.version };
    broadcastBracketUpdate(tournamentId, bracketId, outBracket);
    res.json({ bracket: outBracket, message: 'Bracket reset — all results cleared.' });
  } catch (err) { next(err); }
}

module.exports = {
  getBrackets, getSingleBracket, getBracketsStartedStatus,
  upsertSingleBracket, syncBrackets, appendMatchResult,
  deleteBracket, setBracketPublished, setAllBracketsPublished, resetBracket,
};
