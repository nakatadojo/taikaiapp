/**
 * Probe: inspect signup form submit button and modal close behaviour.
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('── Opening homepage ──');
  await page.goto('https://www.taikaiapp.com', { waitUntil: 'networkidle', timeout: 30000 });

  // Click Sign Up nav button
  await page.locator('button.nav-btn').filter({ hasText: /sign\s*up/i }).first().click();
  await page.waitForTimeout(1200);

  // Is #signup-email visible?
  const signupEmailVisible = await page.locator('#signup-email').isVisible();
  console.log('\n#signup-email visible:', signupEmailVisible);

  if (!signupEmailVisible) {
    // Try clicking #tab-signup
    await page.locator('#tab-signup').click().catch(e => console.log('tab-signup click error:', e.message));
    await page.waitForTimeout(800);
    console.log('#signup-email visible after tab click:', await page.locator('#signup-email').isVisible());
  }

  // Find all buttons inside the modal / near the signup form
  const btns = await page.locator('button').evaluateAll(els =>
    els
      .filter(e => e.offsetParent !== null) // visible only
      .map(e => ({
        text: e.textContent.trim().substring(0, 60),
        type: e.type,
        id: e.id,
        cls: e.className.substring(0, 80),
      }))
  );
  console.log('\nAll visible buttons:', JSON.stringify(btns, null, 2));

  // Inspect the signup form
  const formHTML = await page.evaluate(() => {
    const form = document.querySelector('form:has(#signup-email)') ||
                 document.getElementById('signup-form') ||
                 document.querySelector('#signup-email')?.closest('form');
    return form ? form.outerHTML.substring(0, 2000) : 'no form found';
  });
  console.log('\nSignup form HTML (first 2000):\n', formHTML);

  await browser.close();
  console.log('\n── Probe complete ──');
})();
