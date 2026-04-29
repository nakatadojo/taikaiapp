const { test, expect, request } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '.test-debug-state.json');
const BASE = 'http://localhost:3000';
const TS = Date.now();
const DIRECTOR = { email: `dir.${TS}@test.local`, password: 'DirectorPass1!' };

const S = { dirCookies: '', tournamentId: null };

function saveState() {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(S)); } catch(e) { console.error('SAVE FAIL:', e.message); }
}

function loadState() {
  try {
    const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    Object.assign(S, data);
    console.log('LOADED STATE:', JSON.stringify(S).substring(0, 100));
  } catch(e) { console.log('LOAD FAIL:', e.message); }
}

loadState();

test.beforeEach(() => {
  console.log('BEFORE_EACH: dirCookies length =', S.dirCookies.length);
  loadState();
  console.log('AFTER_LOAD: dirCookies length =', S.dirCookies.length);
});

test.describe('Setup', () => {
  test('setup - sign up and login', async () => {
    const ctx1 = await request.newContext({ baseURL: BASE });
    await ctx1.post('/api/auth/signup', { data: { email: DIRECTOR.email, password: DIRECTOR.password, firstName: 'T', lastName: 'D' }, headers: { 'Content-Type': 'application/json' }, failOnStatusCode: false });
    await ctx1.dispose();
    
    const ctx2 = await request.newContext({ baseURL: BASE });
    const res = await ctx2.post('/api/auth/login', { data: { email: DIRECTOR.email, password: DIRECTOR.password }, headers: { 'Content-Type': 'application/json' }, failOnStatusCode: false });
    const hdrs = res.headersArray().filter(h => h.name.toLowerCase() === 'set-cookie');
    const cookieStr = hdrs.map(h => h.value.split(';')[0]).join('; ');
    S.dirCookies = cookieStr;
    await ctx2.dispose();
    saveState();
    console.log('Setup done, dirCookies length =', S.dirCookies.length);
    expect(S.dirCookies).toContain('token=');
  });
});

test.describe('Test1', () => {
  test('test using dir cookies', async () => {
    console.log('TEST1: dirCookies length =', S.dirCookies.length);
    expect(S.dirCookies.length).toBeGreaterThan(0);
  });
});

test.afterAll(() => {
  try { fs.unlinkSync(STATE_FILE); } catch {}
});
