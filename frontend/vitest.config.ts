import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/api/server-config.ts', 'electron/asset-path.ts', 'src/features/auth/validation.ts', 'src/features/auth/api/sessionApi.ts', 'src/features/wallet/validation.ts', 'src/features/products/validation.ts', 'src/features/auctions/configuration/validation.ts', 'src/features/admin/system-wallet/filters.ts'],
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 }
    }
  }
});
