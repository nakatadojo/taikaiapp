/**
 * Add PWA meta tags to all HTML pages in client/.
 * Inserts right before </head> if not already present.
 */
const fs = require('fs');
const path = require('path');

const CLIENT_DIR = path.join(__dirname, '..', 'client');

const PWA_META = `
    <!-- PWA -->
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#6366f1">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="TournamentMgr">
    <link rel="apple-touch-icon" href="/icons/icon-192.png">`;

const files = fs.readdirSync(CLIENT_DIR).filter(f => f.endsWith('.html'));
let updated = 0;

for (const file of files) {
  const filePath = path.join(CLIENT_DIR, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Skip if already has manifest link
  if (content.includes('rel="manifest"') || content.includes("rel='manifest'")) {
    console.log(`SKIP (already has manifest): ${file}`);
    continue;
  }

  // Insert before </head>
  if (!content.includes('</head>')) {
    console.log(`SKIP (no </head>): ${file}`);
    continue;
  }

  content = content.replace('</head>', `${PWA_META}\n</head>`);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`UPDATED: ${file}`);
  updated++;
}

console.log(`\nDone. Updated ${updated} / ${files.length} HTML files.`);
