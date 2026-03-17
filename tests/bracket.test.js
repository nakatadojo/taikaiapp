/**
 * bracket.test.js
 *
 * Unit tests for single-elimination bracket generation logic.
 * Runs with: npm run test:bracket
 * Requires Node 18+ (uses node:test and node:assert).
 */

'use strict';

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Pure logic functions (mirrors client/app.js implementations)
// ---------------------------------------------------------------------------

function nextPowerOf2(n) {
    if (n <= 1) return 1;
    let p = 1;
    while (p < n) p <<= 1;
    return p;
}

function calcByes(n) {
    if (n <= 0) return 0;
    return nextPowerOf2(n) - n;
}

function generateTournamentSeedOrder(size) {
    if (size === 1) return [0];
    if (size === 2) return [0, 1];
    const half = generateTournamentSeedOrder(size / 2);
    const order = [];
    for (let i = 0; i < half.length; i++) {
        order.push(half[i]);
        order.push(size - 1 - half[i]);
    }
    return order;
}

function buildBracketSlots(seededCompetitors) {
    const n = seededCompetitors.length;
    if (n <= 0) return [];
    if (n === 1) return [seededCompetitors[0], null];

    const rounds = Math.ceil(Math.log2(n));
    const totalSlots = Math.pow(2, rounds);
    const byeCount = totalSlots - n;

    const slots = new Array(totalSlots).fill(null);
    const seedOrder = generateTournamentSeedOrder(totalSlots);

    if (byeCount === 0) {
        for (let i = 0; i < n; i++) {
            slots[seedOrder[i]] = seededCompetitors[i];
        }
        return slots;
    }

    for (let i = 0; i < byeCount; i++) {
        slots[seedOrder[i]] = seededCompetitors[i];
    }

    const byeSlotSet = new Set(seedOrder.slice(0, byeCount));
    const byePartnerSet = new Set();
    for (const p of byeSlotSet) {
        byePartnerSet.add(p % 2 === 0 ? p + 1 : p - 1);
    }

    const topFightPairs    = [];
    const bottomFightPairs = [];
    for (let i = 0; i < totalSlots; i += 2) {
        const p0 = i, p1 = i + 1;
        if (!byeSlotSet.has(p0) && !byePartnerSet.has(p0) &&
            !byeSlotSet.has(p1) && !byePartnerSet.has(p1)) {
            if (p0 < totalSlots / 2) {
                topFightPairs.push([p0, p1]);
            } else {
                bottomFightPairs.push([p0, p1]);
            }
        }
    }
    const orderedFightPairs = [...bottomFightPairs, ...topFightPairs];

    const fighters = seededCompetitors.slice(byeCount);
    const half = fighters.length / 2;
    for (let i = 0; i < half; i++) {
        const [p0, p1] = orderedFightPairs[i];
        slots[p0] = fighters[i];
        slots[p1] = fighters[fighters.length - 1 - i];
    }

    return slots;
}

