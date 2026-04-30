require('dotenv').config();
const { defineConfig } = require('@playwright/test');
const path = require('path');
module.exports = defineConfig({
  testDir: path.join(__dirname),
  testMatch: 'phase6-storage-hardening.spec.js',
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:3000' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  outputDir: path.join(__dirname, '..', 'test-results'),
});
