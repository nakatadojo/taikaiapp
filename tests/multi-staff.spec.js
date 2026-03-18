// @ts-check
/**
 * multi-staff.spec.js
 *
 * Tests for the two critical multi-device race conditions:
 *  1. Bracket sync overwrites concurrent match results (Fix #1)
 *  2. Scoreboard display pages on separate devices are frozen (Fix #2)
 *
 * These tests MUST FAIL before the fixes are applied and PASS after.
 *
 * Accounts use @testmail.kimesoft.io so they can be cleaned up later.
 * Director credentials must be supplied via environment variables:
 *   SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD
 *
 * Tests run against the production server at taikaiapp.com.
 */

const { test, expect } = require('@playwright/test');

const BASE = 'https://www.taikaiapp.com';

// Test 1b and 2b specifically test WebSocket connectivity and push.
// They will fail if socket.io is not installed on the server.
// Test 1 and 2 test the API isolation (may already pass or fail depending on server state).

// Director account reused from the main suite (same timestamp-based email approach)
const ts = Date.now();
const director = {
  email: `multi.staff.${ts}@testmail.kimesoft.io`,
  password: 'TestPass123!',
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Log in via the auth modal and return the session cookies.
 * Returns true on success, false on failure.
 */
async function login(page, email, password) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const logInNav = page.locator('button.nav-btn-ghost').filter({ hasText: /log\s*in/i }).first();
  const signUpNav = page.locator('button.nav-btn-primary').filter({ hasText: /sign\s*up/i }).first();

  if (await logInNav.isVisible({ timeout: 3000 }).catch(() => false)) {
    await logInNav.click();
    const loginPanelVisible = await page.locator('#login-email')
      .isVisible({ timeout: 2000 }).catch(() => false);
    if (!loginPanelVisible) {
      await page.locator('#tab-login').click({ timeout: 5000 });
    }
  } else if (await signUpNav.isVisible({ timeout: 2000 }).catch(() => false)) {
    await signUpNav.click();
    await page.locator('#tab-login').click({ timeout: 6000 });
  } else {
    await page.evaluate(() => {
      if (typeof openAuthModal === 'function') openAuthModal('login');
    });
  }

  await page.locator('#login-email').waitFor({ state: 'visible', timeout: 10_000 });
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.locator('#login-submit').click();

  try {
    await page.locator('#login-email').waitFor({ state: 'hidden', timeout: 8000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Sign up a new account and return when done.
 */
async function signup(page, { email, password }) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const signUpNav = page.locator('button.nav-btn-primary').filter({ hasText: /sign\s*up/i }).first();
  if (await signUpNav.isVisible({ timeout: 3000 }).catch(() => false)) {
    await signUpNav.click();
  } else {
    await page.evaluate(() => {
      if (typeof openAuthModal === 'function') openAuthModal('signup');
    });
  }

  await page.locator('#signup-email').waitFor({ state: 'visible', timeout: 10_000 });
  await page.locator('#signup-first').fill('Multi');
  await page.locator('#signup-last').fill('Staff');
  await page.locator('#signup-email').fill(email);
  await page.locator('#signup-password').fill(password);
  await page.locator('#signup-submit').click();

  await page.locator('#signup-email').waitFor({ state: 'hidden', timeout: 12_000 }).catch(() => {});
}

/**
 * Helper to call the API from within the page context (sends cookies).
 */
async function api(page, method, path, body) {
  return page.evaluate(async ([method, path, body]) => {
    const opts = { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include' };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(path, opts);
    let data;
    try { data = await r.json(); } catch { data = null; }
    return { status: r.status, data };
  }, [method, `${path}`, body]);
}

// ─────────────────────────────────────────────────────────────
// Suite: Multi-Staff Race Conditions
// ─────────────────────────────────────────────────────────────

test.describe('Multi-Staff Race Conditions', () => {

  // Shared state set up in the first test and reused
  let tournamentId = null;

  test.beforeAll(async ({ browser }) => {
    // Create a fresh director account and tournament for these tests
    const page = await browser.newPage();
    try {
      await signup(page, director);
      const loggedIn = await login(page, director.email, director.password);
      if (!loggedIn) throw new Error('Director login failed in beforeAll');

      // Create a tournament via API
      const createResp = await api(page, 'POST', '/api/tournaments', {
        name: `Multi-Staff Test ${ts}`,
        date: new Date(Date.now() + 30 * 86400_000).toISOString().split('T')[0],
        city: 'Test City',
        state: 'CA',
      });
      if (createResp.status !== 201 && createResp.status !== 200) {
        throw new Error(`Failed to create tournament: ${createResp.status} ${JSON.stringify(createResp.data)}`);
      }
      tournamentId = createResp.data?.tournament?.id || createResp.data?.id;
      if (!tournamentId) throw new Error('No tournament ID in response');
      console.log(`  Created test tournament: ${tournamentId}`);
    } finally {
      await page.close();
    }
  });

  // ───────────────────────────────────────────────────────────
  // FIX #1 TEST: Per-bracket API writes prevent overwrite
  // ───────────────────────────────────────────────────────────

  test('Fix #1: PUT /api/tournaments/:id/brackets/:bracketId upserts only that bracket', async ({ browser }) => {
    // This test verifies the new single-bracket PUT endpoint.
    // BEFORE the fix: this endpoint does not exist → 404 → test fails.
    // AFTER the fix: endpoint exists, upserts one bracket without touching others.

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // Both devices log in
      await login(pageA, director.email, director.password);
      await login(pageB, director.email, director.password);

      // Build two minimal bracket objects
      const bracketAId = `event1_divA_${ts}`;
      const bracketBId = `event1_divB_${ts}`;

      const bracketA = {
        id: bracketAId,
        eventId: 'event1',
        divisionName: `Division A ${ts}`,
        type: 'single-elimination',
        matches: [
          {
            id: 'matchA1', round: 1, position: 0, status: 'pending',
            redCorner: { id: 'c1', firstName: 'Alice', lastName: 'A' },
            blueCorner: { id: 'c2', firstName: 'Bob', lastName: 'B' },
          }
        ]
      };

      const bracketB = {
        id: bracketBId,
        eventId: 'event1',
        divisionName: `Division B ${ts}`,
        type: 'single-elimination',
        matches: [
          {
            id: 'matchB1', round: 1, position: 0, status: 'pending',
            redCorner: { id: 'c3', firstName: 'Carol', lastName: 'C' },
            blueCorner: { id: 'c4', firstName: 'Dave', lastName: 'D' },
          }
        ]
      };

      // First, create both brackets via bulk sync so they exist on server
      const initResp = await api(pageA, 'POST', `/api/tournaments/${tournamentId}/brackets/sync`, {
        brackets: {
          [bracketAId]: bracketA,
          [bracketBId]: bracketB,
        }
      });
      expect(initResp.status, `Initial bulk sync failed: ${JSON.stringify(initResp.data)}`).toBe(200);

      // Device A scores a match in Bracket A using the new per-bracket PUT endpoint
      const bracketAWithResult = {
        ...bracketA,
        matches: bracketA.matches.map(m =>
          m.id === 'matchA1' ? {
            ...m,
            status: 'completed',
            winner: { id: 'c1', firstName: 'Alice', lastName: 'A' },
            score1: 3, score2: 1, winMethod: 'points',
          } : m
        )
      };

      const putRespA = await api(pageA, 'PUT',
        `/api/tournaments/${tournamentId}/brackets/${bracketAId}`,
        { bracket: bracketAWithResult }
      );
      expect(putRespA.status,
        `PUT /brackets/${bracketAId} failed — endpoint may not exist yet (Fix #1 not applied): HTTP ${putRespA.status}`
      ).toBe(200);

      // Device B scores a match in Bracket B using the new per-bracket PUT endpoint
      const bracketBWithResult = {
        ...bracketB,
        matches: bracketB.matches.map(m =>
          m.id === 'matchB1' ? {
            ...m,
            status: 'completed',
            winner: { id: 'c3', firstName: 'Carol', lastName: 'C' },
            score1: 2, score2: 0, winMethod: 'points',
          } : m
        )
      };

      const putRespB = await api(pageB, 'PUT',
        `/api/tournaments/${tournamentId}/brackets/${bracketBId}`,
        { bracket: bracketBWithResult }
      );
      expect(putRespB.status,
        `PUT /brackets/${bracketBId} failed — endpoint may not exist yet (Fix #1 not applied): HTTP ${putRespB.status}`
      ).toBe(200);

      // Wait for syncs to settle
      await pageA.waitForTimeout(1000);

      // Read back both brackets from the server — use the new GET single-bracket endpoint
      const getA = await api(pageA, 'GET',
        `/api/tournaments/${tournamentId}/brackets/${bracketAId}`
      );
      expect(getA.status,
        `GET /brackets/${bracketAId} failed — single-bracket GET endpoint may not exist yet: HTTP ${getA.status}`
      ).toBe(200);

      const getB = await api(pageB, 'GET',
        `/api/tournaments/${tournamentId}/brackets/${bracketBId}`
      );
      expect(getB.status,
        `GET /brackets/${bracketBId} failed: HTTP ${getB.status}`
      ).toBe(200);

      // Assert: Bracket A match result was NOT erased by Device B's write
      const bracketAFromServer = getA.data?.bracket;
      expect(bracketAFromServer, 'Bracket A not found in server response').toBeTruthy();
      const matchA1 = bracketAFromServer?.matches?.find(m => m.id === 'matchA1');
      expect(matchA1?.status,
        'Bracket A match result was erased by Device B\'s write (Fix #1 not applied)'
      ).toBe('completed');
      expect(matchA1?.winner?.id,
        'Bracket A winner was overwritten'
      ).toBe('c1');

      // Assert: Bracket B match result is present
      const bracketBFromServer = getB.data?.bracket;
      expect(bracketBFromServer, 'Bracket B not found in server response').toBeTruthy();
      const matchB1 = bracketBFromServer?.matches?.find(m => m.id === 'matchB1');
      expect(matchB1?.status,
        'Bracket B match result was not saved'
      ).toBe('completed');
      expect(matchB1?.winner?.id,
        'Bracket B winner is wrong'
      ).toBe('c3');

      // Assert: Device B can see Device A's result via GET
      const getAFromB = await api(pageB, 'GET',
        `/api/tournaments/${tournamentId}/brackets/${bracketAId}`
      );
      const matchA1FromB = getAFromB.data?.bracket?.matches?.find(m => m.id === 'matchA1');
      expect(matchA1FromB?.status,
        'Device B cannot see Device A\'s match result from server'
      ).toBe('completed');

      console.log('  Fix #1: Per-bracket writes verified — no cross-device overwrite');
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  // ───────────────────────────────────────────────────────────
  // FIX #2 TEST: Per-mat scoreboard state polling
  // ───────────────────────────────────────────────────────────

  test('Fix #2: GET /api/tournaments/:id/scoreboard-state?ring=N returns per-ring state', async ({ browser }) => {
    // This test verifies per-ring filtering in the scoreboard-state endpoint.
    // BEFORE the fix: the endpoint ignores the ?ring= param and returns all state →
    //   ring2 display would see ring1's data, test fails the isolation assertion.
    // AFTER the fix: ?ring=1 returns only ring 1's state, ?ring=2 returns only ring 2's.

    const contextA = await browser.newContext(); // Operator for Ring 1
    const contextB = await browser.newContext(); // Operator for Ring 2

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // Both operators log in
      await login(pageA, director.email, director.password);
      await login(pageB, director.email, director.password);

      // Operator A (Ring 1) writes state for ring 1
      const ring1State = {
        ring: 1,
        matName: 'Mat 1',
        scoreboardType: 'kumite',
        divisionName: 'Senior Male Kumite',
        redName: 'Alice Smith',
        blueName: 'Bob Jones',
        redScore: 3,
        blueScore: 1,
        timer: '1:30',
        _testRing1Marker: `ring1_${ts}`,
      };

      // Operator B (Ring 2) writes state for ring 2
      const ring2State = {
        ring: 2,
        matName: 'Mat 2',
        scoreboardType: 'kumite',
        divisionName: 'Junior Female Kumite',
        redName: 'Carol Brown',
        blueName: 'Diana Lee',
        redScore: 2,
        blueScore: 2,
        timer: '0:45',
        _testRing2Marker: `ring2_${ts}`,
      };

      // Operator A writes ring 1 state to server
      const putA = await api(pageA, 'PUT',
        `/api/tournaments/${tournamentId}/scoreboard-state`,
        { state: ring1State }
      );
      expect(putA.status, `PUT scoreboard-state ring 1 failed: HTTP ${putA.status}`).toBe(200);

      // Operator B writes ring 2 state to server
      const putB = await api(pageB, 'PUT',
        `/api/tournaments/${tournamentId}/scoreboard-state`,
        { state: ring2State }
      );
      expect(putB.status, `PUT scoreboard-state ring 2 failed: HTTP ${putB.status}`).toBe(200);

      // Wait for writes to settle
      await pageA.waitForTimeout(500);

      // Display page for Ring 1 polls GET with ?ring=1
      const getR1 = await api(pageA, 'GET',
        `/api/tournaments/${tournamentId}/scoreboard-state?ring=1`
      );
      expect(getR1.status, `GET scoreboard-state?ring=1 failed: HTTP ${getR1.status}`).toBe(200);

      // Display page for Ring 2 polls GET with ?ring=2
      const getR2 = await api(pageB, 'GET',
        `/api/tournaments/${tournamentId}/scoreboard-state?ring=2`
      );
      expect(getR2.status, `GET scoreboard-state?ring=2 failed: HTTP ${getR2.status}`).toBe(200);

      const state1 = getR1.data?.state;
      const state2 = getR2.data?.state;

      expect(state1, 'Ring 1 display received no state').toBeTruthy();
      expect(state2, 'Ring 2 display received no state').toBeTruthy();

      // Ring 1 display must show Ring 1 data
      expect(state1?._testRing1Marker,
        'Ring 1 display is not showing Ring 1 state (Fix #2 not applied — per-ring storage missing)'
      ).toBe(`ring1_${ts}`);

      // Ring 2 display must show Ring 2 data
      expect(state2?._testRing2Marker,
        'Ring 2 display is not showing Ring 2 state (Fix #2 not applied — per-ring storage missing)'
      ).toBe(`ring2_${ts}`);

      // Ring 1 display must NOT show Ring 2 data
      expect(state1?._testRing2Marker,
        'Ring 1 display is seeing Ring 2 data — per-ring isolation broken'
      ).toBeUndefined();

      // Ring 2 display must NOT show Ring 1 data
      expect(state2?._testRing1Marker,
        'Ring 2 display is seeing Ring 1 data — per-ring isolation broken'
      ).toBeUndefined();

      console.log('  Fix #2: Per-ring scoreboard state isolation verified');
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('Fix #2: scoreboard state written by operator without ring param still readable', async ({ browser }) => {
    // Backward-compatibility: if operator writes state without a ring, GET without ?ring
    // still returns the full state (legacy single-mat tournament).
    const page = await browser.newPage();
    try {
      await login(page, director.email, director.password);

      const legacyState = {
        matName: 'Mat 1',
        scoreboardType: 'kumite',
        divisionName: 'Open Division',
        redName: 'Test Red',
        blueName: 'Test Blue',
        redScore: 0,
        blueScore: 0,
        timer: '2:00',
        _legacyMarker: `legacy_${ts}`,
      };

      const putResp = await api(page, 'PUT',
        `/api/tournaments/${tournamentId}/scoreboard-state`,
        { state: legacyState }
      );
      expect(putResp.status, `Legacy PUT failed: HTTP ${putResp.status}`).toBe(200);

      // GET without ring filter — should still work
      const getResp = await api(page, 'GET',
        `/api/tournaments/${tournamentId}/scoreboard-state`
      );
      expect(getResp.status, `Legacy GET failed: HTTP ${getResp.status}`).toBe(200);

      // The state should be present (may be nested under full state or returned directly)
      const returnedState = getResp.data?.state;
      expect(returnedState, 'No state returned for legacy GET').toBeTruthy();
      console.log('  Fix #2: Legacy scoreboard-state read verified');
    } finally {
      await page.close();
    }
  });

  // ───────────────────────────────────────────────────────────
  // FIX #1 WebSocket TEST: Bracket update pushed via WebSocket
  // MUST FAIL before socket.io is installed on the server
  // ───────────────────────────────────────────────────────────

  test('Fix #1 WS: bracket:updated event received on other device within 2s', async ({ browser }) => {
    // Requires socket.io to be served at /socket.io/socket.io.js
    // This test MUST FAIL before WebSocket infrastructure is installed.
    const contextA = await browser.newContext(); // "listener" device
    const contextB = await browser.newContext(); // "writer" device

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await login(pageA, director.email, director.password);
      await login(pageB, director.email, director.password);

      const bracketId = `ws_bracket_${ts}`;

      // Check socket.io is available on Device A — MUST FAIL before fix
      const socketIoLoaded = await pageA.evaluate(async () => {
        const res = await fetch('/socket.io/socket.io.js');
        return res.ok;
      });
      expect(socketIoLoaded,
        'socket.io client script must be served at /socket.io/socket.io.js (Fix #1 WS not applied yet)'
      ).toBe(true);

      // Load socket.io and connect on Device A
      await pageA.addScriptTag({ url: '/socket.io/socket.io.js' });

      // Device A connects and subscribes to bracketId
      const subscribed = await pageA.evaluate(async ([baseUrl, tid, bid]) => {
        return new Promise((resolve) => {
          if (typeof io === 'undefined') { resolve(false); return; }
          const s = io(baseUrl, { transports: ['websocket', 'polling'] });
          window._wsTestSocket = s;
          s.on('connect', () => {
            s.emit('subscribe:bracket', { tournamentId: tid, bracketId: bid });
            resolve(true);
          });
          s.on('connect_error', () => resolve(false));
          setTimeout(() => resolve(false), 5000);
        });
      }, [BASE, tournamentId, bracketId]);

      expect(subscribed, 'Device A must connect and subscribe to WebSocket channel').toBe(true);

      // Set up listener for bracket:updated
      const updatePromise = pageA.evaluate(([bid]) => {
        return new Promise((resolve) => {
          const s = window._wsTestSocket;
          if (!s) { resolve(null); return; }
          s.once('bracket:updated', (data) => {
            if (data.bracketId === bid) resolve(data);
          });
          setTimeout(() => resolve(null), 3000);
        });
      }, [bracketId]);

      // Device B writes a bracket update
      await pageB.waitForTimeout(200);
      await api(pageB, 'PUT',
        `/api/tournaments/${tournamentId}/brackets/${bracketId}`,
        {
          bracket: {
            id: bracketId,
            eventId: 'e1',
            divisionName: `WS Division ${ts}`,
            type: 'single-elimination',
            matches: [{ id: 'mws', status: 'completed', winner: { id: 'w1', firstName: 'WebSocket', lastName: 'Winner' } }],
          }
        }
      );

      const update = await updatePromise;
      expect(update,
        'Device A must receive bracket:updated event within 3s of Device B writing (Fix #1 WS not applied)'
      ).not.toBeNull();
      if (update) {
        expect(update.bracketId).toBe(bracketId);
        expect(update.bracket?.matches?.[0]?.winner?.firstName).toBe('WebSocket');
        console.log('  Fix #1 WS: bracket:updated event received on Device A');
      }
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  // ───────────────────────────────────────────────────────────
  // FIX #2 WebSocket TEST: Scoreboard update pushed via WebSocket
  // MUST FAIL before socket.io is installed on the server
  // ───────────────────────────────────────────────────────────

  test('Fix #2 WS: scoreboard:updated event received on ring-specific display within 2s', async ({ browser }) => {
    // Requires socket.io to be served at /socket.io/socket.io.js
    // This test MUST FAIL before WebSocket infrastructure is installed.
    const ctxDisplay1 = await browser.newContext();
    const ctxDisplay2 = await browser.newContext();
    const ctxOperator  = await browser.newContext();

    const display1 = await ctxDisplay1.newPage(); // Ring 1 display
    const display2 = await ctxDisplay2.newPage(); // Ring 2 display
    const operator  = await ctxOperator.newPage();  // Operator

    try {
      await login(display1, director.email, director.password);
      await login(display2, director.email, director.password);
      await login(operator, director.email, director.password);

      // Check socket.io is available — MUST FAIL before fix
      const socketIoLoaded = await display1.evaluate(async () => {
        const res = await fetch('/socket.io/socket.io.js');
        return res.ok;
      });
      expect(socketIoLoaded,
        'socket.io client script must be served at /socket.io/socket.io.js (Fix #2 WS not applied yet)'
      ).toBe(true);

      await display1.addScriptTag({ url: '/socket.io/socket.io.js' });
      await display2.addScriptTag({ url: '/socket.io/socket.io.js' });

      // Display 1 connects and subscribes to ring 1
      const d1Ready = await display1.evaluate(async ([baseUrl, tid]) => {
        return new Promise((resolve) => {
          if (typeof io === 'undefined') { resolve(false); return; }
          const s = io(baseUrl, { transports: ['websocket', 'polling'] });
          window._d1Socket = s;
          s.on('connect', () => {
            s.emit('subscribe:ring', { tournamentId: tid, ring: 1 });
            resolve(true);
          });
          s.on('connect_error', () => resolve(false));
          setTimeout(() => resolve(false), 5000);
        });
      }, [BASE, tournamentId]);
      expect(d1Ready, 'Display 1 must connect to WebSocket').toBe(true);

      // Display 2 connects and subscribes to ring 2
      const d2Ready = await display2.evaluate(async ([baseUrl, tid]) => {
        return new Promise((resolve) => {
          if (typeof io === 'undefined') { resolve(false); return; }
          const s = io(baseUrl, { transports: ['websocket', 'polling'] });
          window._d2Socket = s;
          s.on('connect', () => {
            s.emit('subscribe:ring', { tournamentId: tid, ring: 2 });
            resolve(true);
          });
          s.on('connect_error', () => resolve(false));
          setTimeout(() => resolve(false), 5000);
        });
      }, [BASE, tournamentId]);
      expect(d2Ready, 'Display 2 must connect to WebSocket').toBe(true);

      // Listen for scoreboard:updated on both displays
      const d1UpdatePromise = display1.evaluate(() => {
        return new Promise((resolve) => {
          const s = window._d1Socket;
          if (!s) { resolve(null); return; }
          s.once('scoreboard:updated', (data) => resolve(data));
          setTimeout(() => resolve(null), 3000);
        });
      });
      const d2UpdatePromise = display2.evaluate(() => {
        return new Promise((resolve) => {
          const s = window._d2Socket;
          if (!s) { resolve(null); return; }
          s.once('scoreboard:updated', (data) => resolve(data));
          setTimeout(() => resolve(null), 3000);
        });
      });

      // Operator writes ring 1 state
      await operator.waitForTimeout(200);
      await api(operator, 'PUT',
        `/api/tournaments/${tournamentId}/scoreboard-state`,
        {
          state: {
            ring: 1,
            scoreboardType: 'kumite',
            matName: 'Mat 1',
            divisionName: `WS Ring 1 ${ts}`,
            redScore: 5,
            blueScore: 2,
          }
        }
      );

      const [d1Update, d2Update] = await Promise.all([d1UpdatePromise, d2UpdatePromise]);

      // Display 1 (ring 1) MUST receive the update
      expect(d1Update,
        'Display 1 (ring 1) must receive scoreboard:updated event (Fix #2 WS not applied)'
      ).not.toBeNull();
      if (d1Update) {
        expect(String(d1Update.ring)).toBe('1');
        expect(d1Update.state?.divisionName).toBe(`WS Ring 1 ${ts}`);
        console.log('  Fix #2 WS: display 1 (ring 1) received scoreboard:updated');
      }

      // Display 2 (ring 2) must NOT receive ring 1's update
      expect(d2Update,
        'Display 2 (ring 2) must NOT receive ring 1 update — ring isolation broken'
      ).toBeNull();
      console.log('  Fix #2 WS: display 2 (ring 2) correctly did not receive ring 1 update');

    } finally {
      await ctxDisplay1.close();
      await ctxDisplay2.close();
      await ctxOperator.close();
    }
  });

  // ───────────────────────────────────────────────────────────
  // FIX #3 TEST: WebSocket reconnection
  // MUST FAIL before socket.io is installed
  // ───────────────────────────────────────────────────────────

  test('Fix #3: WebSocket client reconnects and receives fresh state after disconnect', async ({ browser }) => {
    // Requires socket.io infrastructure.
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await login(page, director.email, director.password);

      // Check socket.io is available — MUST FAIL before fix
      const socketIoLoaded = await page.evaluate(async () => {
        const res = await fetch('/socket.io/socket.io.js');
        return res.ok;
      });
      expect(socketIoLoaded,
        'socket.io client script must be served at /socket.io/socket.io.js (Fix #3 not applied)'
      ).toBe(true);

      await page.addScriptTag({ url: '/socket.io/socket.io.js' });

      // Connect and track connect/disconnect events
      const result = await page.evaluate(async ([baseUrl]) => {
        return new Promise((resolve) => {
          if (typeof io === 'undefined') {
            resolve({ connected: false, reason: 'no socket.io' });
            return;
          }
          const s = io(baseUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 3,
            reconnectionDelay: 500,
          });
          let connectCount = 0;
          s.on('connect', () => {
            connectCount++;
            if (connectCount === 1) {
              // First connect — simulate disconnect by closing socket
              setTimeout(() => s.disconnect(), 200);
            } else if (connectCount === 2) {
              // Reconnected!
              resolve({ connected: true, reconnected: true, connectCount });
            }
          });
          s.on('disconnect', () => {
            // Trigger reconnect by calling connect()
            setTimeout(() => s.connect(), 300);
          });
          setTimeout(() => resolve({ connected: false, reason: 'timeout', connectCount }), 5000);
        });
      }, [BASE]);

      expect(result.connected, `WebSocket must connect and reconnect (got: ${JSON.stringify(result)})`).toBe(true);
      expect(result.reconnected, 'WebSocket must successfully reconnect after disconnect').toBe(true);
      console.log('  Fix #3: WebSocket reconnection verified');
    } finally {
      await context.close();
    }
  });

});
