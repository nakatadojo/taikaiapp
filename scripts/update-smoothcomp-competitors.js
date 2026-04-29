#!/usr/bin/env node
/**
 * Sync Smoothcomp competitor data into Taikai (update existing + insert new).
 * - Matches on smoothcompUserId stored in the data JSON field
 * - Updates: name, club, dob, gender, beltRank, weight, paymentStatus,
 *            paymentMethod, events list
 * - Sets `approved` column from Smoothcomp's Approved status
 * - Skips "Standard Registration" rows when building event lists
 * - Ignores Standard-Registration-only athletes (no actual events)
 *
 * Usage:
 *   node scripts/update-smoothcomp-competitors.js
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { Pool }       = require('pg');
const { randomUUID } = require('crypto');

const TOURNAMENT_ID = '2b752e64-76e7-4675-bdb5-e754f432a84c';
const CSV_PATH = path.resolve(
  '/Users/alexandronakata/Desktop/registrations-2026-03-23-16_35_57.csv'
);

// ── Minimal quoted-CSV parser ────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const out = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const row = [];
    let field = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') { field += '"'; i++; }
        else q = !q;
      } else if (ch === ',' && !q) {
        row.push(field.trim()); field = '';
      } else {
        field += ch;
      }
    }
    row.push(field.trim());
    out.push(row);
  }
  return out;
}

// ── Column indices (0-based, from Smoothcomp CSV header) ────────────────────
const C = {
  firstName:    0,
  middleName:   1,
  lastName:     2,
  club:         3,
  // team:        4,
  birth:        5,
  group:        6,   // bracket code e.g. KBU12N or "Standard Registration"
  entry:        7,   // "Kata" | "Kumite" | "Kobudo" | "Team Kata" | "Standard Registration"
  sex:          8,   // "Male" | "Female"
  age:          9,   // "Under 7" … "Adults" | "Masters"
  rank:         10,  // "Beginner" | "Novice" | "Intermediate" | "Advanced"
  weightClass:  11,  // Kumite weight-class label e.g. "Ages 14-17 over 143lbs"
  weight:       12,  // athlete's recorded body weight (often empty)
  // adminNote:   13,
  // paymentNote: 14,
  // statusNote:  15,
  // publicNote:  16,
  weighin:      17,  // weigh-in flag
  weighinWeight:18,  // measured weigh-in weight
  paidAmount:   19,  // amount actually paid
  price:        20,  // list price
  pricingType:  21,  // "Early" | "Normal"
  payment:      22,  // "Paid" | "Not paid"
  paymentMethod:23,  // "stripe" | "adminpaid" | ""
  approved:     24,  // "Approved" | "Not approved"
  phone:        32,
  email:        33,
  userId:       40,  // Smoothcomp user ID (stable unique key)
  beltRank:     43,  // e.g. "Black", "Brown", "Blue" …
};

const SKIP_ENTRIES = new Set(['standard registration', '']);

function normalizeEntry(raw) {
  const e = raw.trim().toLowerCase();
  if (SKIP_ENTRIES.has(e)) return null;
  if (e.startsWith('team kata')) return 'Team Kata';
  if (e.startsWith('kata'))     return 'Kata';
  if (e.startsWith('kumite'))   return 'Kumite';
  if (e.startsWith('kobudo'))   return 'Kobudo';
  return null; // unknown
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const text = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCSV(text);
  const data = rows.slice(1); // drop header row
  console.log(`Parsed ${data.length} CSV rows`);

  // Group rows by Smoothcomp userId
  const byUser = new Map();
  for (const row of data) {
    const uid = row[C.userId];
    if (!uid) continue;
    if (!byUser.has(uid)) byUser.set(uid, []);
    byUser.get(uid).push(row);
  }
  console.log(`Unique athletes: ${byUser.size}`);

  const competitors = [];

  for (const [smoothcompUserId, userRows] of byUser) {
    // ── Personal info (take from the first Standard Registration row if present,
    //    otherwise the first row — either has full personal data) ──────────────
    const infoRow = userRows[0];

    const firstName  = infoRow[C.firstName].trim();
    const middleName = infoRow[C.middleName].trim();
    const lastName   = infoRow[C.lastName].trim();
    const club       = infoRow[C.club].trim();
    const birth      = infoRow[C.birth].trim();
    const phone      = infoRow[C.phone].trim();
    const email      = infoRow[C.email].trim();
    const beltRank   = infoRow[C.beltRank].trim();

    // Gender — prefer from an event row (non-Standard) as Standard rows are blank
    let genderRaw = '';
    for (const row of userRows) {
      const g = row[C.sex].trim();
      if (g) { genderRaw = g; break; }
    }
    const gender = genderRaw.toLowerCase() === 'female' ? 'female'
                 : genderRaw.toLowerCase() === 'male'   ? 'male'
                 : '';

    // ── Payment / approval — pick first non-empty values across all rows ──────
    let payment = '', paymentMethod = '', paidAmount = '', approvedStr = '';
    let weight = '', weighinWeight = '';

    for (const row of userRows) {
      if (!payment       && row[C.payment])       payment       = row[C.payment].trim();
      if (!paymentMethod && row[C.paymentMethod]) paymentMethod = row[C.paymentMethod].trim();
      if (!paidAmount    && row[C.paidAmount])    paidAmount    = row[C.paidAmount].trim();
      if (!approvedStr   && row[C.approved])      approvedStr   = row[C.approved].trim();
      if (!weight        && row[C.weight])        weight        = row[C.weight].trim();
      if (!weighinWeight && row[C.weighinWeight]) weighinWeight = row[C.weighinWeight].trim();
    }

    const isPaid     = payment.toLowerCase() === 'paid';
    const isApproved = approvedStr.toLowerCase() === 'approved';

    // Best weight: prefer official weigh-in value, fall back to pre-declared weight
    const weightValue = weighinWeight || weight || undefined;

    // ── Events (skip Standard Registration) ──────────────────────────────────
    const events = [];
    for (const row of userRows) {
      const discipline = normalizeEntry(row[C.entry]);
      if (!discipline) continue;

      events.push({
        discipline,
        divisionCode: row[C.group].trim(),
        ageDivision:  row[C.age].trim(),
        experience:   row[C.rank].trim(),
        gender:       row[C.sex].trim(),
        weightClass:  row[C.weightClass].trim() || null,
        fullGroup:    row[C.entry].trim(),
      });
    }

    if (events.length === 0) continue; // Standard-only athlete — ignore

    competitors.push({
      smoothcompUserId,
      firstName,
      ...(middleName  ? { middleName }  : {}),
      lastName,
      club,
      ...(birth       ? { dob: birth }  : {}),
      gender,
      ...(phone       ? { phone }       : {}),
      ...(email       ? { email }       : {}),
      ...(beltRank    ? { beltRank }    : {}),
      ...(weightValue ? { weight: weightValue } : {}),
      paymentStatus:  payment      || undefined,
      paymentMethod:  paymentMethod || undefined,
      ...(paidAmount  ? { paidAmount }  : {}),
      events,
      source: 'smoothcomp-import',
      // internal flag — not stored in JSON, used for the `approved` DB column
      _isApproved: isApproved,
    });
  }

  console.log(`Athletes with real events: ${competitors.length}`);

  let updatedCount  = 0;
  let insertedCount = 0;

  for (const c of competitors) {
    const { _isApproved, ...competitorData } = c;

    // Try to find an existing record by smoothcompUserId
    const res = await pool.query(
      `SELECT id, data, approved
         FROM tournament_director_competitors
        WHERE tournament_id = $1
          AND data->>'smoothcompUserId' = $2
        LIMIT 1`,
      [TOURNAMENT_ID, c.smoothcompUserId]
    );

    if (res.rows.length > 0) {
      // ── UPDATE existing ───────────────────────────────────────────────────
      const existing = res.rows[0];
      // Merge: preserve any Taikai-specific keys not coming from Smoothcomp
      const merged = { ...existing.data, ...competitorData };

      await pool.query(
        `UPDATE tournament_director_competitors
            SET data     = $1,
                approved = $2
          WHERE id = $3`,
        [JSON.stringify(merged), _isApproved, existing.id]
      );
      updatedCount++;
    } else {
      // ── INSERT new ────────────────────────────────────────────────────────
      const id = randomUUID();
      await pool.query(
        `INSERT INTO tournament_director_competitors
           (id, tournament_id, data, is_test, approved)
         VALUES ($1, $2, $3, false, $4)`,
        [id, TOURNAMENT_ID, JSON.stringify(competitorData), _isApproved]
      );
      insertedCount++;
    }

    process.stdout.write(
      `\r  Updated: ${updatedCount}  Inserted: ${insertedCount}  — ${c.firstName} ${c.lastName}         `
    );
  }

  console.log(`\n\nDone! ${updatedCount} updated, ${insertedCount} inserted.`);
  await pool.end();
}

main().catch(err => { console.error('\nFATAL:', err.message); process.exit(1); });
