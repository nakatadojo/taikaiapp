const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let s3Client = null;

// Initialize R2/S3 client if credentials are available
if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID) {
  const { S3Client } = require('@aws-sdk/client-s3');
  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  console.log('✓ R2 storage configured');
} else {
  console.log('ℹ R2 not configured — using local uploads/ directory');
}

/**
 * Upload a file to R2 (production) or local disk (development).
 * @param {Buffer} buffer - File data
 * @param {string} originalFilename - Original filename (for extension)
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} URL or path to the uploaded file
 */
async function uploadFile(buffer, originalFilename, contentType) {
  const ext = path.extname(originalFilename).toLowerCase();
  const key = `${crypto.randomUUID()}${ext}`;

  if (s3Client) {
    // Upload to Cloudflare R2
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));
    const publicUrl = process.env.R2_PUBLIC_URL
      ? `${process.env.R2_PUBLIC_URL}/${key}`
      : key;
    return publicUrl;
  }

  // Fallback: save to local uploads/ directory
  const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const filePath = path.join(uploadsDir, key);
  fs.writeFileSync(filePath, buffer);
  return `/uploads/${key}`;
}

/**
 * Get the public URL for a stored file.
 * @param {string} key - The file key or path
 * @returns {string} Full URL
 */
function getFileUrl(key) {
  if (!key) return null;
  // Already a full URL (R2 or absolute)
  if (key.startsWith('http') || key.startsWith('/uploads')) return key;
  // R2 key — construct URL
  if (process.env.R2_PUBLIC_URL) return `${process.env.R2_PUBLIC_URL}/${key}`;
  return `/uploads/${key}`;
}

module.exports = { uploadFile, getFileUrl };
