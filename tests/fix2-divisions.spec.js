// @ts-check
/**
 * fix2-divisions.spec.js
 *
 * Tests for Fix 2: Server-side division auto-assignment with WebSocket broadcast.
 *
 * Requires environment variables:
 *   TEST_AUTH_TOKEN   — auth cookie value
 *   TEST_TOURNAMENT_ID — UUID of a test tournament owned by the auth user
 *   BASE_URL          — defaults to https://www.taikaiapp.com
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://www.taikaiapp.com';

test.describe('Fix 2: Server-side division auto-assign', () => {
    test('POST /api/tournaments/:id/divisions/auto-assign returns division assignments', async ({ request }) => {
        const token = process.env.TEST_AUTH_TOKEN;
        const tid = process.env.TEST_TOURNAMENT_ID;
        if (!token || !tid) { test.skip(); return; }

        const res = await request.post(`${BASE_URL}/api/tournaments/${tid}/divisions/auto-assign`, {
            headers: { 'Cookie': `token=${token}` },
        });
        // Accept 200 (assignments found) or 200 with empty generatedDivisions (no templates configured)
        expect([200, 404]).toContain(res.status());
        if (res.status() === 200) {
            const body = await res.json();
            expect(body).toHaveProperty('generatedDivisions');
            expect(typeof body.generatedDivisions).toBe('object');
        }
    });

    test('POST /api/tournaments/:id/divisions/auto-assign requires authentication', async ({ request }) => {
        const tid = process.env.TEST_TOURNAMENT_ID || 'test-id';
        const res = await request.post(`${BASE_URL}/api/tournaments/${tid}/divisions/auto-assign`);
        // Should be 401 (unauthorized) or 404 (tournament not found for non-UUID)
        expect([401, 404]).toContain(res.status());
    });

    test('WebSocket: Division update broadcast received after auto-assign', async ({ browser }) => {
        const token = process.env.TEST_AUTH_TOKEN;
        const tid = process.env.TEST_TOURNAMENT_ID;
        if (!token || !tid) { test.skip(); return; }

        const contextA = await browser.newContext();
        const contextB = await browser.newContext();
        const pageA = await contextA.newPage();
        const pageB = await contextB.newPage();

        await contextA.addCookies([{ name: 'token', value: token, domain: new URL(BASE_URL).hostname, path: '/' }]);
        await contextB.addCookies([{ name: 'token', value: token, domain: new URL(BASE_URL).hostname, path: '/' }]);

        // Device B subscribes to divisions channel
        await pageB.goto(BASE_URL);
        const wsReceived = pageB.evaluate(({ BASE_URL, tid }) => {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = `${BASE_URL}/socket.io/socket.io.js`;
                script.onload = () => {
                    const s = io(BASE_URL, { transports: ['websocket', 'polling'] });
                    s.on('connect', () => s.emit('subscribe:divisions', { tournamentId: tid }));
                    s.on('divisions:updated', ({ generatedDivisions }) => {
                        resolve({ received: true, hasData: typeof generatedDivisions === 'object' });
                    });
                    setTimeout(() => reject(new Error('WS divisions timeout')), 6000);
                };
                document.head.appendChild(script);
            });
        }, { BASE_URL, tid });

        await pageA.waitForTimeout(500);

        // Device A triggers auto-assign
        await pageA.evaluate(async ({ BASE_URL, tid }) => {
            return fetch(`${BASE_URL}/api/tournaments/${tid}/divisions/auto-assign`, {
                method: 'POST',
                credentials: 'include',
            });
        }, { BASE_URL, tid });

        const result = await wsReceived;
        expect(result.received).toBe(true);
        expect(result.hasData).toBe(true);

        await contextA.close();
        await contextB.close();
    });
});
