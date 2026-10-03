import { defineConfig } from '@playwright/test';

// Real Spring Boot + isolated MySQL, one worker to avoid shared rate-limit/fixture races.
export default defineConfig({
  testDir: './e2e',
  testMatch: ['registration-live.spec.ts', 'login-live.spec.ts', 'products-live.spec.ts',
    'auctions-live.spec.ts', 'admin-users-live.spec.ts', 'system-wallet-live.spec.ts',
    'phase2-demo-live.spec.ts', 'discovery-live.spec.ts'],
  outputDir: './test-results/tien-live',
  workers: 1,
  timeout: 60_000,
  use: { trace: 'retain-on-failure' },
  webServer: {
    command: 'node scripts/registration-test-backend.mjs',
    url: 'http://localhost:18080/api/health',
    timeout: 60_000,
    reuseExistingServer: false,
    env: { APP_REGISTRATION_ATTEMPTS_PER_MINUTE: '100', APP_LOGIN_ATTEMPTS_PER_MINUTE: '100' }
  }
});
