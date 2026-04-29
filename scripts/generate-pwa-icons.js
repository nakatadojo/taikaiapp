/**
 * Generate PWA icon PNGs using sharp.
 * Creates icon-192.png and icon-512.png in client/icons/.
 */
const path = require('path');
const sharp = require('sharp');

const iconsDir = path.join(__dirname, '..', 'client', 'icons');

async function generateIcon(size) {
  // Build an SVG: indigo background square with "TM" white text
  const fontSize = Math.round(size * 0.35);
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.18)}" fill="#6366f1"/>
  <text
    x="${size / 2}"
    y="${size / 2 + fontSize * 0.35}"
    font-family="Arial, Helvetica, sans-serif"
    font-size="${fontSize}"
    font-weight="bold"
    text-anchor="middle"
    fill="#ffffff"
    letter-spacing="2"
  >TM</text>
</svg>`;

  const outPath = path.join(iconsDir, `icon-${size}.png`);
  await sharp(Buffer.from(svg)).png().toFile(outPath);
  console.log(`Generated ${outPath}`);
}

(async () => {
  try {
    await generateIcon(192);
    await generateIcon(512);
    console.log('PWA icons generated successfully.');
  } catch (err) {
    console.error('Failed to generate icons:', err.message);
    process.exit(1);
  }
})();
