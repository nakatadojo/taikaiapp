'use strict';

/**
 * POST /api/academies/:id/members/csv-import
 *
 * Bulk-imports dojo members from a CSV file.
 * Required columns: first_name, last_name, email
 * Optional columns: belt_rank, date_of_birth
 *
 * Auth: session required; only the dojo's head_coach_id may import.
 */

const multer = require('multer');
const pool = require('../db/pool');
const academyQueries = require('../db/queries/academies');
const userQueries = require('../db/queries/users');
const { sendDojoInviteEmail } = require('../email');

// ── Multer — memory storage, CSV only, 2MB limit ─────────────────────────────

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter(req, file, cb) {
    if (
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.toLowerCase().endsWith('.csv')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are accepted'), false);
    }
  },
});

// Export the multer middleware so the router can use it
const uploadCsv = csvUpload.single('csv');

// ── CSV parser (manual — csv-parse not installed) ─────────────────────────────

/**
 * Parse a CSV buffer into an array of objects.
 * First row is headers; subsequent rows are data.
 * Trims whitespace from all keys and values.
 *
 * @param {Buffer} buffer
 * @returns {{ headers: string[], rows: Record<string,string>[] }}
 */
function parseCsvBuffer(buffer) {
  const text = buffer.toString('utf8');
  // Normalise line endings and split
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  const nonEmpty = lines.map(l => l.trim()).filter(Boolean);
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  // Simple CSV split: handles basic quoted fields but not nested commas in quotes for now
  function splitLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  const headers = splitLine(nonEmpty[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
  const rows = [];

  for (let i = 1; i < nonEmpty.length; i++) {
    const values = splitLine(nonEmpty[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || '').trim();
    });
    rows.push(row);
  }

  return { headers, rows };
}

// ── Controller ────────────────────────────────────────────────────────────────

const APP_URL = () => process.env.APP_URL || 'http://localhost:3000';

/**
 * POST /api/academies/:id/members/csv-import
 */
async function csvImportMembers(req, res, next) {
  try {
    const { id } = req.params;

    // Verify dojo exists
    const academy = await academyQueries.findById(id);
    if (!academy) {
      return res.status(404).json({ error: 'Dojo not found' });
    }

    // Only head coach (or admin) may import
    if (
      academy.head_coach_id !== req.user.id &&
      !req.user.roles.includes('admin') &&
      !req.user.roles.includes('super_admin')
    ) {
      return res.status(403).json({ error: 'Only the head coach can import members' });
    }

    // Require uploaded file
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No CSV file provided' });
    }

    // Parse CSV
    const { headers, rows } = parseCsvBuffer(req.file.buffer);

    // Validate required columns
    const required = ['first_name', 'last_name', 'email'];
    const missing = required.filter(col => !headers.includes(col));
    if (missing.length > 0) {
      return res.status(400).json({
        error: `CSV is missing required column(s): ${missing.join(', ')}. Required: first_name, last_name, email`,
      });
    }

    if (rows.length === 0) {
      return res.status(400).json({ error: 'CSV file contains no data rows' });
    }

    // Fetch requesting coach info for invite emails
    const coach = await userQueries.findById(req.user.id);
    const coachName = coach
      ? `${coach.first_name || ''} ${coach.last_name || ''}`.trim() || coach.email
      : 'Your coach';

    // ── Process each row ──────────────────────────────────────────────────────

    let added = 0;
    let skipped = 0;
    const errors = [];

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const rowNum = rowIndex + 2; // 1-based, header is row 1

      const firstName = row['first_name'] || '';
      const lastName = row['last_name'] || '';
      const email = (row['email'] || '').toLowerCase();
      const beltRank = row['belt_rank'] || null;
      const dateOfBirth = row['date_of_birth'] || null;

      // Basic validation
      if (!firstName || !lastName || !email) {
        errors.push({ row: rowNum, reason: `Row ${rowNum}: first_name, last_name, and email are all required` });
        continue;
      }

      // Simple email format check
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push({ row: rowNum, reason: `Row ${rowNum}: invalid email "${email}"` });
        continue;
      }

      try {
        // Check if user already exists
        let targetUser = await userQueries.findByEmail(email);
        let isNewUser = false;

        if (targetUser) {
          // Existing user — just ensure membership (ON CONFLICT DO NOTHING handled by addMember)
          const existing = await pool.query(
            'SELECT id FROM academy_members WHERE academy_id = $1 AND user_id = $2',
            [id, targetUser.id]
          );
          if (existing.rows.length > 0) {
            skipped++;
            continue;
          }
          await academyQueries.addMember(id, targetUser.id, 'competitor', req.user.id);
          added++;
        } else {
          // Create passwordless user
          targetUser = await userQueries.createWithoutPassword({
            email,
            firstName,
            lastName,
            dateOfBirth: dateOfBirth || undefined,
          });
          isNewUser = true;

          // Add to academy
          await academyQueries.addMember(id, targetUser.id, 'competitor', req.user.id);
          added++;
        }

        // For new users: generate a fresh verification token (7-day expiry) and send invite email
        if (isNewUser) {
          try {
            // Refresh token in DB so it's current
            const tokenResult = await pool.query(
              `UPDATE users
               SET verification_token = gen_random_uuid()::text,
                   verification_token_expires = NOW() + INTERVAL '7 days'
               WHERE id = $1
               RETURNING verification_token`,
              [targetUser.id]
            );
            const token = tokenResult.rows[0]?.verification_token || targetUser.verification_token;
            const claimUrl = `${APP_URL()}/claim-account?token=${token}`;

            await sendDojoInviteEmail({
              toEmail: email,
              toName: `${firstName} ${lastName}`,
              dojoName: academy.name,
              invitedByName: coachName,
              claimUrl,
            });
          } catch (emailErr) {
            // Non-fatal — user was created, just log the failure
            console.warn(`CSV import: failed to send invite to ${email}:`, emailErr.message);
          }
        }
      } catch (err) {
        if (err.code === '23505') {
          // Duplicate email race condition — treat as skipped
          skipped++;
        } else {
          errors.push({ row: rowNum, reason: `Row ${rowNum}: ${err.message}` });
        }
      }
    }

    return res.status(200).json({ added, skipped, errors });
  } catch (err) {
    next(err);
  }
}

module.exports = { csvImportMembers, uploadCsv };
