import type { Page } from '@playwright/test';

// Existing UI tests mock authentication. Keep the new application-wide catalog
// requests in that same fixture so an unrelated running backend cannot log out
// those synthetic sessions. The livestream integration suite uses real APIs.
export async function stubLivestreamCatalog(page: Page) {
  await page.route('**/api/livestreams/state', route => route.fulfill({ json: {
    sessions: [], orders: [], wallet: null, registrations: [], notifications: [], serverNow: Date.now()
  } }));
  await page.route('**/api/livestreams', route => route.fulfill({ json: [] }));
}
