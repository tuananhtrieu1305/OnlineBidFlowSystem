import { _electron as electron, expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

test('guest discovers an API-created public auction, sees its timed start and cannot open its private sibling', async ({ request, playwright }, info) => {
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
  const admin = await playwright.request.newContext({baseURL:'http://localhost:18080'});
  try {
    const token = (await (await admin.get('/api/auth/csrf')).json()).token;
    expect((await admin.post('/api/auth/login',{headers:{'X-CSRF-TOKEN':token},data:{username:fixture.accounts[0].username,password:process.env.DEMO_PASSWORD}})).ok()).toBe(true);
    const current = await (await admin.get('/api/admin/auctions/'+publicAuction.id)).json();
    const nextToken = (await (await admin.get('/api/auth/csrf')).json()).token;
    expect((await admin.put('/api/admin/auctions/'+publicAuction.id,{headers:{'X-CSRF-TOKEN':nextToken,'If-Match':current.version},data:{auctionType:'NORMAL',accessType:'PUBLIC',startingPrice:current.startingPrice,minBidIncrement:current.minBidIncrement,maxParticipants:null,startTime:new Date(Date.now()+8_000).toISOString(),endTime:new Date(Date.now()+180_000).toISOString()}})).ok()).toBe(true);
  } finally { await admin.dispose(); }
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
    await expect(cards).toContainText('Sắp diễn ra');
    // No reload or mocked response: the real scheduler and visible-view refresh must agree.
    await expect(cards).toContainText('Đang diễn ra',{timeout:20_000});
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