// Create n fake competitors labelled seed 1..n (seed 1 = index 0 = highest seed).
function makeCompetitors(n) {
    return Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Seed${i + 1}`, seed: i + 1 }));
}

function generateSingleEliminationBracket(competitors) {
    const n = competitors.length;
    if (n <= 1) {
        return { rounds: 0, matches: [] };
    }

    const rounds = Math.ceil(Math.log2(n));
    const totalSlots = Math.pow(2, rounds);
    const slots = buildBracketSlots(competitors);

    const matches = [];
    let matchId = 1;
    const byeAdvances = [];

    for (let i = 0; i < totalSlots / 2; i++) {
        const comp1 = slots[i * 2]     || null;
        const comp2 = slots[i * 2 + 1] || null;
        let status, winner;
        if (comp1 && comp2) {
            status = 'pending'; winner = null;
        } else if (comp1 || comp2) {
            status = 'bye'; winner = comp1 || comp2;
            byeAdvances.push({ round: 2, position: Math.floor(i / 2), competitor: winner, fromEvenPos: i % 2 === 0 });
        } else {
            status = 'empty'; winner = null;
        }
        matches.push({ id: matchId++, round: 1, position: i, redCorner: comp1, blueCorner: comp2, winner, status });
    }

    for (let round = 2; round <= rounds; round++) {
        const matchesInRound = Math.pow(2, rounds - round);
        for (let i = 0; i < matchesInRound; i++) {
            const byeRed  = byeAdvances.find(b => b.round === round && b.position === i && b.fromEvenPos);
            const byeBlue = byeAdvances.find(b => b.round === round && b.position === i && !b.fromEvenPos);
            let redCorner  = byeRed  ? byeRed.competitor  : null;
            let blueCorner = byeBlue ? byeBlue.competitor : null;
            let status = 'pending', winner = null;

            const redFeeder  = matches.find(m => m.round === round - 1 && m.position === i * 2);
            const blueFeeder = matches.find(m => m.round === round - 1 && m.position === i * 2 + 1);
            const redFeederEmpty  = !redFeeder  || redFeeder.status  === 'empty' || redFeeder.status  === 'bye';
            const blueFeederEmpty = !blueFeeder || blueFeeder.status === 'empty' || blueFeeder.status === 'bye';

            if (redCorner && !blueCorner && blueFeederEmpty) {
                status = 'bye'; winner = redCorner;
                if (round < rounds) byeAdvances.push({ round: round + 1, position: Math.floor(i / 2), competitor: winner, fromEvenPos: i % 2 === 0 });
            } else if (!redCorner && blueCorner && redFeederEmpty) {
                status = 'bye'; winner = blueCorner;
                if (round < rounds) byeAdvances.push({ round: round + 1, position: Math.floor(i / 2), competitor: winner, fromEvenPos: i % 2 === 0 });
            } else if (!redCorner && !blueCorner && redFeederEmpty && blueFeederEmpty) {
                status = 'empty';
            }

            matches.push({ id: matchId++, round, position: i, redCorner, blueCorner, winner, status });
        }
    }

    return { rounds, matches };
}

// ---------------------------------------------------------------------------
// Reference table from spec (competitors 1..32 -> expected byes)
// ---------------------------------------------------------------------------
const EXPECTED_BYES = {
     1: 0,  2: 0,  3: 1,  4: 0,  5: 3,  6: 2,  7: 1,  8: 0,
     9: 7, 10: 6, 11: 5, 12: 4, 13: 3, 14: 2, 15: 1, 16: 0,
    17:15, 18:14, 19:13, 20:12, 21:11, 22:10, 23: 9, 24: 8,
    25: 7, 26: 6, 27: 5, 28: 4, 29: 3, 30: 2, 31: 1, 32: 0
};

// ---------------------------------------------------------------------------
// Validation test 1: Bye count is correct for every competitor count 1..64
// ---------------------------------------------------------------------------

describe('Test 1: bye count formula 1..64', () => {
    for (let n = 1; n <= 64; n++) {
        test(`n=${n}`, () => {
            const pow = nextPowerOf2(n);
            const byes = pow - n;
            // Reference table covers 1..32; for 33..64 verify formula properties
            if (EXPECTED_BYES[n] !== undefined) {
                assert.equal(byes, EXPECTED_BYES[n], `n=${n}: expected ${EXPECTED_BYES[n]} byes, got ${byes}`);
            }
            // Formula invariants for all n
            assert.ok(byes >= 0, `byes must be non-negative for n=${n}`);
            assert.ok((n + byes) >= n, `n + byes >= n`);
            // n + byes must be a power of 2
            const total = n + byes;
            assert.equal(total & (total - 1), 0, `n+byes must be power of 2 for n=${n}`);
        });
    }
});

// ---------------------------------------------------------------------------
// Validation test 2: Round 1 match count = (competitors - byes) / 2
// ---------------------------------------------------------------------------

describe('Test 2: round-1 match count', () => {
    for (let n = 2; n <= 32; n++) {
        test(`n=${n}`, () => {
            const byes = calcByes(n);
            const expectedR1Fights = (n - byes) / 2;
            const { matches } = generateSingleEliminationBracket(makeCompetitors(n));
            const r1Fights = matches.filter(m => m.round === 1 && m.status === 'pending').length;
            assert.equal(r1Fights, expectedR1Fights,
                `n=${n}: expected ${expectedR1Fights} R1 fights, got ${r1Fights}`);
        });
    }

    test('n=1 has 0 matches', () => {
        const { matches } = generateSingleEliminationBracket(makeCompetitors(1));
        assert.equal(matches.length, 0);
    });
});

// ---------------------------------------------------------------------------
// Validation test 3: After round 1, remaining competitors = next power of 2
// ---------------------------------------------------------------------------

describe('Test 3: after round 1, remaining count = next power of 2', () => {
    for (let n = 2; n <= 32; n++) {
        test(`n=${n}`, () => {
            const pow = nextPowerOf2(n);
            // Each R1 match (fight or bye) produces exactly 1 winner.
            // Total R1 matches = pow / 2, so remaining after R1 = pow / 2.
            // pow / 2 is itself a power of 2 for all n >= 2.
            const expected = pow / 2;
            const { matches } = generateSingleEliminationBracket(makeCompetitors(n));
            const r1Fights = matches.filter(m => m.round === 1 && m.status === 'pending').length;
            const r1Byes   = matches.filter(m => m.round === 1 && m.status === 'bye').length;
            const remaining = r1Fights + r1Byes;
            assert.equal(remaining, expected,
                `n=${n}: expected ${expected} remaining after R1, got ${remaining}`);
            // Confirm remaining is a power of 2
            assert.equal(remaining & (remaining - 1), 0, `remaining ${remaining} must be a power of 2`);
        });
    }
});

// ---------------------------------------------------------------------------
// Validation test 4: Total matches = competitors - 1
// ---------------------------------------------------------------------------

describe('Test 4: total competitive matches = competitors - 1', () => {
    for (let n = 2; n <= 32; n++) {
        test(`n=${n}`, () => {
            const { matches } = generateSingleEliminationBracket(makeCompetitors(n));
            // Bye matches are automatic advances, not competitive.
            // Only pending (real fight) matches count toward n - 1.
            const competitive = matches.filter(m => m.status === 'pending').length;
            assert.equal(competitive, n - 1,
                `n=${n}: expected ${n - 1} competitive matches, got ${competitive}`);
        });
    }

    test('n=1 has 0 matches', () => {
        const { matches } = generateSingleEliminationBracket(makeCompetitors(1));
        assert.equal(matches.length, 0);
    });
});

// ---------------------------------------------------------------------------
// Validation test 5: Byes distributed evenly across bracket halves (diff <= 1)
// ---------------------------------------------------------------------------

describe('Test 5: byes distributed evenly across halves', () => {
    for (let n = 2; n <= 32; n++) {
        const byes = calcByes(n);
        if (byes === 0) continue; // nothing to distribute

        test(`n=${n} (${byes} byes)`, () => {
            const { matches } = generateSingleEliminationBracket(makeCompetitors(n));
            const pow = nextPowerOf2(n);
            const halfMatchCount = pow / 4; // R1 matches per half
            const topByes    = matches.filter(m => m.round === 1 && m.status === 'bye' && m.position < halfMatchCount).length;
            const bottomByes = matches.filter(m => m.round === 1 && m.status === 'bye' && m.position >= halfMatchCount).length;
            assert.equal(topByes + bottomByes, byes, `Total byes in R1 must equal ${byes}`);
            assert.ok(Math.abs(topByes - bottomByes) <= 1,
                `n=${n}: top=${topByes} bottom=${bottomByes} byes, diff must be <= 1`);
        });
    }
});

// ---------------------------------------------------------------------------
// Validation test 6: Byes go to top seeds first (no lower seed has a bye while a higher seed fights)
// ---------------------------------------------------------------------------

describe('Test 6: byes assigned to top seeds first', () => {
    for (let n = 2; n <= 32; n++) {
        const byes = calcByes(n);
        if (byes === 0) continue;

        test(`n=${n} (${byes} byes)`, () => {
            const competitors = makeCompetitors(n); // seed = id = 1..n
            const { matches } = generateSingleEliminationBracket(competitors);
            const r1 = matches.filter(m => m.round === 1);

            const byeSeeds   = new Set();
            const fightSeeds = new Set();

            for (const m of r1) {
                if (m.status === 'bye') {
                    const holder = m.redCorner || m.blueCorner;
                    if (holder) byeSeeds.add(holder.seed);
                } else if (m.status === 'pending') {
                    if (m.redCorner)  fightSeeds.add(m.redCorner.seed);
                    if (m.blueCorner) fightSeeds.add(m.blueCorner.seed);
                }
            }

            // Every bye seed must be numerically smaller (better) than every fight seed
            for (const bs of byeSeeds) {
                for (const fs of fightSeeds) {
                    assert.ok(bs < fs,
                        `n=${n}: bye seed ${bs} is not better than fight seed ${fs}`);
                }
            }

            // Exactly byeCount seeds have byes
            assert.equal(byeSeeds.size, byes, `n=${n}: expected ${byes} bye holders, got ${byeSeeds.size}`);
        });
    }
});

// ---------------------------------------------------------------------------
// Validation test 7: Top 2 seeds are on opposite halves of the bracket
// ---------------------------------------------------------------------------

describe('Test 7: seed 1 and seed 2 on opposite bracket halves', () => {
    for (let n = 2; n <= 32; n++) {
        test(`n=${n}`, () => {
            const competitors = makeCompetitors(n);
            const pow = nextPowerOf2(n);
            const totalR1Matches = pow / 2;
            const halfR1Matches = totalR1Matches / 2;

            const slots = buildBracketSlots(competitors);
            const seed1Pos = slots.indexOf(competitors[0]); // seed 1
            const seed2Pos = slots.indexOf(competitors[1]); // seed 2

            const seed1Half = seed1Pos < pow / 2 ? 'top' : 'bottom';
            const seed2Half = seed2Pos < pow / 2 ? 'top' : 'bottom';

            assert.notEqual(seed1Half, seed2Half,
                `n=${n}: seed1 at slot ${seed1Pos} (${seed1Half}), seed2 at slot ${seed2Pos} (${seed2Half}) - must be opposite halves`);
        });
    }
});

// ---------------------------------------------------------------------------
// Validation test 8: Edge cases
// ---------------------------------------------------------------------------

describe('Test 8: edge cases', () => {
    test('n=1: champion by default, 0 matches', () => {
        const { rounds, matches } = generateSingleEliminationBracket(makeCompetitors(1));
        assert.equal(rounds, 0);
        assert.equal(matches.length, 0);
    });

    test('n=2: 1 match, 0 byes', () => {
        const { matches } = generateSingleEliminationBracket(makeCompetitors(2));
        const r1 = matches.filter(m => m.round === 1);
        assert.equal(r1.length, 1);
        assert.equal(r1.filter(m => m.status === 'bye').length, 0);
        assert.equal(r1.filter(m => m.status === 'pending').length, 1);
    });

    test('n=4: 0 byes, 3 total matches', () => {
        const { matches } = generateSingleEliminationBracket(makeCompetitors(4));
        assert.equal(calcByes(4), 0);
        assert.equal(matches.filter(m => m.status !== 'empty').length, 3);
        assert.equal(matches.filter(m => m.round === 1 && m.status === 'bye').length, 0);
    });

    test('n=8: 0 byes, 7 total matches', () => {
        const { matches } = generateSingleEliminationBracket(makeCompetitors(8));
        assert.equal(calcByes(8), 0);
        assert.equal(matches.filter(m => m.status !== 'empty').length, 7);
    });

    test('n=16: 0 byes, 15 total matches', () => {
        const { matches } = generateSingleEliminationBracket(makeCompetitors(16));
        assert.equal(calcByes(16), 0);
        assert.equal(matches.filter(m => m.status !== 'empty').length, 15);
    });

    test('n=32: 0 byes, 31 total matches', () => {
        const { matches } = generateSingleEliminationBracket(makeCompetitors(32));
        assert.equal(calcByes(32), 0);
        assert.equal(matches.filter(m => m.status !== 'empty').length, 31);
    });

    test('n=17: maximum byes (15) for next power of 2 = 32', () => {
        assert.equal(calcByes(17), 15);
        const { matches } = generateSingleEliminationBracket(makeCompetitors(17));
        const r1Byes = matches.filter(m => m.round === 1 && m.status === 'bye').length;
        assert.equal(r1Byes, 15);
        const r1Fights = matches.filter(m => m.round === 1 && m.status === 'pending').length;
        assert.equal(r1Fights, 1); // (17 - 15) / 2 = 1
    });

    test('n=22 canonical example: 10 byes, 6 R1 fights, 16 after R1, 21 competitive matches', () => {
        assert.equal(calcByes(22), 10);
        const { matches } = generateSingleEliminationBracket(makeCompetitors(22));
        const r1 = matches.filter(m => m.round === 1);
        const r1Byes   = r1.filter(m => m.status === 'bye').length;
        const r1Fights = r1.filter(m => m.status === 'pending').length;
        assert.equal(r1Byes,   10, '10 byes in R1');
        assert.equal(r1Fights,  6, '6 fights in R1');
        // remaining after R1 = 6 fight winners + 10 bye holders = 16 (a power of 2)
        assert.equal(r1Fights + r1Byes, 16);
        // total competitive (non-bye) matches = 22 - 1 = 21
        assert.equal(matches.filter(m => m.status === 'pending').length, 21);
    });

    test('n=9 just above power of 2: 7 byes', () => {
        assert.equal(calcByes(9), 7);
        const { matches } = generateSingleEliminationBracket(makeCompetitors(9));
        assert.equal(matches.filter(m => m.round === 1 && m.status === 'bye').length, 7);
        assert.equal(matches.filter(m => m.round === 1 && m.status === 'pending').length, 1);
    });
});
