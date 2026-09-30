import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './e2e', testMatch: ['guest.spec.ts', 'registration.spec.ts', 'login.spec.ts', 'desktop.spec.ts'], workers: 1, timeout: 30_000, use: { trace: 'retain-on-failure' } });
