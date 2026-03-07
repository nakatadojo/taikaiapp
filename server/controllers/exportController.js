const PDFDocument = require('pdfkit');
const pool = require('../db/pool');
const tournamentQueries = require('../db/queries/tournaments');
const ResultsQueries = require('../db/queries/results');
const CheckinQueries = require('../db/queries/checkins');

// ── CSV Helpers ─────────────────────────────────────────────────────────────

/**
 * Escape a value for CSV output. Wraps in quotes and escapes internal quotes.
 */
function csvEscape(value) {
  const str = value == null ? '' : String(value);
  // Always wrap in quotes to handle commas, newlines, and quotes inside values
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Build a CSV string from headers + rows (arrays of strings).
 */
function buildCSV(headers, rows) {
  const headerLine = headers.map(csvEscape).join(',');
  const dataLines = rows.map(row => row.map(csvEscape).join(','));
  return [headerLine, ...dataLines].join('\r\n');
}

// ── Ownership Check ─────────────────────────────────────────────────────────

/**
 * Verify tournament ownership. Returns tournament row or sends 403/404.
 */
async function verifyOwnership(req, res) {
  const tournamentId = req.params.id;
  const tournament = await tournamentQueries.findById(tournamentId);
  if (!tournament) {
    res.status(404).json({ error: 'Tournament not found' });
    return null;
  }
  if (tournament.created_by !== req.user.id) {
    res.status(403).json({ error: 'Not authorized' });
    return null;
  }
  return tournament;
}

// ── Registrant Queries ──────────────────────────────────────────────────────

/**
 * Fetch registrants for a tournament (same query used by director view).
 */
async function fetchRegistrants(tournamentId) {
  const { rows } = await pool.query(
    `SELECT
       r.id AS registration_id,
       r.status,
       r.payment_status,
       r.amount_paid,
       r.tshirt_size,
       r.created_at AS registered_at,
       cp.first_name,
       cp.last_name,
       cp.date_of_birth,
       cp.gender,
       cp.belt_rank,
       cp.experience_level,
       cp.academy_name,
       u.email,
       COALESCE(
         json_agg(
           json_build_object(
             'eventId', te.id,
             'eventName', te.name,
             'eventType', te.event_type,
             'isPrimary', re.is_primary,
             'price', re.price
           )
           ORDER BY re.selection_order
         ) FILTER (WHERE te.id IS NOT NULL),
         '[]'
       ) AS events
     FROM registrations r
     JOIN users u ON u.id = r.user_id
     LEFT JOIN competitor_profiles cp ON cp.id = r.profile_id
     LEFT JOIN registration_events re ON re.registration_id = r.id
     LEFT JOIN tournament_events te ON te.id = re.event_id
     WHERE r.tournament_id = $1 AND r.status != 'cancelled'
     GROUP BY r.id, cp.first_name, cp.last_name, cp.date_of_birth,
              cp.gender, cp.belt_rank, cp.experience_level, cp.academy_name,
              u.email
     ORDER BY r.created_at DESC`,
    [tournamentId]
  );
  return rows;
}

// ── Export: Registrants CSV ─────────────────────────────────────────────────

/**
 * GET /api/tournaments/:id/export/registrants.csv
 * Streams CSV of all registrants for a tournament.
 */
async function exportRegistrantsCSV(req, res, next) {
  try {
    const tournament = await verifyOwnership(req, res);
    if (!tournament) return;

    const registrants = await fetchRegistrants(tournament.id);

    const headers = [
      'Name', 'Email', 'Dojo', 'Belt', 'Experience', 'Gender',
      'Date of Birth', 'T-Shirt Size', 'Events', 'Amount Paid',
      'Payment Status', 'Status', 'Registered',
    ];

    const rows = registrants.map(r => {
      const name = `${r.first_name || ''} ${r.last_name || ''}`.trim();
      const events = (r.events || [])
        .filter(e => e.eventName)
        .map(e => e.eventName)
        .join('; ');
      const dob = r.date_of_birth
        ? new Date(r.date_of_birth).toLocaleDateString('en-US')
        : '';
      const regDate = r.registered_at
        ? new Date(r.registered_at).toLocaleDateString('en-US')
        : '';

      return [
        name,
        r.email || '',
        r.academy_name || '',
        r.belt_rank || '',
        r.experience_level || '',
        r.gender || '',
        dob,
        r.tshirt_size || '',
        events,
        parseFloat(r.amount_paid || 0).toFixed(2),
        r.payment_status || '',
        r.status || '',
        regDate,
      ];
    });

    const csv = buildCSV(headers, rows);
    const filename = `registrants-${tournament.id}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

// ── Export: Registrants PDF ─────────────────────────────────────────────────

/**
 * GET /api/tournaments/:id/export/registrants.pdf
 * Formatted PDF table of registrants.
 */
async function exportRegistrantsPDF(req, res, next) {
  try {
    const tournament = await verifyOwnership(req, res);
    if (!tournament) return;

    const registrants = await fetchRegistrants(tournament.id);

    const doc = new PDFDocument({ margin: 40, size: 'LETTER', layout: 'landscape' });
    const filename = `registrants-${tournament.id}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    // Title
    doc.fontSize(18).font('Helvetica-Bold')
      .text(tournament.name || 'Tournament', { align: 'center' });
    doc.fontSize(12).font('Helvetica')
      .text('Registrant Report', { align: 'center' });
    if (tournament.date) {
      doc.fontSize(10).text(
        `Date: ${new Date(tournament.date).toLocaleDateString('en-US')}`,
        { align: 'center' }
      );
    }
    doc.moveDown(1);

    if (registrants.length === 0) {
      doc.fontSize(12).font('Helvetica')
        .text('No registrants found for this tournament.', { align: 'center' });
      doc.end();
      return;
    }

    // Summary
    const totalRevenue = registrants.reduce(
      (sum, r) => sum + parseFloat(r.amount_paid || 0), 0
    );
    doc.fontSize(10).font('Helvetica')
      .text(`Total Registrants: ${registrants.length}    |    Total Revenue: $${totalRevenue.toFixed(2)}`);
    doc.moveDown(0.5);

    // Table
    const columns = [
      { header: '#',       width: 30 },
      { header: 'Name',    width: 120 },
      { header: 'Email',   width: 140 },
      { header: 'Dojo', width: 100 },
      { header: 'Belt',    width: 60 },
      { header: 'Events',  width: 160 },
      { header: 'Paid',    width: 55 },
      { header: 'Status',  width: 60 },
    ];

    const tableLeft = doc.x;
    const rowHeight = 18;

    // Header row
    doc.font('Helvetica-Bold').fontSize(8);
    let xPos = tableLeft;
    for (const col of columns) {
      doc.text(col.header, xPos, doc.y, { width: col.width, continued: false });
      xPos += col.width;
    }
    const headerBottom = doc.y;
    doc.moveTo(tableLeft, headerBottom)
      .lineTo(tableLeft + columns.reduce((s, c) => s + c.width, 0), headerBottom)
      .stroke('#999999');
    doc.moveDown(0.3);

    // Data rows
    doc.font('Helvetica').fontSize(7);
    registrants.forEach((r, idx) => {
      // Check if we need a new page
      if (doc.y > doc.page.height - 60) {
        doc.addPage();
        // Re-draw header on new page
        doc.font('Helvetica-Bold').fontSize(8);
        xPos = tableLeft;
        for (const col of columns) {
          doc.text(col.header, xPos, doc.y, { width: col.width, continued: false });
          xPos += col.width;
        }
        doc.moveTo(tableLeft, doc.y)
          .lineTo(tableLeft + columns.reduce((s, c) => s + c.width, 0), doc.y)
          .stroke('#999999');
        doc.moveDown(0.3);
        doc.font('Helvetica').fontSize(7);
      }

      const name = `${r.first_name || ''} ${r.last_name || ''}`.trim();
      const events = (r.events || [])
        .filter(e => e.eventName)
        .map(e => e.eventName)
        .join(', ');
      const paid = `$${parseFloat(r.amount_paid || 0).toFixed(2)}`;

      const rowY = doc.y;
      const values = [
        String(idx + 1),
        name,
        r.email || '',
        r.academy_name || '',
        r.belt_rank || '',
        events,
        paid,
        r.payment_status || '',
      ];

      xPos = tableLeft;
      for (let i = 0; i < columns.length; i++) {
        doc.text(values[i], xPos, rowY, {
          width: columns[i].width - 4,
          height: rowHeight,
          ellipsis: true,
        });
        xPos += columns[i].width;
      }
      doc.y = rowY + rowHeight;
    });

    // Footer
    doc.moveDown(1);
    doc.fontSize(8).fillColor('#999999')
      .text(
        `Generated on ${new Date().toLocaleDateString('en-US')} by Taikai`,
        { align: 'center' }
      );

    doc.end();
  } catch (err) {
    next(err);
  }
}

// ── Export: Results CSV ─────────────────────────────────────────────────────

/**
 * GET /api/tournaments/:id/export/results.csv
 * Results by division.
 */
async function exportResultsCSV(req, res, next) {
  try {
    const tournament = await verifyOwnership(req, res);
    if (!tournament) return;

    const results = await ResultsQueries.getByTournament(tournament.id);

    const headers = [
      'Event', 'Division', 'Place', 'Name', 'Dojo', 'Score', 'Win Method', 'Win Note', 'Status',
    ];

    const rows = [];
    for (const result of results) {
      const data = typeof result.results_data === 'string'
        ? JSON.parse(result.results_data)
        : (result.results_data || []);

      if (Array.isArray(data) && data.length > 0) {
        data.forEach(entry => {
          rows.push([
            result.event_name || '',
            result.division_name || '',
            entry.rank != null ? String(entry.rank) : (entry.place != null ? String(entry.place) : ''),
            entry.name || '',
            entry.club || '',
            entry.score != null ? String(entry.score) : '',
            entry.winMethod || '',
            entry.winNote || '',
            result.status || '',
          ]);
        });
      } else {
        // Division with no results data
        rows.push([
          result.event_name || '',
          result.division_name || '',
          '', '', '', '', '', '',
          result.status || '',
        ]);
      }
    }

    if (rows.length === 0) {
      const csv = buildCSV(headers, [['No results found', '', '', '', '', '', '', '', '']]);
      const filename = `results-${tournament.id}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csv);
    }

    const csv = buildCSV(headers, rows);
    const filename = `results-${tournament.id}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

// ── Export: Results PDF ─────────────────────────────────────────────────────

/**
 * GET /api/tournaments/:id/export/results.pdf
 * Formatted results document grouped by event/division.
 */
async function exportResultsPDF(req, res, next) {
  try {
    const tournament = await verifyOwnership(req, res);
    if (!tournament) return;

    const results = await ResultsQueries.getByTournament(tournament.id);

    const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
    const filename = `results-${tournament.id}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    // Title
    doc.fontSize(20).font('Helvetica-Bold')
      .text(tournament.name || 'Tournament', { align: 'center' });
    doc.fontSize(14).font('Helvetica')
      .text('Results', { align: 'center' });
    if (tournament.date) {
      doc.fontSize(10).text(
        `Date: ${new Date(tournament.date).toLocaleDateString('en-US')}`,
        { align: 'center' }
      );
    }
    doc.moveDown(1.5);

    if (results.length === 0) {
      doc.fontSize(12).font('Helvetica')
        .text('No results found for this tournament.', { align: 'center' });
      doc.end();
      return;
    }

    // Group results by event
    const byEvent = {};
    for (const r of results) {
      const key = r.event_name || 'Unknown Event';
      if (!byEvent[key]) byEvent[key] = [];
      byEvent[key].push(r);
    }

    const eventNames = Object.keys(byEvent).sort();

    for (let eIdx = 0; eIdx < eventNames.length; eIdx++) {
      const eventName = eventNames[eIdx];
      const divisions = byEvent[eventName];

      // Event heading
      if (doc.y > doc.page.height - 100) doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').text(eventName);
      doc.moveDown(0.5);

      for (const division of divisions) {
        const data = typeof division.results_data === 'string'
          ? JSON.parse(division.results_data)
          : (division.results_data || []);

        if (doc.y > doc.page.height - 80) doc.addPage();

        // Division heading
        doc.fontSize(11).font('Helvetica-Bold')
          .text(division.division_name || 'Unknown Division');

        const statusLabel = division.status === 'published' ? 'Published' : 'Pending';
        doc.fontSize(8).font('Helvetica').fillColor('#666666')
          .text(`Status: ${statusLabel}`);
        doc.fillColor('#000000');
        doc.moveDown(0.3);

        if (!Array.isArray(data) || data.length === 0) {
          doc.fontSize(9).font('Helvetica').text('No placements recorded.');
          doc.moveDown(0.8);
          continue;
        }

        // Results table
        const colWidths = { place: 35, name: 160, club: 120, score: 60, winMethod: 95 };
        const tableLeft = doc.x;
        const rowHeight = 16;

        // Table header
        doc.font('Helvetica-Bold').fontSize(8);
        doc.text('Place', tableLeft, doc.y, { width: colWidths.place });
        const headerY = doc.y - 10;
        doc.text('Name', tableLeft + colWidths.place, headerY, { width: colWidths.name });
        doc.text('Dojo', tableLeft + colWidths.place + colWidths.name, headerY, { width: colWidths.club });
        doc.text('Score', tableLeft + colWidths.place + colWidths.name + colWidths.club, headerY, { width: colWidths.score });
        doc.text('Win Method', tableLeft + colWidths.place + colWidths.name + colWidths.club + colWidths.score, headerY, { width: colWidths.winMethod });
        doc.moveDown(0.2);

        const lineY = doc.y;
        const totalWidth = colWidths.place + colWidths.name + colWidths.club + colWidths.score + colWidths.winMethod;
        doc.moveTo(tableLeft, lineY).lineTo(tableLeft + totalWidth, lineY).stroke('#cccccc');
        doc.moveDown(0.2);

        // Table rows
        doc.font('Helvetica').fontSize(8);
        for (const entry of data) {
          if (doc.y > doc.page.height - 50) {
            doc.addPage();
            doc.font('Helvetica').fontSize(8);
          }

          const rowY = doc.y;
          const place = entry.rank != null ? String(entry.rank) : (entry.place != null ? String(entry.place) : '');
          const winMethodStr = entry.winMethod ? (entry.winMethod + (entry.winNote ? ': ' + entry.winNote : '')) : '';
          doc.text(place, tableLeft, rowY, { width: colWidths.place });
          doc.text(entry.name || '', tableLeft + colWidths.place, rowY, { width: colWidths.name });
          doc.text(entry.club || '', tableLeft + colWidths.place + colWidths.name, rowY, { width: colWidths.club });
          doc.text(
            entry.score != null ? String(entry.score) : '',
            tableLeft + colWidths.place + colWidths.name + colWidths.club,
            rowY,
            { width: colWidths.score }
          );
          doc.text(winMethodStr, tableLeft + colWidths.place + colWidths.name + colWidths.club + colWidths.score, rowY, { width: colWidths.winMethod });
          doc.y = rowY + rowHeight;
        }

        doc.moveDown(0.8);
      }

      // Separator between events
      if (eIdx < eventNames.length - 1) {
        doc.moveDown(0.5);
      }
    }

    // Footer
    doc.moveDown(1);
    doc.fontSize(8).fillColor('#999999')
      .text(
        `Generated on ${new Date().toLocaleDateString('en-US')} by Taikai`,
        { align: 'center' }
      );

    doc.end();
  } catch (err) {
    next(err);
  }
}

// ── Export: Check-in CSV ────────────────────────────────────────────────────

/**
 * GET /api/tournaments/:id/export/checkin.csv
 * Check-in status report.
 */
async function exportCheckinCSV(req, res, next) {
  try {
    const tournament = await verifyOwnership(req, res);
    if (!tournament) return;

    const competitors = await CheckinQueries.getByTournament(tournament.id);

    const headers = [
      'Name', 'Dojo', 'Events', 'Checked In', 'Check-in Time',
      'Mat Called', 'Mat Call Time',
    ];

    const rows = competitors.map(c => {
      const name = `${c.first_name || ''} ${c.last_name || ''}`.trim();
      const events = (c.events || [])
        .filter(e => e.eventName)
        .map(e => {
          const div = e.assignedDivision ? ` (${e.assignedDivision})` : '';
          return `${e.eventName}${div}`;
        })
        .join('; ');
      const checkedIn = c.checked_in_at ? 'Yes' : 'No';
      const checkinTime = c.checked_in_at
        ? new Date(c.checked_in_at).toLocaleString('en-US')
        : '';
      const matCalled = c.mat_called_at ? 'Yes' : 'No';
      const matCallTime = c.mat_called_at
        ? new Date(c.mat_called_at).toLocaleString('en-US')
        : '';

      return [
        name,
        c.academy_name || '',
        events,
        checkedIn,
        checkinTime,
        matCalled,
        matCallTime,
      ];
    });

    const csv = buildCSV(headers, rows);
    const filename = `checkin-${tournament.id}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  exportRegistrantsCSV,
  exportRegistrantsPDF,
  exportResultsCSV,
  exportResultsPDF,
  exportCheckinCSV,
};
