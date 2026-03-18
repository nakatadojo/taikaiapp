// @ts-check
/**
 * fix6-refresh-button.spec.js
 *
 * Tests for Fix 6: Remove "Refresh from Server" button and
 * syncRegistrationsFromServer() function.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'https://www.taikaiapp.com';

test.describe('Fix 6: Remove Refresh from Server button', () => {
    test('manage.html does not contain #sync-server-btn', async () => {
        const managePath = path.join(__dirname, '../client/manage.html');
        const html = fs.readFileSync(managePath, 'utf8');
        expect(html).not.toContain('sync-server-btn');
        expect(html).not.toContain('syncRegistrationsFromServer');
        expect(html).not.toContain('Refresh from Server');
    });

    test('app.js does not define syncRegistrationsFromServer', async () => {
        const appPath = path.join(__dirname, '../client/app.js');
        const src = fs.readFileSync(appPath, 'utf8');
        expect(src).not.toContain('syncRegistrationsFromServer');
        expect(src).not.toContain('startSyncPolling');
        expect(src).not.toContain('stopSyncPolling');
    });

    test('Live page: #sync-server-btn is absent from DOM', async ({ page }) => {
        const token = process.env.TEST_AUTH_TOKEN;
        const tid = process.env.TEST_TOURNAMENT_ID;
        if (!token || !tid) { test.skip(); return; }

        await page.context().addCookies([{ name: 'token', value: token, domain: new URL(BASE_URL).hostname, path: '/' }]);
        await page.goto(`${BASE_URL}/manage.html?tournament=${tid}`);
        await page.waitForLoadState('domcontentloaded');

        const btn = page.locator('#sync-server-btn');
        await expect(btn).toHaveCount(0);
    });
});
