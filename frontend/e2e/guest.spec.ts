import { _electron as electron, expect, test } from '@playwright/test';
import path from 'node:path';

test('guest discovers the app and can register without diagnostic screens', async ({}, info) => {
  const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_DEV_URL;
  const app = await electron.launch({ args: [path.resolve('.'), `--user-data-dir=${info.outputPath('profile')}`], env });
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: 'Món đồ đặc biệt. Lựa chọn của bạn.' })).toBeVisible();
    await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: { code: 'UNAUTHENTICATED' } }));
    await page.route('**/api/discovery/auctions?*', route => route.fulfill({ json: { items: [], page: 0, totalPages: 0, totalElements: '0' } }));
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Món đồ đặc biệt. Lựa chọn của bạn.' })).toBeVisible();
    const sidebar = page.getByRole('complementary');
    await expect(sidebar.getByRole('link', { name: 'Đăng nhập', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Tạo tài khoản' })).toBeVisible();
    await expect(page.getByText('Chưa có phiên phù hợp', { exact: true })).toBeVisible();
    await expect(page.getByText('Check server connection')).toHaveCount(0);
    await page.screenshot({ path: info.outputPath('guest-home.png'), fullPage: true });
    await sidebar.getByRole('link', { name: 'Tạo tài khoản' }).click();
    await expect(page.getByRole('heading', { name: 'Bắt đầu bộ sưu tập của bạn.' })).toBeVisible();
    await page.getByRole('link', { name: 'Về trang chủ' }).click();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Món đồ đặc biệt. Lựa chọn của bạn.' })).toBeVisible();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(820, 650));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(sidebar.getByRole('link', { name: 'Tạo tài khoản' })).toBeInViewport();
    await page.goto('app://auction/#/api-test');
    await expect(page.getByRole('region', { name: 'REST API', exact: true })).toHaveCount(0);
  } finally { await app.close(); }
});
