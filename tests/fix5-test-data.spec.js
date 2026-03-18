// @ts-check
/**
 * fix5-test-data.spec.js
 *
 * Tests for Fix 5: Test data generator - server-side.
 *
 * Requires environment variables:
 *   TEST_AUTH_TOKEN   — auth cookie value
 *   TEST_TOURNAMENT_ID — UUID of a test tournament owned by the auth user
 *   BASE_URL          — defaults to https://www.taikaiapp.com
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://www.taikaiapp.com';

test.describe('Fix 5: Server-side test data generator', () => {
    test('POST /api/tournaments/:id/generate-test-data creates DB records', async ({ request }) => {
        const token = process.env.TEST_AUTH_TOKEN;
        const tid = process.env.TEST_TOURNAMENT_ID;
        if (!token || !tid) { test.skip(); return; }

        const res = await request.post(`${BASE_URL}/api/tournaments/${tid}/generate-test-data`, {
            headers: { 'Cookie': `token=${token}` },
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty('count');
        expect(body.count).toBeGreaterThanOrEqual(20);
        expect(body.count).toBeLessThanOrEqual(30);
        expect(body).toHaveProperty('competitors');
        expect(Array.isArray(body.competitors)).toBe(true);
        // Each competitor should have a server-assigned UUID
        expect(body.competitors[0]).toHaveProperty('id');
        // is_test flag should be true
        expect(body.competitors[0].is_test).toBe(true);

        // Clean up: clear the test data we just generated
        await request.post(`${BASE_URL}/api/tournaments/${tid}/clear-test-data`, {
            headers: { 'Cookie': `token=${token}` },
        });
    });

    test('POST /api/tournaments/:id/clear-test-data removes only test records', async ({ request }) => {
        const token = process.env.TEST_AUTH_TOKEN;
        const tid = process.env.TEST_TOURNAMENT_ID;
        if (!token || !tid) { test.skip(); return; }

        // First generate some test data
        await request.post(`${BASE_URL}/api/tournaments/${tid}/generate-test-data`, {
            headers: { 'Cookie': `token=${token}` },
        });

        // Create a real competitor (not test)
        const realRes = await request.post(`${BASE_URL}/api/tournaments/${tid}/competitors`, {
            headers: { 'Cookie': `token=${token}` },
            data: { competitor: { firstName: 'Real', lastName: 'Competitor', dateOfBirth: '1990-01-01', gender: 'male', rank: 'Black', weight: 75, events: [] } }
        });
        const { competitor: realComp } = await realRes.json();

        // Clear test data
        const clearRes = await request.post(`${BASE_URL}/api/tournaments/${tid}/clear-test-data`, {
            headers: { 'Cookie': `token=${token}` },
        });
        expect(clearRes.status()).toBe(200);
        const clearBody = await clearRes.json();
        expect(clearBody.deleted).toBeGreaterThan(0);

        // Verify real competitor still exists
        const listRes = await request.get(`${BASE_URL}/api/tournaments/${tid}/competitors`, {
            headers: { 'Cookie': `token=${token}` },
        });
        const { competitors } = await listRes.json();
        const stillExists = competitors.find(c => c.id === realComp.id);
        expect(stillExists).toBeDefined();

        // Clean up real competitor
        await request.delete(`${BASE_URL}/api/tournaments/${tid}/competitors/${realComp.id}`, {
            headers: { 'Cookie': `token=${token}` },
        });
    });

    test('WS: generated test data appears on Device B via competitors:updated', async ({ browser }) => {
        const token = process.env.TEST_AUTH_TOKEN;
        const tid = process.env.TEST_TOURNAMENT_ID;
        if (!token || !tid) { test.skip(); return; }

        const contextA = await browser.newContext();
        const contextB = await browser.newContext();
        const pageA = await contextA.newPage();
        const pageB = await contextB.newPage();

        await contextA.addCookies([{ name: 'token', value: token, domain: new URL(BASE_URL).hostname, path: '/' }]);
        await contextB.addCookies([{ name: 'token', value: token, domain: new URL(BASE_URL).hostname, path: '/' }]);

        await pageB.goto(BASE_URL);

        // Device B listens for the first competitor add via WS
        const wsReceived = pageB.evaluate(({ BASE_URL, tid }) => {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = `${BASE_URL}/socket.io/socket.io.js`;
                script.onload = () => {
                    const s = io(BASE_URL, { transports: ['websocket', 'polling'] });
                    s.on('connect', () => s.emit('subscribe:competitors', { tournamentId: tid }));
                    s.on('competitors:updated', ({ action, competitor }) => {
                        if (action === 'add' && competitor.is_test) resolve({ action, isTest: competitor.is_test });
                    });
                    setTimeout(() => reject(new Error('WS test-data timeout')), 10000);
                };
                document.head.appendChild(script);
            });
        }, { BASE_URL, tid });

        await pageA.waitForTimeout(500);

        // Device A triggers generate-test-data
        await pageA.evaluate(async ({ BASE_URL, tid }) => {
            return fetch(`${BASE_URL}/api/tournaments/${tid}/generate-test-data`, {
                method: 'POST',
                credentials: 'include',
            });
        }, { BASE_URL, tid });

        const result = await wsReceived;
        expect(result.action).toBe('add');
        expect(result.isTest).toBe(true);

        // Clean up
        await pageA.evaluate(async ({ BASE_URL, tid }) => {
            return fetch(`${BASE_URL}/api/tournaments/${tid}/clear-test-data`, { method: 'POST', credentials: 'include' });
        }, { BASE_URL, tid });

        await contextA.close();
        await contextB.close();
    });
});
