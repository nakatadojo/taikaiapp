'use strict';
/**
 * bracketGenerator.js — Server-side bracket generation
 *
 * Ported from client/app.js so the server can regenerate brackets when
 * competitors are added to divisions (e.g. on approval / auto-assign).
 * All functions are pure — no DOM, no localStorage.
 */

let _lastGeneratedId = 0;
function generateUniqueId() {
  let id = Date.now();
  if (id <= _lastGeneratedId) id = _lastGeneratedId + 1;
  _lastGeneratedId = id;
  return id;
}

// ── Seeding ───────────────────────────────────────────────────────────────────

function seedCompetitors(competitors, method) {
  const seeded = [...competitors];
  switch (method) {
    case 'random':
      for (let i = seeded.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [seeded[i], seeded[j]] = [seeded[j], seeded[i]];
      }
      break;
    case 'rank': {
      const rankOrder = ['3rd Dan','2nd Dan','1st Dan','Brown','Purple','Blue','Green','Orange','Yellow','White'];
      seeded.sort((a, b) => {
        const ai = rankOrder.indexOf(a.rank); const bi = rankOrder.indexOf(b.rank);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
      break;
    }
    case 'age':      seeded.sort((a, b) => a.age - b.age); break;
    case 'country':  seeded.sort((a, b) => (a.country||'').localeCompare(b.country||'')); break;
    case 'club':     seeded.sort((a, b) => (a.club||'').localeCompare(b.club||'')); break;
    // 'ordered' and 'previous-results' fall through to no-op / already ordered
    default: break;
  }
  return seeded;
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

  const rounds    = Math.ceil(Math.log2(n));
  const totalSlots = Math.pow(2, rounds);
  const byeCount  = totalSlots - n;
  const slots     = new Array(totalSlots).fill(null);
  const seedOrder = generateTournamentSeedOrder(totalSlots);

  if (byeCount === 0) {
    for (let i = 0; i < n; i++) slots[seedOrder[i]] = seededCompetitors[i];
    return slots;
  }

  for (let i = 0; i < byeCount; i++) slots[seedOrder[i]] = seededCompetitors[i];

  const byeSlotSet    = new Set(seedOrder.slice(0, byeCount));
  const byePartnerSet = new Set();
  for (const p of byeSlotSet) byePartnerSet.add(p % 2 === 0 ? p + 1 : p - 1);

  const topFightPairs = [], bottomFightPairs = [];
  for (let i = 0; i < totalSlots; i += 2) {
    const p0 = i, p1 = i + 1;
    if (!byeSlotSet.has(p0) && !byePartnerSet.has(p0) &&
        !byeSlotSet.has(p1) && !byePartnerSet.has(p1)) {
      (p0 < totalSlots / 2 ? topFightPairs : bottomFightPairs).push([p0, p1]);
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

// ── Bracket type generators ───────────────────────────────────────────────────

function generateSingleEliminationBracket(competitors, divisionName, eventId) {
  const n = competitors.length;
  if (n <= 1) {
    return { id: generateUniqueId(), type: 'single-elimination', division: divisionName,
      divisionName, eventId, rounds: 0, competitors, createdAt: new Date().toISOString(), matches: [] };
  }

  const rounds      = Math.ceil(Math.log2(n));
  const totalSlots  = Math.pow(2, rounds);
  const bracket     = { id: generateUniqueId(), type: 'single-elimination', division: divisionName,
    divisionName, eventId, rounds, competitors, createdAt: new Date().toISOString(), matches: [] };

  const slots = buildBracketSlots(competitors);
  let matchId = 1;
  const byeAdvances = [];

  for (let i = 0; i < totalSlots / 2; i++) {
    const comp1 = slots[i * 2] || null;
    const comp2 = slots[i * 2 + 1] || null;
    let status, winner;
    if (comp1 && comp2)       { status = 'pending'; winner = null; }
    else if (comp1 || comp2)  {
      status = 'bye'; winner = comp1 || comp2;
      byeAdvances.push({ round: 2, position: Math.floor(i / 2), competitor: winner, fromEvenPos: i % 2 === 0 });
    } else                    { status = 'empty'; winner = null; }

    bracket.matches.push({ id: matchId++, round: 1, position: i,
      redCorner: comp1, blueCorner: comp2, winner,
      score1: comp1 && !comp2 ? 'BYE' : null,
      score2: comp2 && !comp1 ? 'BYE' : null, status });
  }

  for (let round = 2; round <= rounds; round++) {
    const matchesInRound = Math.pow(2, rounds - round);
    for (let i = 0; i < matchesInRound; i++) {
      const byeRed  = byeAdvances.find(b => b.round === round && b.position === i && b.fromEvenPos);
      const byeBlue = byeAdvances.find(b => b.round === round && b.position === i && !b.fromEvenPos);
      let redCorner = byeRed ? byeRed.competitor : null;
      let blueCorner = byeBlue ? byeBlue.competitor : null;
      let status = 'pending', winner = null, score1 = null, score2 = null;

      const redFeeder  = bracket.matches.find(m => m.round === round - 1 && m.position === i * 2);
      const blueFeeder = bracket.matches.find(m => m.round === round - 1 && m.position === i * 2 + 1);
      const redEmpty   = !redFeeder  || redFeeder.status  === 'empty' || redFeeder.status  === 'bye';
      const blueEmpty  = !blueFeeder || blueFeeder.status === 'empty' || blueFeeder.status === 'bye';

      if      (redCorner && !blueCorner && blueEmpty) {
        status = 'bye'; winner = redCorner; score1 = 'BYE';
        if (round < rounds) byeAdvances.push({ round: round + 1, position: Math.floor(i / 2), competitor: winner, fromEvenPos: i % 2 === 0 });
      } else if (!redCorner && blueCorner && redEmpty) {
        status = 'bye'; winner = blueCorner; score2 = 'BYE';
        if (round < rounds) byeAdvances.push({ round: round + 1, position: Math.floor(i / 2), competitor: winner, fromEvenPos: i % 2 === 0 });
      } else if (!redCorner && !blueCorner && redEmpty && blueEmpty) {
        status = 'empty';
      }

      bracket.matches.push({ id: matchId++, round, position: i,
        redCorner, blueCorner, winner, score1, score2, status });
    }
  }
  return bracket;
}

function _cascadeLosersByes(bracket) {
  const losers = bracket.losers || [];
  const maxLR  = losers.length > 0 ? Math.max(...losers.map(m => m.round)) : 0;
  for (let lr = 1; lr <= maxLR; lr++) {
    const isDropDown = (lr % 2 === 0);
    losers.filter(m => m.round === lr && m.status === 'empty').forEach(lMatch => {
      const nextLR  = lr + 1;
      if (nextLR > maxLR) return;
      const nextPos = isDropDown ? Math.floor(lMatch.position / 2) : lMatch.position;
      const next    = losers.find(m => m.round === nextLR && m.position === nextPos);
      if (next && next.status === 'pending') next.status = 'bye-pending';
    });
  }
}

function generateDoubleEliminationBracket(competitors, divisionName, eventId) {
  const winnersRounds = Math.ceil(Math.log2(competitors.length));
  const bracket = { id: generateUniqueId(), type: 'double-elimination', division: divisionName,
    divisionName, eventId, competitors, rounds: winnersRounds,
    createdAt: new Date().toISOString(), winners: [], losers: [], finals: null, reset: null };

  const wb = generateSingleEliminationBracket(competitors, divisionName, eventId);
  bracket.winners = wb.matches;

  let losersMatchId = 10000;
  const losersRoundCount = 2 * (winnersRounds - 1);
  if (losersRoundCount > 0) {
    for (let lr = 1; lr <= losersRoundCount; lr++) {
      const pairIndex       = Math.ceil(lr / 2);
      const matchesInRound  = Math.max(1, Math.pow(2, winnersRounds - 1 - pairIndex));
      const isDropDown      = (lr % 2 === 0);
      for (let pos = 0; pos < matchesInRound; pos++) {
        bracket.losers.push({ id: losersMatchId++, round: lr, position: pos,
          roundType: isDropDown ? 'drop-down' : 'reduction',
          redCorner: null, blueCorner: null, winner: null,
          score1: null, score2: null, status: 'pending' });
      }
    }
  }

  bracket.finals = { id: losersMatchId++, round: 'finals', position: 0,
    redCorner: null, blueCorner: null, winner: null, score1: null, score2: null, status: 'pending' };

  const wr1Matches = bracket.winners.filter(m => m.round === 1);
  const lr1Matches = bracket.losers.filter(m => m.round === 1);
  lr1Matches.forEach((lMatch, pos) => {
    const wr1Even   = wr1Matches.find(m => m.position === pos * 2);
    const wr1Odd    = wr1Matches.find(m => m.position === pos * 2 + 1);
    const evenIsBye = !wr1Even || wr1Even.status === 'bye' || wr1Even.status === 'empty';
    const oddIsBye  = !wr1Odd  || wr1Odd.status  === 'bye' || wr1Odd.status  === 'empty';
    if (evenIsBye && oddIsBye) lMatch.status = 'empty';
    else if (evenIsBye || oddIsBye) lMatch.status = 'bye-pending';
  });

  _cascadeLosersByes(bracket);
  return bracket;
}

function generateRepechageBracket(competitors, divisionName, eventId) {
  const main = generateSingleEliminationBracket(competitors, divisionName, eventId);
  return { id: generateUniqueId(), type: 'repechage', division: divisionName,
    divisionName, eventId, rounds: main.rounds, competitors,
    createdAt: new Date().toISOString(), matches: main.matches,
    repechageA: [], repechageB: [], repechageGenerated: false };
}

function generateRoundRobinBracket(competitors, divisionName, eventId) {
  const bracket = { id: generateUniqueId(), type: 'round-robin', division: divisionName,
    divisionName, eventId, competitors, createdAt: new Date().toISOString(), matches: [],
    standings: competitors.map(c => ({ competitor: c, wins: 0, losses: 0, points: 0 })) };
  let matchId = 1;
  for (let i = 0; i < competitors.length; i++)
    for (let j = i + 1; j < competitors.length; j++)
      bracket.matches.push({ id: matchId++, redCorner: competitors[i], blueCorner: competitors[j],
        winner: null, score1: null, score2: null, status: 'pending' });
  return bracket;
}

function generatePoolPlayBracket(competitors, divisionName, eventId) {
  const bracket = { id: generateUniqueId(), type: 'pool-play', division: divisionName,
    divisionName, eventId, competitors, createdAt: new Date().toISOString(), pools: [], finals: [] };
  const n = competitors.length;
  let numPools = 1;
  if (n > 12) numPools = 4; else if (n > 8) numPools = 3; else if (n > 5) numPools = 2;

  const pools = Array.from({ length: numPools }, () => []);
  let pi = 0, dir = 1;
  competitors.forEach(c => {
    pools[pi].push(c); pi += dir;
    if (pi >= numPools || pi < 0) { dir *= -1; pi += dir; }
  });

  pools.forEach((pc, idx) => {
    const matches = []; let mid = 1;
    for (let i = 0; i < pc.length; i++)
      for (let j = i + 1; j < pc.length; j++)
        matches.push({ id: `pool${idx+1}_match${mid++}`, redCorner: pc[i], blueCorner: pc[j],
          winner: null, score1: null, score2: null, status: 'pending' });
    bracket.pools.push({ poolNumber: idx+1, poolName: String.fromCharCode(65+idx),
      competitors: pc, matches,
      standings: pc.map(c => ({ competitor: c, wins: 0, losses: 0, points: 0, rank: null })) });
  });
  return bracket;
}

function generateRankingListBracket(competitors, divisionName, eventId) {
  return { id: generateUniqueId(), type: 'ranking-list', division: divisionName,
    divisionName, eventId, competitors, createdAt: new Date().toISOString(),
    entries: competitors.map((c, i) => ({ competitor: c, performanceOrder: i+1,
      score: null, rank: null, status: 'pending' })),
    matches: [], status: 'pending' };
}

function generateKataFlagsBracket(competitors, divisionName, eventId) {
  return { id: generateUniqueId(), type: 'kata-flags', division: divisionName,
    eventId, createdAt: new Date().toISOString(), numJudges: 5,
    rounds: [{ roundNumber: 1, roundName: 'Preliminary Round',
      performances: competitors.map((c, i) => ({ competitor: c, order: i+1, flags: 0, advanced: false })) }] };
}

function generateAAUKataFlagsBracket(competitors, divisionName, eventId) {
  const bracket = { id: generateUniqueId(), type: 'aau-kata-flags', division: divisionName,
    divisionName, eventId, createdAt: new Date().toISOString(), numJudges: 5,
    round: 1, status: 'active', matchCounter: 0,
    akaQueue: [], shiroQueue: [], currentMatch: null,
    round1Finalist: null, goldMedalist: null,
    medals: { gold: null, silver: null, bronze: null }, matches: [] };

  if (competitors.length === 0) { bracket.status = 'complete'; return bracket; }
  if (competitors.length === 1) {
    bracket.status = 'complete'; bracket.goldMedalist = competitors[0];
    bracket.medals.gold = competitors[0]; return bracket;
  }

  bracket.akaQueue = [...competitors];
  const aka = bracket.akaQueue.shift(), shiro = bracket.akaQueue.shift();
  bracket.matchCounter = 1;
  bracket.currentMatch = { id: generateUniqueId(), matchNumber: 1, round: 1, aka, shiro, hanteiCalled: false };
  return bracket;
}

function generateKataPointsBracket(competitors, divisionName, eventId) {
  return { id: generateUniqueId(), type: 'kata-points', division: divisionName,
    eventId, createdAt: new Date().toISOString(), numJudges: 5,
    scoringRange: { min: 0, max: 10 },
    rounds: [{ roundNumber: 1, roundName: 'Preliminary Round',
      performances: competitors.map((c, i) => ({ competitor: c, order: i+1,
        scores: [], totalScore: 0, averageScore: 0, rank: null, advanced: false })) }] };
}

// ── Main entry points ─────────────────────────────────────────────────────────

function bracketHasScoredMatches(bracket) {
  const flat = [
    ...(bracket.matches    || []),
    ...(bracket.winners    || []),
    ...(bracket.losers     || []),
    ...(bracket.repechageA || []),
    ...(bracket.repechageB || []),
  ];
  if (bracket.finals) flat.push(bracket.finals);
  if (bracket.reset)  flat.push(bracket.reset);
  if (flat.some(m => m && (m.status === 'completed' || m.status === 'in-progress'))) return true;
  for (const pool of (bracket.pools || []))
    if ((pool.matches || []).some(m => m.status === 'completed')) return true;
  if ((bracket.entries || []).some(e => e.status === 'scored')) return true;
  if (Array.isArray(bracket.rounds))
    for (const r of bracket.rounds)
      if ((r.performances || []).some(p => p.completed)) return true;
  return false;
}

/**
 * Regenerate a bracket from its existing settings with a fresh competitor list.
 * Carries over scoreboardConfig, matchDuration, seedingMethod, matAssignment.
 */
function regenerateBracketFromSettings(existing, freshCompetitors) {
  const type    = existing.type;
  const name    = existing.divisionName || existing.division;
  const eventId = existing.eventId;
  const seeded  = seedCompetitors([...freshCompetitors], existing.seedingMethod || 'random');

  let newBracket = null;
  if      (type === 'single-elimination') newBracket = generateSingleEliminationBracket(seeded, name, eventId);
  else if (type === 'double-elimination') newBracket = generateDoubleEliminationBracket(seeded, name, eventId);
  else if (type === 'repechage')          newBracket = generateRepechageBracket(seeded, name, eventId);
  else if (type === 'round-robin')        newBracket = generateRoundRobinBracket(seeded, name, eventId);
  else if (type === 'pool-play')          newBracket = generatePoolPlayBracket(seeded, name, eventId);
  else if (type === 'ranking-list')       newBracket = generateRankingListBracket(seeded, name, eventId);
  else if (type === 'kata-flags')         newBracket = generateKataFlagsBracket(seeded, name, eventId);
  else if (type === 'aau-kata-flags')     newBracket = generateAAUKataFlagsBracket(seeded, name, eventId);
  else if (type === 'kata-points')        newBracket = generateKataPointsBracket(seeded, name, eventId);
  if (!newBracket) return null;

  // Preserve original ID and carry over settings
  newBracket.id               = existing.id;
  newBracket.scoreboardConfigId = existing.scoreboardConfigId;
  newBracket.scoreboardConfig   = existing.scoreboardConfig;
  newBracket.matchDuration      = existing.matchDuration;
  newBracket.seedingMethod      = existing.seedingMethod;
  newBracket.matAssignment      = existing.matAssignment;
  newBracket.version            = (existing.version || 0) + 1;
  return newBracket;
}

module.exports = { regenerateBracketFromSettings, bracketHasScoredMatches };
