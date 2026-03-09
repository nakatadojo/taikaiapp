const multer = require('multer');

/**
 * Multer config for file uploads (photos, logos).
 * - 5MB limit
 * - Image types only (jpeg, png, gif, webp)
 * - UUID filenames
 */
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, GIF, WEBP) are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

/**
 * Verify image magic bytes after multer has buffered the file.
 * Guards against MIME-type spoofing (e.g., a PHP shell uploaded as image/png).
 *
 * Usage: place AFTER upload.single('photo') in the middleware chain.
 *   router.post('/upload', upload.single('photo'), validateImageBytes, handler)
 */
function validateImageBytes(req, res, next) {
  if (!req.file) return next(); // no file — nothing to check

  const buf = req.file.buffer;
  if (!buf || buf.length < 12) {
    return res.status(400).json({ error: 'Uploaded file is too small or empty' });
  }

  const isJPEG = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
  const isPNG  = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
  const isGIF  = buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38;
  // WEBP: starts with RIFF (4 bytes) + 4-byte size + WEBP (4 bytes)
  const isWEBP = buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
                 buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;

  if (!isJPEG && !isPNG && !isGIF && !isWEBP) {
    return res.status(400).json({ error: 'Uploaded file does not appear to be a valid image' });
  }

  next();
}

module.exports = upload;
module.exports.validateImageBytes = validateImageBytes;
