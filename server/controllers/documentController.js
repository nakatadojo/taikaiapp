const pool = require('../db/pool');
const { uploadFile } = require('../config/storage');

/**
 * POST /api/profiles/:profileId/documents
 * Upload a document for a competitor profile (tournament-specific).
 */
async function uploadDocument(req, res, next) {
  try {
    const { profileId } = req.params;
    const { tournamentId, documentName } = req.body;

    if (!tournamentId || !documentName) {
      return res.status(400).json({ error: 'tournamentId and documentName are required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Verify profile ownership
    const profile = await pool.query(
      'SELECT id, user_id FROM competitor_profiles WHERE id = $1',
      [profileId]
    );
    if (!profile.rows[0]) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    if (profile.rows[0].user_id !== req.user.id) {
      // Check if user is a coach who created this profile
      const isCoach = req.user.roles && req.user.roles.includes('coach');
      if (!isCoach) {
        return res.status(403).json({ error: 'You do not own this profile' });
      }
    }

    // Upload file
    const fileUrl = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);

    // Save document record
    const result = await pool.query(
      `INSERT INTO competitor_documents (profile_id, tournament_id, document_name, file_url)
       VALUES ($1, $2, $3, $4)
       RETURNING id, profile_id, tournament_id, document_name, file_url, uploaded_at`,
      [profileId, tournamentId, documentName, fileUrl]
    );

    res.status(201).json({ document: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/profiles/:profileId/documents?tournamentId=X
 * List documents for a competitor profile, optionally filtered by tournament.
 */
async function listDocuments(req, res, next) {
  try {
    const { profileId } = req.params;
    const { tournamentId } = req.query;

    let query = 'SELECT * FROM competitor_documents WHERE profile_id = $1';
    const params = [profileId];

    if (tournamentId) {
      query += ' AND tournament_id = $2';
      params.push(tournamentId);
    }

    query += ' ORDER BY uploaded_at DESC';

    const result = await pool.query(query, params);
    res.json({ documents: result.rows });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/profiles/:profileId/documents/:docId
 * Remove a document.
 */
async function deleteDocument(req, res, next) {
  try {
    const { profileId, docId } = req.params;

    const result = await pool.query(
      'DELETE FROM competitor_documents WHERE id = $1 AND profile_id = $2 RETURNING id',
      [docId, profileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ message: 'Document deleted' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/profiles/:profileId/photo
 * Upload a competitor photo.
 */
async function uploadPhoto(req, res, next) {
  try {
    const { profileId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Verify profile ownership
    const profile = await pool.query(
      'SELECT id, user_id FROM competitor_profiles WHERE id = $1',
      [profileId]
    );
    if (!profile.rows[0]) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const fileUrl = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);

    await pool.query(
      'UPDATE competitor_profiles SET photo_url = $1 WHERE id = $2',
      [fileUrl, profileId]
    );

    res.json({ photoUrl: fileUrl });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tournaments/:id/registration-settings
 * Public endpoint returning registration requirements for a tournament.
 */
async function getRegistrationSettings(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT registration_settings FROM tournaments WHERE id = $1',
      [req.params.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    res.json({ registrationSettings: result.rows[0].registration_settings || {} });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadDocument,
  listDocuments,
  deleteDocument,
  uploadPhoto,
  getRegistrationSettings,
};
