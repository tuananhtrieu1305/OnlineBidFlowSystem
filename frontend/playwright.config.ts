import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['registration-live.spec.ts', 'login-live.spec.ts', 'products-live.spec.ts', 'auctions-live.spec.ts', 'admin-users-live.spec.ts', 'system-wallet-live.spec.ts', 'phase2-demo-live.spec.ts'],
  workers: 1,
  timeout: 30_000,
  use: { trace: 'retain-on-failure' },
  webServer: [{
    command: 'node node_modules/vite/bin/vite.js',
    url: 'http://localhost:5173',
    timeout: 30_000,
    reuseExistingServer: process.env.E2E_USE_RUNNING_SERVERS === 'true'
  }]
});
