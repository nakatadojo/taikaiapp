// @ts-check
/**
 * fix1-competitors.spec.js
 *
 * Tests for Fix 1: Competitors database-first with per-record API + WebSocket push.
 *
 * Requires environment variables:
 *   TEST_AUTH_TOKEN   — auth cookie value
 *   TEST_TOURNAMENT_ID — UUID of a test tournament owned by the auth user
 *   BASE_URL          — defaults to https://www.taikaiapp.com
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://www.taikaiapp.com';

test.describe('Fix 1: Competitors DB-first API', () => {
    test('POST /api/tournaments/:id/competitors creates and returns competitor with server-assigned ID', async ({ request }) => {
        const token = process.env.TEST_AUTH_TOKEN;
        const tid = process.env.TEST_TOURNAMENT_ID;
        if (!token || !tid) { test.skip(); return; }

        const res = await request.post(`${BASE_URL}/api/tournaments/${tid}/competitors`, {
            headers: { 'Cookie': `token=${token}` },
            data: {
                competitor: {
                    firstName: 'Test',
                    lastName: 'Competitor',
                    dateOfBirth: '2000-01-01',
                    gender: 'male',
                    rank: 'White',
                    weight: 60,
                    experience: 2,
                    events: [],
                }
            }
        });
        expect(res.status()).toBe(201);
        const body = await res.json();
        expect(body.competitor).toHaveProperty('id');
        expect(body.competitor.firstName).toBe('Test');

        // Clean up
        const id = body.competitor.id;
        await request.delete(`${BASE_URL}/api/tournaments/${tid}/competitors/${id}`, {
            headers: { 'Cookie': `token=${token}` }
        });
    });

    test('PUT /api/tournaments/:id/competitors/:id updates competitor', async ({ request }) => {
        const token = process.env.TEST_AUTH_TOKEN;
        const tid = process.env.TEST_TOURNAMENT_ID;
        if (!token || !tid) { test.skip(); return; }

        // Create
        const createRes = await request.post(`${BASE_URL}/api/tournaments/${tid}/competitors`, {
            headers: { 'Cookie': `token=${token}` },
            data: { competitor: { firstName: 'Update', lastName: 'Test', dateOfBirth: '1995-01-01', gender: 'male', rank: 'Blue', weight: 70, events: [] } }
        });
        expect(createRes.status()).toBe(201);
        const { competitor } = await createRes.json();

        // Update
        const updateRes = await request.put(`${BASE_URL}/api/tournaments/${tid}/competitors/${competitor.id}`, {
            headers: { 'Cookie': `token=${token}` },
            data: { competitor: { ...competitor, rank: 'Brown' } }
        });
        expect(updateRes.status()).toBe(200);
        const updated = await updateRes.json();
        expect(updated.competitor.rank).toBe('Brown');

        // Clean up
        await request.delete(`${BASE_URL}/api/tournaments/${tid}/competitors/${competitor.id}`, {
            headers: { 'Cookie': `token=${token}` }
        });
    });

    test('DELETE /api/tournaments/:id/competitors/:id removes competitor', async ({ request }) => {
        const token = process.env.TEST_AUTH_TOKEN;
        const tid = process.env.TEST_TOURNAMENT_ID;
        if (!token || !tid) { test.skip(); return; }

        const createRes = await request.post(`${BASE_URL}/api/tournaments/${tid}/competitors`, {
            headers: { 'Cookie': `token=${token}` },
            data: { competitor: { firstName: 'Delete', lastName: 'Me', dateOfBirth: '1990-01-01', gender: 'female', rank: 'White', weight: 55, events: [] } }
        });
        expect(createRes.status()).toBe(201);
        const { competitor } = await createRes.json();

        const delRes = await request.delete(`${BASE_URL}/api/tournaments/${tid}/competitors/${competitor.id}`, {
            headers: { 'Cookie': `token=${token}` }
        });
        expect(delRes.status()).toBe(200);

        // Verify not in list
        const listRes = await request.get(`${BASE_URL}/api/tournaments/${tid}/competitors`, {
            headers: { 'Cookie': `token=${token}` }
        });
        expect(listRes.status()).toBe(200);
        const { competitors } = await listRes.json();
        expect(competitors.find(c => c.id === competitor.id)).toBeUndefined();
    });

    test('WebSocket: Device A adds competitor, Device B sees it within 3s', async ({ browser }) => {
        const token = process.env.TEST_AUTH_TOKEN;
        const tid = process.env.TEST_TOURNAMENT_ID;
        if (!token || !tid) { test.skip(); return; }

        const contextA = await browser.newContext();
        const contextB = await browser.newContext();
        const pageA = await contextA.newPage();
        const pageB = await contextB.newPage();

        // Set auth cookie on both
        await contextA.addCookies([{ name: 'token', value: token, domain: new URL(BASE_URL).hostname, path: '/' }]);
        await contextB.addCookies([{ name: 'token', value: token, domain: new URL(BASE_URL).hostname, path: '/' }]);

        // Device B connects to WS and subscribes
        await pageB.goto(BASE_URL);
        const wsReceived = pageB.evaluate(({ BASE_URL, tid }) => {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = `${BASE_URL}/socket.io/socket.io.js`;
                script.onload = () => {
                    const s = io(BASE_URL, { transports: ['websocket', 'polling'] });
                    s.on('connect', () => s.emit('subscribe:competitors', { tournamentId: tid }));
                    s.on('competitors:updated', ({ action, competitor }) => {
                        if (action === 'add' && competitor.firstName === 'WSTest') resolve(competitor);
                    });
                    setTimeout(() => reject(new Error('WS timeout after 5s')), 5000);
                };
                document.head.appendChild(script);
            });
        }, { BASE_URL, tid });

        // Small delay to let Device B subscribe
        await pageA.waitForTimeout(500);

        // Device A adds competitor via API
        const addRes = await pageA.evaluate(async ({ BASE_URL, tid }) => {
            const r = await fetch(`${BASE_URL}/api/tournaments/${tid}/competitors`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ competitor: { firstName: 'WSTest', lastName: 'User', dateOfBirth: '2000-01-01', gender: 'male', rank: 'White', weight: 60, events: [] } })
            });
            return r.json();
        }, { BASE_URL, tid });

        const received = await wsReceived;
        expect(received.firstName).toBe('WSTest');

        // Clean up
        await pageA.evaluate(async ({ BASE_URL, tid, id }) => {
            await fetch(`${BASE_URL}/api/tournaments/${tid}/competitors/${id}`, { method: 'DELETE', credentials: 'include' });
        }, { BASE_URL, tid, id: addRes.competitor.id });

        await contextA.close();
        await contextB.close();
    });
});
