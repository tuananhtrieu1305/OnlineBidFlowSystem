import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testIgnore: 'registration-live.spec.ts',
  workers: 1,
  timeout: 30_000,
  use: { trace: 'retain-on-failure' },
  webServer: [{
    command: 'node scripts/test-backend.mjs',
    url: 'http://localhost:8080/api/health',
    timeout: 60_000,
    reuseExistingServer: process.env.E2E_USE_RUNNING_SERVERS === 'true'
  }, {
    command: 'node node_modules/vite/bin/vite.js',
    url: 'http://localhost:5173',
    timeout: 30_000,
    reuseExistingServer: process.env.E2E_USE_RUNNING_SERVERS === 'true'
  }]
});
