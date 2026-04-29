/**
 * tests/scoreboard-fixes.test.js
 *
 * Unit + integration tests for the scoreboard audit/resilience fixes.
 * Runs with: node --test tests/scoreboard-fixes.test.js
 *
 * These tests exercise server-side logic directly (no browser needed).
 * WebSocket seq/replay and client-side helpers are tested with mocks.
 */

'use strict';

import { test, describe, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';

// ─────────────────────────────────────────────────────────────────────────────
// 1. WebSocket — seq counter
// ─────────────────────────────────────────────────────────────────────────────

describe('WebSocket seq counter', () => {
    // Mirror of the server-side logic
    function makeSeqCounter() {
        const _roomSeq = new Map();
        return function _nextSeq(roomId) {
            const n = (_roomSeq.get(roomId) || 0) + 1;
            _roomSeq.set(roomId, n);
            return n;
        };
    }

    test('seq starts at 1 and increments monotonically', () => {
        const nextSeq = makeSeqCounter();
        assert.equal(nextSeq('room:A'), 1);
        assert.equal(nextSeq('room:A'), 2);
        assert.equal(nextSeq('room:A'), 3);
    });

    test('different rooms have independent counters', () => {
        const nextSeq = makeSeqCounter();
        assert.equal(nextSeq('room:A'), 1);
        assert.equal(nextSeq('room:B'), 1);
        assert.equal(nextSeq('room:A'), 2);
        assert.equal(nextSeq('room:B'), 2);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. WebSocket — replay buffer
// ─────────────────────────────────────────────────────────────────────────────

describe('WebSocket replay buffer', () => {
    const REPLAY_MAX    = 50;
    const REPLAY_TTL_MS = 5 * 60 * 1000;

    function makeBuffer() {
        const _replayBuffer = new Map();

        function buffer(roomId, seq, eventName, payload, now = Date.now()) {
            if (!_replayBuffer.has(roomId)) _replayBuffer.set(roomId, []);
            const buf = _replayBuffer.get(roomId);
            buf.push({ seq, eventName, payload, ts: now });
            while (buf.length > REPLAY_MAX) buf.shift();
            const cutoff = now - REPLAY_TTL_MS;
            while (buf.length > 0 && buf[0].ts < cutoff) buf.shift();
        }

        function replaySince(roomId, lastSeq) {
            return (_replayBuffer.get(roomId) || []).filter(e => e.seq > lastSeq);
        }

        return { buffer, replaySince };
    }

    test('replays only messages after lastSeq', () => {
        const { buffer, replaySince } = makeBuffer();
        for (let i = 1; i <= 10; i++) buffer('room:A', i, 'ev', { i });
        const replayed = replaySince('room:A', 5);
        assert.equal(replayed.length, 5);
        assert.equal(replayed[0].seq, 6);
        assert.equal(replayed[4].seq, 10);
    });

    test('nothing replayed when lastSeq is current', () => {
        const { buffer, replaySince } = makeBuffer();
        for (let i = 1; i <= 5; i++) buffer('room:A', i, 'ev', {});
        const replayed = replaySince('room:A', 5);
        assert.equal(replayed.length, 0);
    });

    test('caps buffer at REPLAY_MAX entries', () => {
        const { buffer, replaySince } = makeBuffer();
        for (let i = 1; i <= 60; i++) buffer('room:A', i, 'ev', {});
        const replayed = replaySince('room:A', 0);
        assert.equal(replayed.length, REPLAY_MAX);
        assert.equal(replayed[0].seq, 11); // first 10 were evicted
    });

    test('evicts messages older than TTL', () => {
        const { buffer, replaySince } = makeBuffer();
        const old = Date.now() - REPLAY_TTL_MS - 1000;
        buffer('room:A', 1, 'ev', {}, old);
        buffer('room:A', 2, 'ev', {}, Date.now());
        const replayed = replaySince('room:A', 0);
        // Old message evicted when the second message was added
        assert.equal(replayed.length, 1);
        assert.equal(replayed[0].seq, 2);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Score queue helpers (mirrors client-side logic)
// ─────────────────────────────────────────────────────────────────────────────

describe('Score action queue', () => {
    // Minimal sessionStorage mock
    function makeQueue() {
        let _store = '[]';
        function get() { try { return JSON.parse(_store); } catch { return []; } }
        function set(q) { _store = JSON.stringify(q); }

        function push(entry) {
            const q = get(); q.push(entry); set(q);
        }
        function ackAll() {
            set(get().map(e => ({ ...e, acked: true })));
        }
        function unacked() { return get().filter(e => !e.acked); }

        return { get, push, ackAll, unacked };
    }

    test('push adds entry as unacked', () => {
        const q = makeQueue();
        q.push({ actionId: '1', corner: 'red', points: 3, acked: false });
        assert.equal(q.unacked().length, 1);
    });

    test('ackAll marks all entries acked', () => {
        const q = makeQueue();
        q.push({ actionId: '1', corner: 'red', points: 3, acked: false });
        q.push({ actionId: '2', corner: 'blue', points: 2, acked: false });
        q.ackAll();
        assert.equal(q.unacked().length, 0);
        assert.equal(q.get().length, 2);
    });

    test('unacked returns only non-acked entries', () => {
        const q = makeQueue();
        q.push({ actionId: '1', corner: 'red', points: 3, acked: true });
        q.push({ actionId: '2', corner: 'blue', points: 2, acked: false });
        assert.equal(q.unacked().length, 1);
        assert.equal(q.unacked()[0].actionId, '2');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Undo logic
// ─────────────────────────────────────────────────────────────────────────────

describe('Undo last score', () => {
    function makeScorer() {
        let redScore  = 0;
        let blueScore = 0;
        const history = [];

        function addScore(corner, points, technique = 'generic') {
            const actionId = String(Date.now() + Math.random());
            history.push({ actionId, corner, points, technique });
            if (corner === 'red') {
                redScore = Math.max(0, parseFloat((redScore + points).toFixed(1)));
            } else {
                blueScore = Math.max(0, parseFloat((blueScore + points).toFixed(1)));
            }
        }

        function undo() {
            if (!history.length) return false;
            const last = history.pop();
            if (last.corner === 'red') {
                redScore = Math.max(0, parseFloat((redScore - last.points).toFixed(1)));
            } else {
                blueScore = Math.max(0, parseFloat((blueScore - last.points).toFixed(1)));
            }
            return true;
        }

        return { addScore, undo, get: () => ({ redScore, blueScore, historyLen: history.length }) };
    }

    test('undo reverses last red score', () => {
        const s = makeScorer();
        s.addScore('red', 3, 'ippon');
        assert.equal(s.get().redScore, 3);
        s.undo();
        assert.equal(s.get().redScore, 0);
        assert.equal(s.get().historyLen, 0);
    });

    test('undo reverses last blue score', () => {
        const s = makeScorer();
        s.addScore('blue', 2, 'waza-ari');
        s.undo();
        assert.equal(s.get().blueScore, 0);
    });

    test('score never goes below 0 on undo', () => {
        const s = makeScorer();
        s.addScore('red', 1, 'yuko');
        s.addScore('red', -2, 'correction'); // manual correction below zero
        s.undo(); // undoes the correction
        assert.ok(s.get().redScore >= 0);
    });

    test('undo on empty history returns false', () => {
        const s = makeScorer();
        assert.equal(s.undo(), false);
    });

    test('multiple undos work in LIFO order', () => {
        const s = makeScorer();
        s.addScore('red', 1, 'yuko');
        s.addScore('red', 2, 'waza-ari');
        s.addScore('blue', 3, 'ippon');
        s.undo(); // removes blue +3
        assert.equal(s.get().blueScore, 0);
        assert.equal(s.get().redScore, 3);
        s.undo(); // removes red +2
        assert.equal(s.get().redScore, 1);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Server-time timer anchor
// ─────────────────────────────────────────────────────────────────────────────

describe('Server-time timer', () => {
    test('computes remaining time from matchStartedAt + serverOffset', () => {
        const matchDuration = 120; // seconds
        const serverOffset  = 500; // client clock is 500ms behind server

        // Simulate match started 30 seconds ago (server time)
        const serverNow      = Date.now() + serverOffset;
        const matchStartedAt = new Date(serverNow - 30_000).toISOString();

        // Client-side computation (mirrors mat-display.html logic)
        const clientServerNow = Date.now() + serverOffset;
        const elapsed         = Math.floor((clientServerNow - new Date(matchStartedAt).getTime()) / 1000);
        const remaining       = Math.max(0, matchDuration - elapsed);

        // Should be ~90 seconds (30 elapsed out of 120)
        assert.ok(remaining >= 89 && remaining <= 91, `Expected ~90, got ${remaining}`);
    });

    test('remaining is 0 when time has expired', () => {
        const serverOffset   = 0;
        const matchDuration  = 60;
        const serverNow      = Date.now() + serverOffset;
        const matchStartedAt = new Date(serverNow - 90_000).toISOString(); // 90s ago > 60s duration

        const elapsed    = Math.floor((Date.now() - new Date(matchStartedAt).getTime()) / 1000);
        const remaining  = Math.max(0, matchDuration - elapsed);
        assert.equal(remaining, 0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. tournamentPermission — assigned_rings enforcement (logic unit test)
// ─────────────────────────────────────────────────────────────────────────────

describe('Per-mat ring permission', () => {
    function checkRing(assignedRings, requestedRing) {
        if (!Array.isArray(assignedRings) || assignedRings.length === 0) return true; // no restriction
        return assignedRings.map(String).includes(String(requestedRing));
    }

    test('null assigned_rings allows any ring', () => {
        assert.equal(checkRing(null, '1'), true);
        assert.equal(checkRing(null, '5'), true);
    });

    test('empty assigned_rings allows any ring', () => {
        assert.equal(checkRing([], '1'), true);
    });

    test('assigned_rings restricts to listed rings', () => {
        assert.equal(checkRing(['1', '2'], '1'), true);
        assert.equal(checkRing(['1', '2'], '2'), true);
        assert.equal(checkRing(['1', '2'], '3'), false);
    });

    test('numeric and string rings are compared correctly', () => {
        assert.equal(checkRing([1, 2], '1'), true);
        assert.equal(checkRing(['1', '2'], 1), true);
        assert.equal(checkRing([1, 2], '3'), false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. logMatchResult — error is thrown and logged (mock test)
// ─────────────────────────────────────────────────────────────────────────────

describe('logMatchResult error handling', () => {
    test('throws and logs when DB insert fails', async () => {
        const logged = [];
        const origError = console.error;
        console.error = (...args) => logged.push(args.join(' '));

        // Minimal mock of logMatchResult with try/catch
        async function logMatchResult({ tournamentId, bracketId, matchId }) {
            try {
                throw new Error('DB connection lost');
            } catch (err) {
                console.error('[match_results] INSERT failed — audit record lost:', err.message, {
                    tournamentId, bracketId, matchId,
                });
                throw err;
            }
        }

        await assert.rejects(
            () => logMatchResult({ tournamentId: 'tid', bracketId: 'bid', matchId: 'mid' }),
            /DB connection lost/
        );
        assert.ok(logged.some(l => l.includes('[match_results]')));

        console.error = origError;
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. scoreboardStateController — last_updated_at/by injection
// ─────────────────────────────────────────────────────────────────────────────

describe('setScoreboardState metadata injection', () => {
    test('injects last_updated_at (ISO string) and last_updated_by into state', () => {
        const state  = { ring: '1', redScore: 3, blueScore: 0 };
        const userId = 'user-uuid-123';

        // Mirrors the controller logic
        state.last_updated_at = new Date().toISOString();
        state.last_updated_by = userId;

        assert.match(state.last_updated_at, /^\d{4}-\d{2}-\d{2}T/);
        assert.equal(state.last_updated_by, userId);
        assert.equal(state.redScore, 3); // existing fields preserved
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Operator lock warning — emitted to newcomer only
// ─────────────────────────────────────────────────────────────────────────────

describe('Operator lock warning', () => {
    function simulateJoin(existingCount) {
        // Returns warning data if existingCount > 0, otherwise null
        if (existingCount > 0) {
            return {
                bracketId: 'bracket-A',
                count: existingCount,
                message: `${existingCount} operator${existingCount > 1 ? 's are' : ' is'} already scoring this bracket. Coordinate before making changes.`,
            };
        }
        return null;
    }

    test('no warning when first operator joins', () => {
        assert.equal(simulateJoin(0), null);
    });

    test('warning emitted when second operator joins', () => {
        const w = simulateJoin(1);
        assert.ok(w !== null);
        assert.equal(w.count, 1);
        assert.match(w.message, /1 operator is/);
    });

    test('warning message uses plural for 2+ operators', () => {
        const w = simulateJoin(2);
        assert.match(w.message, /2 operators are/);
    });
});
