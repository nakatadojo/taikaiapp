/**
 * Certificate Service
 *
 * Generates a PDF award certificate in memory using PDFKit.
 * Returns a Buffer (PDF bytes) suitable for streaming to the client.
 */
const PDFDocument = require('pdfkit');

const PLACE_LABELS = {
  1: '1st Place',
  2: '2nd Place',
  3: '3rd Place',
  4: '4th Place',
  5: '5th Place',
};

function placeLabel(rank) {
  return PLACE_LABELS[rank] || `${rank}th Place`;
}

/**
 * Generate a single certificate PDF in memory.
 *
 * @param {object} opts
 * @param {string} opts.competitorName  - Full name of the competitor
 * @param {number} opts.rank            - Integer placement (1, 2, 3 …)
 * @param {string} opts.divisionName    - Division label
 * @param {string} opts.eventName       - Event label (e.g. "Kata", "Kumite")
 * @param {string} opts.tournamentName  - Tournament name
 * @param {string} opts.tournamentDate  - Display-ready date string
 * @returns {Promise<Buffer>}           - PDF bytes
 */
function generateCertificate({
  competitorName,
  rank,
  divisionName,
  eventName,
  tournamentName,
  tournamentDate,
}) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    // Landscape letter: 792 × 612 pt
    const doc = new PDFDocument({
      size: [792, 612],
      layout: 'landscape',
      margin: 0,
      autoFirstPage: true,
    });

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = 792;
    const H = 612;

    // ── Background ────────────────────────────────────────────────────────────
    // Deep dark navy
    doc.rect(0, 0, W, H).fill('#0f172a');

    // Outer decorative border — gold
    const borderPad = 18;
    doc
      .rect(borderPad, borderPad, W - borderPad * 2, H - borderPad * 2)
      .lineWidth(3)
      .stroke('#d4af37');

    // Inner thin border
    const innerPad = 24;
    doc
      .rect(innerPad, innerPad, W - innerPad * 2, H - innerPad * 2)
      .lineWidth(1)
      .stroke('#6366f1');

    // Corner accent squares
    const cornerSize = 10;
    const corners = [
      [innerPad - 1, innerPad - 1],
      [W - innerPad - cornerSize + 1, innerPad - 1],
      [innerPad - 1, H - innerPad - cornerSize + 1],
      [W - innerPad - cornerSize + 1, H - innerPad - cornerSize + 1],
    ];
    corners.forEach(([x, y]) => {
      doc.rect(x, y, cornerSize, cornerSize).fill('#d4af37');
    });

    // ── Tournament Name ───────────────────────────────────────────────────────
    doc
      .fillColor('#d4af37')
      .font('Helvetica-Bold')
      .fontSize(16)
      .text(tournamentName.toUpperCase(), 0, 55, {
        width: W,
        align: 'center',
        characterSpacing: 2,
      });

    // Separator line under tournament name
    doc
      .moveTo(W / 2 - 140, 82)
      .lineTo(W / 2 + 140, 82)
      .lineWidth(1)
      .stroke('#6366f1');

    // ── Certificate Title ─────────────────────────────────────────────────────
    doc
      .fillColor('#e2e8f0')
      .font('Helvetica')
      .fontSize(13)
      .text('Certificate of Achievement', 0, 92, {
        width: W,
        align: 'center',
        characterSpacing: 1,
      });

    // ── "Presented To" label ──────────────────────────────────────────────────
    doc
      .fillColor('#94a3b8')
      .font('Helvetica')
      .fontSize(11)
      .text('presented to', 0, 130, { width: W, align: 'center' });

    // ── Competitor Name ───────────────────────────────────────────────────────
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(42)
      .text(competitorName, 0, 155, {
        width: W,
        align: 'center',
      });

    // Underline beneath name
    const nameLineY = 215;
    doc
      .moveTo(W / 2 - 180, nameLineY)
      .lineTo(W / 2 + 180, nameLineY)
      .lineWidth(1.5)
      .stroke('#6366f1');

    // ── Placement ─────────────────────────────────────────────────────────────
    doc
      .fillColor('#d4af37')
      .font('Helvetica-Bold')
      .fontSize(30)
      .text(placeLabel(rank), 0, 228, { width: W, align: 'center' });

    // ── Division & Event ──────────────────────────────────────────────────────
    const divisionLine = [divisionName, eventName].filter(Boolean).join('  ·  ');
    doc
      .fillColor('#94a3b8')
      .font('Helvetica')
      .fontSize(12)
      .text(divisionLine, 0, 272, { width: W, align: 'center' });

    // ── Date ──────────────────────────────────────────────────────────────────
    doc
      .fillColor('#64748b')
      .font('Helvetica')
      .fontSize(11)
      .text(tournamentDate, 0, 296, { width: W, align: 'center' });

    // ── Decorative star motifs ────────────────────────────────────────────────
    // Simple five-pointed star drawn with lines (very small, ornamental)
    function drawStar(cx, cy, r, color) {
      doc.save();
      doc.fillColor(color);
      const points = 5;
      const innerR = r * 0.4;
      let path = '';
      for (let i = 0; i < points * 2; i++) {
        const angle = (Math.PI / points) * i - Math.PI / 2;
        const rad = i % 2 === 0 ? r : innerR;
        const x = cx + rad * Math.cos(angle);
        const y = cy + rad * Math.sin(angle);
        path += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ',' + y.toFixed(2);
      }
      path += 'Z';
      doc.path(path).fill();
      doc.restore();
    }

    drawStar(W / 2 - 200, 260, 8, '#d4af37');
    drawStar(W / 2 + 200, 260, 8, '#d4af37');

    // ── Bottom strip ──────────────────────────────────────────────────────────
    doc.rect(0, H - 48, W, 48).fill('#1e293b');

    doc
      .fillColor('#475569')
      .font('Helvetica')
      .fontSize(9)
      .text('Taikai Tournament Management Platform', 0, H - 32, {
        width: W,
        align: 'center',
      });

    doc.end();
  });
}

module.exports = { generateCertificate };
