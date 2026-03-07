const express = require('express');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const documentController = require('../controllers/documentController');

const router = express.Router();

// Document upload — accepts images and common document types
const documentUpload = upload.single('file');

// POST /api/profiles/:profileId/documents — upload a document
router.post('/:profileId/documents',
  requireAuth,
  documentUpload,
  documentController.uploadDocument
);

// GET /api/profiles/:profileId/documents — list documents
router.get('/:profileId/documents',
  requireAuth,
  documentController.listDocuments
);

// DELETE /api/profiles/:profileId/documents/:docId — delete a document
router.delete('/:profileId/documents/:docId',
  requireAuth,
  documentController.deleteDocument
);

// POST /api/profiles/:profileId/photo — upload competitor photo
router.post('/:profileId/photo',
  requireAuth,
  upload.single('photo'),
  documentController.uploadPhoto
);

module.exports = router;
