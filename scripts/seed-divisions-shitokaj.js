/**
 * Seed division templates for SHITO KAI 40 ANIVERSARIO
 * Based on the official division chart (two-image PDF).
 *
 * Run: node scripts/seed-divisions-shitokaj.js
 */
require('dotenv').config();
const { randomUUID } = require('crypto');
const pool = require('../server/db/pool');

const TOURNAMENT_ID = 'e42eeb54-8258-41cc-b898-42e42c330abf';
const EVENT_IDS = {
  kata:       'aff6dfeb-0030-46c8-b901-fc8cb96cd9ea',
  kumite:     'bc9f009b-40c6-4a11-b029-2e1820d65609',
  teamKata:   '03fa4845-af57-4024-a630-fa5b6d85f813',
  teamKumite: '8d8862f1-7a29-4e92-8598-dbe108169523',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
// Use type:'rank' so both color names ("white") and kyu/dan ("6th Kyu") match.
// RANK_ORDER (weakest→strongest):
//   10th kyu … 1st kyu, 1st dan … 10th dan
// Belt → kyu mapping (matches normalizeRank in divisionAssignment.js):
//   white=10th, yellow=9th, orange=8th, green=7th, blue=6th, purple=5th,
//   brown=3rd, black=1st dan

function rank(rankMin, rankMax, label) {
  return { type: 'rank', ranges: [{ rankMin, rankMax, label }] };
}
function age(min, max, label) {
  return { type: 'age', ranges: [{ min, max, label }] };
}
function gender(value, label) {
  return { type: 'gender', ranges: [{ value, label }] };
}
function tmpl(name, ...criteria) {
  return { id: randomUUID(), name, criteria };
}

// ── Age ranges used in individual events ─────────────────────────────────────
const AGE_RANGES = [
  { min: 6,  max: 7,  label: '6-7 años'   },
  { min: 8,  max: 9,  label: '8-9 años'   },
  { min: 10, max: 11, label: '10-11 años' },
  { min: 12, max: 13, label: '12-13 años' },
  { min: 14, max: 15, label: '14-15 años' },
  { min: 16, max: 17, label: '16-17 años' },
];

const GENDERS = [
  { value: 'female', label: 'Femenil' },
  { value: 'male',   label: 'Varonil' },
];

// Belt groups expressed as kyu/dan rank ranges
const BELT_GROUPS = [
  { rankMin: '10th kyu', rankMax: '10th kyu', label: 'Blanca'        }, // white only
  { rankMin: '9th kyu',  rankMax: '8th kyu',  label: 'Amarilla-Naranja' }, // yellow-orange
  { rankMin: '7th kyu',  rankMax: '5th kyu',  label: 'Verde-Azul'    }, // green-blue-purple
  { rankMin: '4th kyu',  rankMax: '2nd kyu',  label: 'Cafe'          }, // brown equivalents
  { rankMin: '1st dan',  rankMax: '10th dan', label: 'Negra'         }, // black belt
];

// ── Build individual event templates (Kata + Kumite) ─────────────────────────
function buildIndividualTemplates() {
  const templates = [];

  // 1. All belts, up to 4 years (no rank filter — any belt qualifies)
  for (const g of GENDERS) {
    templates.push(tmpl(
      `Todas Cintas Hasta 4 ${g.label}`,
      age(0, 4, 'Hasta 4 años'),
      gender(g.value, g.label),
    ));
  }

  // 2. White/Yellow/Orange, up to 5 years
  for (const g of GENDERS) {
    templates.push(tmpl(
      `Blanca-Naranja Hasta 5 ${g.label}`,
      rank('10th kyu', '8th kyu', 'Blanca-Naranja'),
      age(0, 5, 'Hasta 5 años'),
      gender(g.value, g.label),
    ));
  }

  // 3-7. Each belt group × 6 age ranges × 2 genders
  for (const b of BELT_GROUPS) {
    for (const ar of AGE_RANGES) {
      for (const g of GENDERS) {
        templates.push(tmpl(
          `${b.label} ${ar.label} ${g.label}`,
          rank(b.rankMin, b.rankMax, b.label),
          age(ar.min, ar.max, ar.label),
          gender(g.value, g.label),
        ));
      }
    }
  }

  return templates;
}

// ── Build Team Kata templates ─────────────────────────────────────────────────
function buildTeamKataTemplates() {
  return [
    tmpl(
      'Kata Equipo Mixto Blanca-Naranja Hasta 12',
      rank('10th kyu', '8th kyu', 'Blanca-Naranja'),
      age(0, 12, 'Hasta 12 años'),
    ),
    tmpl(
      'Kata Equipo Mixto Verde-Negra Hasta 12',
      rank('7th kyu', '10th dan', 'Verde-Negra'),
      age(0, 12, 'Hasta 12 años'),
    ),
  ];
}

// ── Build Team Kumite templates ───────────────────────────────────────────────
function buildTeamKumiteTemplates() {
  return [
    tmpl(
      'Kumite Equipo Color Hasta Azul Hasta 10',
      rank('10th kyu', '5th kyu', 'Color-Azul'),
      age(0, 10, 'Hasta 10 años'),
    ),
    tmpl(
      'Kumite Equipo Cafe-Negra Hasta 12',
      rank('4th kyu', '10th dan', 'Cafe-Negra'),
      age(0, 12, 'Hasta 12 años'),
    ),
  ];
}

// ── Insert into DB ────────────────────────────────────────────────────────────
async function upsertTemplates(eventId, templates) {
  const result = await pool.query(
    `UPDATE tournament_events
     SET criteria_templates = $1
     WHERE id = $2
     RETURNING id, name, criteria_templates`,
    [JSON.stringify(templates), eventId]
  );
  return result.rows[0];
}

async function main() {
  const individual = buildIndividualTemplates();
  console.log(`Individual templates: ${individual.length} (Kata + Kumite each)`);

  const teamKata   = buildTeamKataTemplates();
  const teamKumite = buildTeamKumiteTemplates();

  await upsertTemplates(EVENT_IDS.kata,       individual);
  console.log('✓ Kata templates saved');

  await upsertTemplates(EVENT_IDS.kumite,     individual);
  console.log('✓ Kumite templates saved');

  await upsertTemplates(EVENT_IDS.teamKata,   teamKata);
  console.log('✓ Team Kata templates saved');

  await upsertTemplates(EVENT_IDS.teamKumite, teamKumite);
  console.log('✓ Team Kumite templates saved');

  // Run auto-assign so competitors flow into divisions immediately
  const { runAutoAssign } = require('../server/services/divisionAutoAssign');
  const result = await runAutoAssign(TOURNAMENT_ID);
  const divCount = Object.values(result).reduce((s, e) =>
    s + Object.keys(e.generated || {}).length, 0);
  console.log(`✓ Auto-assign complete — ${divCount} division group(s) generated`);

  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); process.exit(1); });
