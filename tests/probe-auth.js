/**
 * One-shot probe: inspect the live site auth modal structure.
 * Run with: node tests/probe-auth.js
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('── Probing https://www.taikaiapp.com ──');
  await page.goto('https://www.taikaiapp.com', { waitUntil: 'networkidle', timeout: 30000 });
  console.log('Page URL:', page.url());

  // Find the auth trigger button
  const loginBtnHTML = await page
    .locator('button, a')
    .filter({ hasText: /login|sign up|sign in/i })
    .first()
    .evaluate(el => el.outerHTML)
    .catch(() => 'NOT FOUND');
  console.log('\nAuth button HTML:\n', loginBtnHTML);

  // Click it
  await page
    .locator('button, a')
    .filter({ hasText: /login|sign up/i })
    .first()
    .click()
    .catch(e => console.log('Click error:', e.message));

  await page.waitForTimeout(1500);
  console.log('URL after click:', page.url());

  // Dump all visible inputs
  const inputs = await page.locator('input').evaluateAll(els =>
    els.map(e => ({
      visible: e.offsetParent !== null,
      type: e.type,
      name: e.name,
      id: e.id,
      placeholder: e.placeholder,
      cls: e.className.substring(0, 80),
    }))
  );
  console.log('\nAll inputs after click:', JSON.stringify(inputs, null, 2));

  // Look for tab switches (Login vs Sign Up tabs)
  const tabs = await page
    .locator('[role="tab"], button:has-text("Log In"), button:has-text("Sign Up"), a:has-text("Log In"), a:has-text("Sign Up")')
    .evaluateAll(els => els.map(e => ({ text: e.textContent.trim(), cls: e.className.substring(0, 80) })));
  console.log('\nTab elements:', JSON.stringify(tabs, null, 2));

  // Snapshot the modal inner HTML
  const modalHTML = await page
    .locator('[class*="modal"], [class*="overlay"], dialog, [role="dialog"], [class*="auth"], [class*="panel"]')
    .first()
    .evaluate(el => el.innerHTML.substring(0, 3000))
    .catch(() => 'no modal element found');
  console.log('\nModal innerHTML (first 3000 chars):\n', modalHTML);

  await browser.close();
  console.log('\n── Probe complete ──');
})();
