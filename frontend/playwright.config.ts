import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 30_000,
  use: { trace: 'retain-on-failure' },
  webServer: [{
    command: 'node scripts/test-backend.mjs',
    url: 'http://localhost:8080/api/health',
    timeout: 60_000,
    reuseExistingServer: false
  }, {
    command: 'node node_modules/vite/bin/vite.js',
    url: 'http://localhost:5173',
    timeout: 30_000,
    reuseExistingServer: false
  }]
});
