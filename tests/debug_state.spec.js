const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '.debug-state.json');
const S = { dirCookies: '', val: '' };

function saveState() { fs.writeFileSync(STATE_FILE, JSON.stringify(S)); }
function loadState() {
  try { const d = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); Object.assign(S, d); } catch {}
}
loadState();

test.beforeEach(() => { loadState(); });

test.describe('A', () => {
  test('a1 sets dirCookies', () => {
    S.dirCookies = 'valid_token_here';
    S.val = 'hello';
    saveState();
    console.log('A.a1: saved S.dirCookies =', S.dirCookies.substring(0, 15));
  });
});

test.describe('B', () => {
  test('b1 reads dirCookies', () => {
    console.log('B.b1: S.dirCookies =', S.dirCookies.substring(0, 15));
    expect(S.dirCookies).toBe('valid_token_here');
  });
  test('b2 reads val', () => {
    console.log('B.b2: S.val =', S.val);
    expect(S.val).toBe('hello');
  });
});

test.afterAll(() => { try { fs.unlinkSync(STATE_FILE); } catch {} });
