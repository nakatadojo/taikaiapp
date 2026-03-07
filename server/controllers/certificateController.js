const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const pool = require('../db/pool');
const tournamentQueries = require('../db/queries/tournaments');
const CertificateQueries = require('../db/queries/certificates');
const ResultsQueries = require('../db/queries/results');

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

// ── Upload Template ─────────────────────────────────────────────────────────

/**
 * POST /api/tournaments/:id/certificate-template
 *
 * Accepts a multipart image upload (field name: "template").
 * Stores the image as base64 in the DB and optionally saves to uploads/.
 */
async function uploadTemplate(req, res, next) {
  try {
    const tournament = await verifyOwnership(req, res);
    if (!tournament) return;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Use field name "template".' });
    }

    const { buffer, mimetype, originalname } = req.file;

    // Build base64 data URL for DB storage
    const base64 = buffer.toString('base64');
    const templateData = `data:${mimetype};base64,${base64}`;

    // Save to local uploads/ directory as fallback
    let templateUrl = null;
    try {
      const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'certificates');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const ext = path.extname(originalname) || '.png';
      const filename = `${tournament.id}${ext}`;
      fs.writeFileSync(path.join(uploadsDir, filename), buffer);
      templateUrl = `/uploads/certificates/${filename}`;
    } catch (fsErr) {
      // Non-fatal — we still have base64 in DB
      console.warn('Could not save certificate to uploads/:', fsErr.message);
    }

    const row = await CertificateQueries.upsert(tournament.id, {
      template_data: templateData,
      template_url: templateUrl,
    });

    res.json({
      message: 'Certificate template uploaded',
      template: {
        id: row.id,
        template_url: row.template_url,
        has_template_data: !!row.template_data,
        merge_tag_config: row.merge_tag_config,
        updated_at: row.updated_at,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── Get Template ────────────────────────────────────────────────────────────

/**
 * GET /api/tournaments/:id/certificate-template
 *
 * Returns the stored template data + merge-tag config.
 */
async function getTemplate(req, res, next) {
  try {
    const tournament = await verifyOwnership(req, res);
    if (!tournament) return;

    const row = await CertificateQueries.getByTournament(tournament.id);
    if (!row) {
      return res.json({ template: null });
    }

    res.json({
      template: {
        id: row.id,
        template_url: row.template_url,
        template_data: row.template_data,
        merge_tag_config: row.merge_tag_config,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── Save Config ─────────────────────────────────────────────────────────────

/**
 * PUT /api/tournaments/:id/certificate-template/config
 *
 * Saves merge-tag configuration (field positions, font sizes, etc.).
 * Body: { tags: { name: { enabled, x, y, fontSize, fontColor, textAlign }, ... } }
 */
async function saveConfig(req, res, next) {
  try {
    const tournament = await verifyOwnership(req, res);
    if (!tournament) return;

    const config = req.body;
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'Config body is required' });
    }

    const row = await CertificateQueries.saveConfig(tournament.id, config);

    res.json({
      message: 'Certificate configuration saved',
      merge_tag_config: row.merge_tag_config,
      updated_at: row.updated_at,
    });
  } catch (err) {
    next(err);
  }
}

// ── Batch PDF Generation ────────────────────────────────────────────────────

/**
 * Hex color string (#RRGGBB) to [r, g, b] array (0-255).
 */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

/**
 * Map pdfkit text alignment from config value.
 */
function pdfTextAlign(align) {
  if (align === 'left' || align === 'right' || align === 'center') return align;
  return 'center';
}

/**
 * GET /api/tournaments/:id/certificates/batch.pdf
 *
 * Generates a single PDF with one certificate per competitor per placement.
 * Uses the uploaded template image as each page's background, then overlays
 * merge-tag text at the configured positions.
 */
async function generateBatchPDF(req, res, next) {
  try {
    const tournament = await verifyOwnership(req, res);
    if (!tournament) return;

    // 1. Load certificate template
    const certTemplate = await CertificateQueries.getByTournament(tournament.id);
    if (!certTemplate || (!certTemplate.template_data && !certTemplate.template_url)) {
      return res.status(400).json({
        error: 'No certificate template uploaded. Please upload a template first.',
      });
    }

    const config = certTemplate.merge_tag_config || {};
    const tags = config.tags || {};

    // 2. Get published results to build certificate list
    const results = await ResultsQueries.getByTournament(tournament.id);
    if (!results || results.length === 0) {
      return res.status(400).json({
        error: 'No results found. Sync and publish results before generating certificates.',
      });
    }

    // 3. Build certificate entries from results
    const tournamentName = tournament.name || 'Tournament';
    const tournamentDate = tournament.date
      ? new Date(tournament.date).toLocaleDateString('en-US')
      : new Date().toLocaleDateString('en-US');

    const certificates = [];
    const placeLabels = ['1st Place', '2nd Place', '3rd Place'];

    for (const result of results) {
      const resultsData = result.results_data;
      if (!resultsData || !Array.isArray(resultsData)) continue;

      for (const entry of resultsData) {
        const rank = entry.rank || entry.place;
        if (!rank || rank > 3) continue; // Top 3 only

        certificates.push({
          name: entry.name || 'Unknown',
          place: placeLabels[rank - 1] || `${rank}th Place`,
          division: result.division_name || '',
          tournament: tournamentName,
          date: tournamentDate,
          club: entry.club || entry.academy || '',
        });
      }
    }

    if (certificates.length === 0) {
      return res.status(400).json({
        error: 'No placements found in results. Make sure results have ranked competitors.',
      });
    }

    // 4. Resolve the template image buffer
    let imgBuffer;
    if (certTemplate.template_data) {
      // Base64 data URL  →  raw buffer
      const base64Match = certTemplate.template_data.match(/^data:[^;]+;base64,(.+)$/);
      if (base64Match) {
        imgBuffer = Buffer.from(base64Match[1], 'base64');
      }
    }

    if (!imgBuffer && certTemplate.template_url) {
      // Try loading from local file system
      const localPath = path.join(__dirname, '..', '..', certTemplate.template_url);
      if (fs.existsSync(localPath)) {
        imgBuffer = fs.readFileSync(localPath);
      }
    }

    if (!imgBuffer) {
      return res.status(400).json({
        error: 'Could not load certificate template image.',
      });
    }

    // 5. Build PDF — landscape orientation, letter size
    //    Each page gets the template image as background with text overlay.
    const pageWidth = 792;   // 11 inches * 72 dpi
    const pageHeight = 612;  // 8.5 inches * 72 dpi

    const doc = new PDFDocument({
      size: [pageWidth, pageHeight],
      layout: 'landscape',
      margin: 0,
      autoFirstPage: false,
    });

    const filename = `certificates-${tournament.id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    for (const cert of certificates) {
      doc.addPage({ size: [pageWidth, pageHeight], margin: 0 });

      // Draw template image as full-page background
      try {
        doc.image(imgBuffer, 0, 0, { width: pageWidth, height: pageHeight });
      } catch (imgErr) {
        // If image fails, continue with blank background
        console.warn('Certificate image render error:', imgErr.message);
      }

      // Overlay merge-tag text
      const tagNames = ['name', 'place', 'division', 'tournament', 'date', 'club'];
      for (const tagName of tagNames) {
        const tagConfig = tags[tagName];
        if (!tagConfig || !tagConfig.enabled) continue;

        const text = cert[tagName] || '';
        if (!text) continue;

        // Position: x/y are percentages of the page
        const x = (tagConfig.x / 100) * pageWidth;
        const y = (tagConfig.y / 100) * pageHeight;

        // Font
        const fontSize = tagConfig.fontSize || 20;
        const fontColor = tagConfig.fontColor || '#000000';
        const textAlign = pdfTextAlign(tagConfig.textAlign);

        // Map font family to pdfkit built-in
        let fontName = 'Helvetica';
        if (tagConfig.fontFamily === 'serif') {
          fontName = 'Times-Roman';
        }

        const rgb = hexToRgb(fontColor);
        doc.font(fontName)
          .fontSize(fontSize)
          .fillColor(rgb);

        // For centered/right alignment we need a width container.
        // We use the full page width and position accordingly.
        if (textAlign === 'center') {
          doc.text(text, 0, y - fontSize / 2, {
            width: pageWidth,
            align: 'center',
          });
        } else if (textAlign === 'right') {
          doc.text(text, 0, y - fontSize / 2, {
            width: x,
            align: 'right',
          });
        } else {
          // left
          doc.text(text, x, y - fontSize / 2, {
            width: pageWidth - x,
            align: 'left',
          });
        }
      }
    }

    doc.end();
  } catch (err) {
    next(err);
  }
}

// ── Delete Template ─────────────────────────────────────────────────────────

/**
 * DELETE /api/tournaments/:id/certificate-template
 *
 * Removes the certificate template for a tournament.
 */
async function deleteTemplate(req, res, next) {
  try {
    const tournament = await verifyOwnership(req, res);
    if (!tournament) return;

    // Remove local file if exists
    const existing = await CertificateQueries.getByTournament(tournament.id);
    if (existing && existing.template_url) {
      try {
        const localPath = path.join(__dirname, '..', '..', existing.template_url);
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      } catch (fsErr) {
        console.warn('Could not remove certificate file:', fsErr.message);
      }
    }

    await CertificateQueries.remove(tournament.id);
    res.json({ message: 'Certificate template removed' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadTemplate,
  getTemplate,
  saveConfig,
  generateBatchPDF,
  deleteTemplate,
};
