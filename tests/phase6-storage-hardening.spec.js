// @ts-check
/**
 * Phase 6 — Storage hardening tests
 *
 * Validates that:
 *   1. A cold device (fresh page load) fetches authoritative brackets from server
 *   2. Only dirty (changed) brackets are synced — concurrent operators don't clobber each other
 *   3. The beforeunload beacon sends only dirty brackets (simulated via the sync endpoint)
 *   4. Page-refresh mid-tournament preserves concurrent results (no stale overwrite)
 *   5. Empty dirty set → sync is a no-op (no accidental full-overwrite)
 *
 * Run with:
 *   npx playwright test tests/phase6-storage-hardening.spec.js --config tests/playwright-phase6.config.js --reporter=list
 */

const { test, expect, request } = require('@playwright/test');
const fs   = require('fs');
const path = require('path');

const BASE       = 'http://localhost:3000';
const TS         = Date.now();
const STATE_FILE = path.join(__dirname, '.phase6-state.json');

const OPERATOR_A = { email: `p6opA.${TS}@test.local`, password: 'OperatorPass1!' };
const OPERATOR_B = { email: `p6opB.${TS}@test.local`, password: 'OperatorPass1!' };

const S = { cookiesA: '', cookiesB: '', tournamentId: null };

function saveState() { try { fs.writeFileSync(STATE_FILE, JSON.stringify(S)); } catch {} }
function loadState()  { try { Object.assign(S, JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))); } catch {} }
loadState();

async function api(method, urlPath, { body, cookies, headers = {} } = {}) {
  const ctx = await request.newContext({ baseURL: BASE, ignoreHTTPSErrors: true });
  const reqHeaders = { 'Content-Type': 'application/json', ...headers };
  if (cookies) reqHeaders['Cookie'] = cookies;
  const opts = { headers: reqHeaders, failOnStatusCode: false };
  if (body !== undefined) opts.data = body;
  const res = await ctx[method.toLowerCase()](urlPath, opts);
  let json; try { json = await res.json(); } catch { json = null; }
  await ctx.dispose();
  return { status: res.status(), body: json };
}

async function registerAndLogin(email, password) {
  await api('POST', '/api/auth/signup', { body: { email, password, firstName: 'Test', lastName: 'Op' } });
  const ctx = await request.newContext({ baseURL: BASE });
  const res = await ctx.post('/api/auth/login', {
    data: { email, password },
    headers: { 'Content-Type': 'application/json' },
    failOnStatusCode: false,
  });
  const hdrs = res.headersArray().filter(h => h.name.toLowerCase() === 'set-cookie');
  const cookieStr = hdrs.map(h => h.value.split(';')[0]).join('; ');
  const json = await res.json().catch(() => null);
  await ctx.dispose();
  return { cookieStr, body: json };
}

