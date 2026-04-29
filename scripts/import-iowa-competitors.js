#!/usr/bin/env node
/**
 * Import competitors from Smoothcomp CSV into taikaiapp
 * Tournament: AAU Karate Iowa District Championships 2026
 * Skips "Standard Registration" rows — imports Kata, Team Kata, Kumite, Kobudo only
 */

require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');
const { randomUUID } = require('crypto');

const TOURNAMENT_ID = '2b752e64-76e7-4675-bdb5-e754f432a84c';
const CSV_PATH = '/Users/alexandronakata/Desktop/registrations-2026-03-23-14_40_46.csv';

// ── Minimal CSV parser (handles quoted fields) ──────────────────────────────
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const results = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const row = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        row.push(field.trim());
        field = '';
      } else {
        field += ch;
      }
    }
    row.push(field.trim());
    results.push(row);
  }
  return results;
}

// ── Column indices (from header row) ───────────────────────────────────────
const COL = {
  firstName:  0,
  middleName: 1,
  lastName:   2,
  club:       3,
  birth:      5,
  group:      6,   // bracket code e.g. KGU8-B
  entry:      7,   // Kata | Kumite | Kobudo | Team Kata | Standard Registration | full division string
  sex:        8,   // Male / Female (blank for Team Kata)
  age:        9,   // Under 7, Under 9 … Adults, Masters
  rank:       10,  // Beginner, Novice, Intermediate, Advanced
  weightClass:11,  // Kumite weight class
  phone:      32,
  email:      33,
  userId:     40,
  beltRank:   43,
};

const SKIP_ENTRIES = new Set(['Standard Registration', '']);

function normalizeEntry(entry) {
  const e = entry.trim();
  if (e.toLowerCase().startsWith('kata'))    return 'Kata';
  if (e.toLowerCase().startsWith('kumite'))  return 'Kumite';
  if (e.toLowerCase().startsWith('kobudo'))  return 'Kobudo';
  if (e.toLowerCase().startsWith('team kata')) return 'Team Kata';
  return null;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const text = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCSV(text);
  const header = rows[0];
  const data   = rows.slice(1);

  console.log(`Parsed ${data.length} data rows`);

  // Group rows by smoothcomp User id
  const byUser = new Map();
  for (const row of data) {
    const userId = row[COL.userId];
    if (!userId) continue;
    if (!byUser.has(userId)) byUser.set(userId, []);
    byUser.get(userId).push(row);
  }

  console.log(`Found ${byUser.size} unique persons`);

  const competitors = [];

  for (const [smoothcompUserId, userRows] of byUser) {
    // Grab personal info from the first row that has it
    const infoRow = userRows[0];
    const firstName  = infoRow[COL.firstName].trim();
    const middleName = infoRow[COL.middleName].trim();
    const lastName   = infoRow[COL.lastName].trim();
    const club       = infoRow[COL.club].trim();
    const birth      = infoRow[COL.birth].trim();   // YYYY-MM-DD
    const phone      = infoRow[COL.phone].trim();
    const email      = infoRow[COL.email].trim();
    const beltRank   = infoRow[COL.beltRank].trim();
    const genderRaw  = infoRow[COL.sex].trim();     // Male / Female
    const gender     = genderRaw.toLowerCase() === 'female' ? 'female' : genderRaw.toLowerCase() === 'male' ? 'male' : '';

    // Collect non-Standard events
    const events = [];
    for (const row of userRows) {
      const entryRaw = row[COL.entry].trim();
      if (SKIP_ENTRIES.has(entryRaw)) continue;

      const discipline = normalizeEntry(entryRaw);
      if (!discipline) continue; // shouldn't happen

      const divisionCode = row[COL.group].trim();
      const ageDivision  = row[COL.age].trim();
      const experience   = row[COL.rank].trim();
      const sexForEvent  = row[COL.sex].trim();
      const weightClass  = row[COL.weightClass].trim();

      events.push({
        discipline,
        divisionCode,
        ageDivision,
        experience,
        gender: sexForEvent,
        weightClass: weightClass || null,
        fullGroup: entryRaw,
      });
    }

    if (events.length === 0) continue; // Standard Registration only — skip

    const competitorData = {
      firstName,
      middleName: middleName || undefined,
      lastName,
      club,
      dob: birth || undefined,
      gender,
      phone: phone || undefined,
      email: email || undefined,
      beltRank: beltRank || undefined,
      events,
      source: 'smoothcomp-import',
      smoothcompUserId,
    };

    competitors.push(competitorData);
  }

  console.log(`\nReady to import ${competitors.length} competitors (with at least one event)\n`);

  // Print summary
  const summary = {};
  for (const c of competitors) {
    for (const e of c.events) {
      summary[e.discipline] = (summary[e.discipline] || 0) + 1;
    }
  }
  console.log('Event entries by discipline:', summary);
  console.log('');

  // Insert into DB
  let inserted = 0;
  for (const competitorData of competitors) {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO tournament_director_competitors
         (id, tournament_id, data, is_test, approved)
       VALUES ($1, $2, $3, false, true)`,
      [id, TOURNAMENT_ID, JSON.stringify(competitorData)]
    );
    inserted++;
    process.stdout.write(`\r  Inserted ${inserted}/${competitors.length}: ${competitorData.firstName} ${competitorData.lastName}  `);
  }

  console.log(`\n\nDone! ${inserted} competitors imported into tournament ${TOURNAMENT_ID}`);
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
