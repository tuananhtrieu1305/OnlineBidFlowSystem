import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'auctions-live.spec.ts',workers:1,timeout:60000,use:{trace:'retain-on-failure'},
 webServer:{command:'node scripts/registration-test-backend.mjs',url:'http://localhost:18080/api/health',timeout:60000,reuseExistingServer:false}});