function makeBracket(id, overrides = {}) {
  return {
    id,
    type:  'single-elimination',
    division: 'Test Division',
    rounds: 1,
    matches: [
      { id: 1, round: 1, position: 0, status: 'pending', redCorner: null, blueCorner: null, winner: null },
    ],
    competitors: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── Setup ──────────────────────────────────────────────────────────────────────

test.describe('P6.0 Setup', () => {
  test.describe.configure({ mode: 'serial' });

  test('P6.0.1 register operators and create tournament', async () => {
    const { cookieStr: cA } = await registerAndLogin(OPERATOR_A.email, OPERATOR_A.password);
    const { cookieStr: cB } = await registerAndLogin(OPERATOR_B.email, OPERATOR_B.password);
    S.cookiesA = cA;
    S.cookiesB = cB;

    const { status, body } = await api('POST', '/api/tournaments', {
      cookies: S.cookiesA,
      body: { name: `Phase6 Hardening ${TS}`, date: '2099-06-01', location: 'Test Dojo' },
    });
    expect(status, JSON.stringify(body)).toBe(201);
    S.tournamentId = body.tournament?.id ?? body.id;
    saveState();
    expect(S.tournamentId).toBeTruthy();
  });
});

// ── Suite 1: Cold-device load ──────────────────────────────────────────────────

test.describe('P6.1 Cold-device: fresh load fetches server state', () => {
  test.describe.configure({ mode: 'serial' });

  let bracketIdA;

  test('P6.1.1 operator A syncs a bracket with a completed match', async () => {
    loadState();
    bracketIdA = `bracket-mat1-${TS}`;
    const bracket = makeBracket(bracketIdA, {
      matches: [
        { id: 1, round: 1, position: 0, status: 'completed',
          redCorner: { id: 'c1', name: 'Alice' }, blueCorner: { id: 'c2', name: 'Bob' },
          winner: { id: 'c1', name: 'Alice' } },
      ],
    });
    const { status } = await api('POST', `/api/tournaments/${S.tournamentId}/brackets/sync`, {
      cookies: S.cookiesA,
      body: { brackets: { [bracketIdA]: bracket } },
    });
    expect(status).toBe(200);
  });

  test('P6.1.2 cold device (fresh GET, same auth) sees A\'s match result on server', async () => {
    // Simulates a page-reload: _msData is gone, fresh GET re-hydrates from server.
    const { status, body } = await api('GET', `/api/tournaments/${S.tournamentId}/brackets`, {
      cookies: S.cookiesA,
    });
    expect(status).toBe(200);
    const bracket = body.brackets?.[bracketIdA];
    expect(bracket, 'bracket should be in server response').toBeTruthy();
    const finalMatch = bracket.matches?.[0];
    expect(finalMatch?.status).toBe('completed');
    expect(finalMatch?.winner?.id).toBe('c1');
  });

  test('P6.1.3 cold device GET returns __v version for optimistic lock tracking', async () => {
    const { status, body } = await api('GET', `/api/tournaments/${S.tournamentId}/brackets`, {
      cookies: S.cookiesA,
    });
    expect(status).toBe(200);
    const bracket = body.brackets?.[bracketIdA];
    expect(typeof bracket.__v).toBe('number');
    expect(bracket.__v).toBeGreaterThanOrEqual(0);
  });
});

// ── Suite 2: Dirty-only sync prevents clobbering ───────────────────────────────

test.describe('P6.2 Dirty-only sync: concurrent operators do not clobber each other', () => {
  test.describe.configure({ mode: 'serial' });

  let bracketA, bracketB;

  test('P6.2.1 operator A syncs bracketA (mat 1)', async () => {
    loadState();
    bracketA = `bracket-clobber-A-${TS}`;
    const { status } = await api('POST', `/api/tournaments/${S.tournamentId}/brackets/sync`, {
      cookies: S.cookiesA,
      body: { brackets: { [bracketA]: makeBracket(bracketA, { division: 'Mat 1 Division' }) } },
    });
    expect(status).toBe(200);
  });

  test('P6.2.2 operator B syncs bracketB (mat 2) — does NOT include bracketA', async () => {
    loadState();
    bracketB = `bracket-clobber-B-${TS}`;
    // Simulate "dirty-only" sync: B only sends the bracket IT modified.
    // B loaded bracketA from server but didn't touch it → not in sync payload.
    const { status } = await api('POST', `/api/tournaments/${S.tournamentId}/brackets/sync`, {
      cookies: S.cookiesA, // owner auth required
      body: { brackets: { [bracketB]: makeBracket(bracketB, { division: 'Mat 2 Division' }) } },
    });
    expect(status).toBe(200);
  });

  test('P6.2.3 bracketA still intact on server after B\'s sync (not clobbered)', async () => {
    const { status, body } = await api('GET', `/api/tournaments/${S.tournamentId}/brackets`, {
      cookies: S.cookiesA,
    });
    expect(status).toBe(200);
    expect(body.brackets?.[bracketA]).toBeTruthy();
    expect(body.brackets?.[bracketA]?.division).toBe('Mat 1 Division');
  });

  test('P6.2.4 both brackets coexist on server', async () => {
    const { status, body } = await api('GET', `/api/tournaments/${S.tournamentId}/brackets`, {
      cookies: S.cookiesA,
    });
    expect(status).toBe(200);
    expect(body.brackets?.[bracketA]).toBeTruthy();
    expect(body.brackets?.[bracketB]).toBeTruthy();
  });
});

// ── Suite 3: Stale-full-sync protection ────────────────────────────────────────

test.describe('P6.3 Stale beacon protection: all-brackets sync is idempotent if data is current', () => {
  test.describe.configure({ mode: 'serial' });

  let bracketX, bracketY;

  test('P6.3.1 operator A creates bracketX with a result', async () => {
    loadState();
    bracketX = `bracket-stale-X-${TS}`;
    const { status } = await api('POST', `/api/tournaments/${S.tournamentId}/brackets/sync`, {
      cookies: S.cookiesA,
      body: { brackets: { [bracketX]: makeBracket(bracketX, {
        matches: [{ id: 1, round: 1, position: 0, status: 'completed',
          redCorner: { id: 'c3', name: 'Carol' }, blueCorner: { id: 'c4', name: 'Dave' },
          winner: { id: 'c3', name: 'Carol' } }],
      }) } },
    });
    expect(status).toBe(200);
  });

  test('P6.3.2 operator A then syncs bracketY (simulates A recording a second match)', async () => {
    bracketY = `bracket-stale-Y-${TS}`;
    const { status } = await api('POST', `/api/tournaments/${S.tournamentId}/brackets/sync`, {
      cookies: S.cookiesA,
      body: { brackets: { [bracketY]: makeBracket(bracketY, { division: 'Stale Test Division' }) } },
    });
    expect(status).toBe(200);
  });

  test('P6.3.3 simulate "empty dirty set" sync: send {} → should NOT touch existing brackets', async () => {
    // This simulates _syncBracketsToServer returning early when dirtyIds is empty.
    // The endpoint called with {} brackets is a valid no-op from the server's perspective.
    const { status, body } = await api('POST', `/api/tournaments/${S.tournamentId}/brackets/sync`, {
      cookies: S.cookiesA,
      body: { brackets: {} },
    });
    // Server should accept empty payload gracefully (200 or no-op)
    expect([200, 204]).toContain(status);
  });

  test('P6.3.4 bracketX result still intact after the empty sync', async () => {
    const { status, body } = await api('GET', `/api/tournaments/${S.tournamentId}/brackets`, {
      cookies: S.cookiesA,
    });
    expect(status).toBe(200);
    const bx = body.brackets?.[bracketX];
    expect(bx).toBeTruthy();
    expect(bx?.matches?.[0]?.winner?.id).toBe('c3');
  });
});

// ── Suite 4: Page-refresh doesn't lose a just-written result ───────────────────

test.describe('P6.4 Page-refresh resilience: latest match result survives reload', () => {
  test.describe.configure({ mode: 'serial' });

  let bracketId;
  let savedVersion;

  test('P6.4.1 write a match result to the server', async () => {
    loadState();
    bracketId = `bracket-refresh-${TS}`;
    const { status } = await api('POST', `/api/tournaments/${S.tournamentId}/brackets/sync`, {
      cookies: S.cookiesA,
      body: { brackets: { [bracketId]: makeBracket(bracketId, {
        matches: [{ id: 1, round: 1, position: 0, status: 'completed',
          redCorner: { id: 'c5', name: 'Eve' }, blueCorner: { id: 'c6', name: 'Frank' },
          winner: { id: 'c5', name: 'Eve' } }],
      }) } },
    });
    expect(status).toBe(200);
  });

  test('P6.4.2 simulated page refresh: GET brackets returns the saved result', async () => {
    // A page refresh wipes _msData and re-calls _loadBracketsFromServer.
    // Equivalent to a fresh GET — verify the result is durable.
    const { status, body } = await api('GET', `/api/tournaments/${S.tournamentId}/brackets`, {
      cookies: S.cookiesA,
    });
    expect(status).toBe(200);
    const b = body.brackets?.[bracketId];
    expect(b).toBeTruthy();
    const m = b?.matches?.[0];
    expect(m?.status).toBe('completed');
    expect(m?.winner?.id).toBe('c5');
    savedVersion = b?.__v;
  });

  test('P6.4.3 second device loading after refresh sees the same result', async () => {
    const { status, body } = await api('GET', `/api/tournaments/${S.tournamentId}/brackets`, {
      cookies: S.cookiesA,
    });
    expect(status).toBe(200);
    expect(body.brackets?.[bracketId]?.matches?.[0]?.winner?.id).toBe('c5');
  });

  test('P6.4.4 PUT with correct version (post-reload) succeeds', async () => {
    // After a reload the client uses bracket.__v as the If-Match ETag.
    // Verify the round-trip: load → use __v → PUT succeeds.
    const { status: getStatus, body: getBody } = await api(
      'GET', `/api/tournaments/${S.tournamentId}/brackets`,
      { cookies: S.cookiesA }
    );
    expect(getStatus).toBe(200);
    const currentVersion = getBody.brackets?.[bracketId]?.__v ?? 0;

    const updatedBracket = makeBracket(bracketId, {
      matches: [{ id: 1, round: 1, position: 0, status: 'completed',
        redCorner: { id: 'c5', name: 'Eve' }, blueCorner: { id: 'c6', name: 'Frank' },
        winner: { id: 'c5', name: 'Eve' }, score1: '7', score2: '2' }],
    });

    const { status: putStatus, body: putBody } = await api(
      'PUT', `/api/tournaments/${S.tournamentId}/brackets/${bracketId}`,
      {
        cookies: S.cookiesA,
        headers: { 'If-Match': String(currentVersion) },
        body: { bracket: updatedBracket },
      }
    );
    expect(putStatus, JSON.stringify(putBody)).toBe(200);
  });

  test('P6.4.5 PUT with stale version (simulates another device wrote concurrently) → 409', async () => {
    const { status, body } = await api(
      'PUT', `/api/tournaments/${S.tournamentId}/brackets/${bracketId}`,
      {
        cookies: S.cookiesA,
        headers: { 'If-Match': '0' }, // deliberately stale
        body: { bracket: makeBracket(bracketId) },
      }
    );
    expect(status).toBe(409);
  });
});
