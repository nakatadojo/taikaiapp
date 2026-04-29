/**
 * Probe: log in as super admin and inspect the /director page structure.
 */
require('dotenv').config();
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const email = process.env.SUPER_ADMIN_EMAIL;
  const pass  = process.env.SUPER_ADMIN_PASSWORD;
  console.log(`Logging in as ${email}...`);

  await page.goto('https://www.taikaiapp.com', { waitUntil: 'networkidle', timeout: 30000 });

  // Open Log In modal
  await page.locator('button.nav-btn-ghost').filter({ hasText: /log\s*in/i }).first().click();
  await page.locator('#login-email').waitFor({ state: 'visible', timeout: 8000 });
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(pass);
  await page.locator('#login-submit').click();
  await page.locator('#login-email').waitFor({ state: 'hidden', timeout: 10000 });

  console.log('Logged in. Navigating to /director...');
  await page.goto('https://www.taikaiapp.com/director', { waitUntil: 'networkidle', timeout: 30000 });
  console.log('URL:', page.url());

  // Find Create Tournament button
  const createBtns = await page.locator('button, a').evaluateAll(els =>
    els
      .filter(e => e.offsetParent !== null)
      .filter(e => /create|new|add.*tournament/i.test(e.textContent))
      .map(e => ({ text: e.textContent.trim().substring(0, 60), tag: e.tagName, id: e.id, cls: e.className.substring(0, 60) }))
  );
  console.log('\nCreate Tournament candidates:', JSON.stringify(createBtns, null, 2));

  // Find notification bell
  const bellCandidates = await page.evaluate(() => {
    const selectors = [
      '[data-testid="notification-bell"]', '.notification-bell',
      'button[aria-label*="notification" i]', 'svg[aria-label*="bell" i]',
      '[class*="bell"]', '[class*="notification"]'
    ];
    const results = [];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) results.push({ selector: sel, tag: el.tagName, cls: el.className.substring(0, 80) });
    }
    return results;
  });
  console.log('\nNotification bell candidates:', JSON.stringify(bellCandidates, null, 2));

  // Capture all visible buttons on /director
  const allBtns = await page.locator('button, a').evaluateAll(els =>
    els
      .filter(e => e.offsetParent !== null)
      .slice(0, 30)
      .map(e => ({ text: e.textContent.trim().substring(0, 50), tag: e.tagName, id: e.id, cls: e.className.substring(0, 60) }))
  );
  console.log('\nFirst 30 visible buttons on /director:');
  allBtns.forEach(b => console.log(`  [${b.tag}#${b.id}] .${b.cls} → "${b.text}"`));

  await browser.close();
  console.log('\n── Probe complete ──');
})();
