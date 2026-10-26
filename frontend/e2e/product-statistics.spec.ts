import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import path from 'node:path';

let app: ElectronApplication;
test.afterEach(async () => { await app?.close(); });

test('admin sees product statistics and can page through finished auctions', async ({}, info) => {
  const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string,string] => entry[1] !== undefined));
  delete env.ELECTRON_RUN_AS_NODE; delete env.ELECTRON_DEV_URL;
  app = await electron.launch({ args: [path.resolve('.'), `--user-data-dir=${info.outputPath('profile')}`], env });
  const page = await app.firstWindow();
  await page.route('**/api/auth/me', route => route.fulfill({ json: { id: 1, username: 'admin', role: 'ADMIN' } }));
  await page.route('**/api/admin/products/25', route => route.fulfill({ json: {
    id: '25', name: 'Máy ảnh Canon AE-1', description: 'Máy ảnh phim.', quantity: 1,
    estimatedPrice: '2500', imageUrl: null, editable: false, editBlockedReason: 'PRODUCT_IN_USE', version: '"v1"'
  } }));
  await page.route('**/api/admin/products/25/statistics?*', route => {
    const currentPage = Number(new URL(route.request().url()).searchParams.get('page'));
    return route.fulfill({ json: {
      counts: { total: 4, upcoming: 1, running: 0, sold: 2, unsold: 1 },
      byType: [{ type: 'NORMAL', total: 2, sold: 1, unsold: 1, averagePrice: '2700' },
        { type: 'BLIND', total: 2, sold: 1, unsold: 0, averagePrice: '3300' }],
      prices: { soldCount: 2, average: '3000', median: null, minimum: '2700', maximum: '3300', latest: '3300' },
      trend: [{ id: '42', type: 'BLIND', finishedAt: '2026-07-01T10:00:00Z', winningPrice: '3300' },
        { id: '41', type: 'NORMAL', finishedAt: '2026-06-01T10:00:00Z', winningPrice: '2700' }],
      history: { items: currentPage === 0
        ? [{ id: '42', type: 'BLIND', status: 'SOLD', finishedAt: '2026-07-01T10:00:00Z', winningPrice: '3300' }]
        : [{ id: '43', type: 'NORMAL', status: 'UNSOLD', finishedAt: '2026-08-01T10:00:00Z', winningPrice: null }],
        page: currentPage, size: 10, totalElements: 3, totalPages: 2 }
    } });
  });
  await page.goto('app://auction/#/admin/products/25');
  await expect(page.getByRole('heading', { name: 'Thống kê sản phẩm' })).toBeVisible();
  await expect(page.getByText('67%', { exact: true })).toBeVisible();
  await expect(page.getByText('+500 Coin', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Phiên #42, Đấu giá mù/ })).toBeVisible();
  await page.getByRole('button', { name: 'Trang sau' }).click();
  await expect(page.getByRole('cell', { name: '#43' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Chưa bán được' })).toBeVisible();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(820, 650));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
