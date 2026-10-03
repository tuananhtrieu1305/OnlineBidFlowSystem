import { _electron as electron, expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

test('guest discovers an API-created public auction and cannot open its private sibling', async ({ request }, info) => {
  if (process.env.REGISTRATION_TEST_DATABASE !== 'true' || process.env.DB_PORT !== '33308') {
    throw new Error('Isolated test database required');
  }
  const output = execFileSync(process.execPath, ['scripts/create-phase2-demo.mjs'], {
    encoding: 'utf8', env: process.env
  });
  const manifest = output.match(/Demo ready: (.+)/)?.[1]?.trim();
  expect(manifest).toBeTruthy();
  const fixture = JSON.parse(readFileSync(manifest!, 'utf8'));
  expect(fixture.state).toBe('ready');
  const publicAuction = fixture.auctions.find((a: { access: string }) => a.access === 'PUBLIC');
  const privateAuction = fixture.auctions.find((a: { access: string }) => a.access === 'PRIVATE');
  const env = Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined));
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_DEV_URL;
  const app = await electron.launch({ args: [path.resolve('.'), `--user-data-dir=${info.outputPath('profile')}`], env });
  try {
    const page = await app.firstWindow();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('app://auction/#/');
    await page.getByLabel('Tìm sản phẩm', { exact: true }).fill(fixture.prefix);
    const cards = page.locator('.discovery-card');
    await expect(cards).toHaveCount(1);
    await expect(cards).toContainText('#' + publicAuction.id);
    await expect(cards).toContainText('1.000 Coin');
    await page.getByRole('combobox', { name: 'Loại đấu giá', exact: true }).selectOption('BLIND');
    await expect(page.getByText('Chưa có phiên phù hợp', { exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: 'Loại đấu giá', exact: true }).selectOption('NORMAL');
    await page.getByRole('link', { name: 'Xem phiên ' + fixture.products[0].name, exact: true }).click();
    await expect(page.getByRole('heading', { name: fixture.products[0].name, exact: true })).toBeVisible();
    await expect(page.getByText('Dữ liệu demo riêng, không dùng ví seed cũ.', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('Chức năng tham gia phòng và trả giá chưa được mở.')).toBeVisible();
    await expect(page.getByText('2.500 Coin', { exact: true })).toHaveCount(0);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(820, 650));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('public-discovery-detail.png'), fullPage: true });
    await page.goto('app://auction/#/auctions/' + privateAuction.id);
    await expect(page.getByRole('alert')).toContainText('Phiên không tồn tại hoặc không được công khai.');
    expect((await request.get('http://localhost:18080/api/admin/auctions')).status()).toBe(401);
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
