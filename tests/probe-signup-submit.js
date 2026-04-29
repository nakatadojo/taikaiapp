/**
 * Probe: actually submit the signup form and see what happens.
 */
const { chromium } = require('playwright');

(async () => {
  const ts = Date.now();
  const testEmail = `probe.${ts}@testmail.kimesoft.io`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Capture console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warn') {
      errors.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  // Capture network responses
  const responses = [];
  page.on('response', resp => {
    if (resp.url().includes('/api/') || resp.url().includes('auth')) {
      responses.push(`${resp.status()} ${resp.url()}`);
    }
  });

  await page.goto('https://www.taikaiapp.com', { waitUntil: 'networkidle', timeout: 30000 });

  // Open modal
  await page.locator('button.nav-btn-primary').filter({ hasText: /sign\s*up/i }).first().click();
  await page.locator('#signup-email').waitFor({ state: 'visible', timeout: 8000 });

  // Fill form
  await page.locator('#signup-first').fill('Probe');
  await page.locator('#signup-last').fill('Test');
  await page.locator('#signup-email').fill(testEmail);
  await page.locator('#signup-password').fill('TestPass123!');

  console.log('Form filled. Clicking #signup-submit...');
  await page.locator('#signup-submit').click();

  // Wait and observe
  await page.waitForTimeout(3000);

  // Check state
  const signupEmailVisible = await page.locator('#signup-email').isVisible();
  const url = page.url();
  console.log('\nAfter submit:');
  console.log('  URL:', url);
  console.log('  #signup-email visible:', signupEmailVisible);
  console.log('  Responses to /api/:', responses);
  console.log('  Console errors/warns:', errors);

  // Take a screenshot of the modal area
  const modalArea = await page.locator('[class*="modal"], [class*="auth"], dialog').first()
    .evaluate(el => el.innerHTML.substring(0, 2000))
    .catch(() => 'no modal');
  console.log('\nModal innerHTML after submit (first 2000):\n', modalArea);

  await browser.close();
  console.log('\n── Probe complete ──');
})();
