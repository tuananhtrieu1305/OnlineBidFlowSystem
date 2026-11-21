import {
  _electron as electron,
  test,
  expect,
  type ElectronApplication,
  type Page
} from '@playwright/test';
import path from 'node:path';
import { stubLivestreamCatalog } from './fixtures/livestream';

let app: ElectronApplication, page: Page;
const products = Array.from({ length: 32 }, (_, i) => ({
  id: String(i + 1),
  name: `Sản phẩm ${String(i + 1).padStart(2, '0')}`,
  description: 'Hàng có sẵn',
  quantity: 1,
  estimatedPrice: String(100 + i),
  imageUrl: null,
  editable: true,
  editBlockedReason: null,
  version: 'v' + (i + 1)
}));

test.beforeEach(async ({}, info) => {
  const env = Object.fromEntries(
    Object.entries(process.env).filter((v): v is [string, string] => v[1] !== undefined)
  );
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_DEV_URL;
  app = await electron.launch({
    args: [path.resolve('.'), `--user-data-dir=${info.outputPath('profile')}`],
    env
  });
  page = await app.firstWindow();
  await stubLivestreamCatalog(page);
  await page.route('**/api/auth/me', (r) =>
    r.fulfill({ json: { id: 1, username: 'admin', role: 'ADMIN' } })
  );
  await page.route('**/api/auth/csrf', (r) => r.fulfill({ json: { token: 'test-create' } }));
  await page.route('**/api/admin/products?*', (r) => {
    const url = new URL(r.request().url());
    expect(url.searchParams.get('availableOnly')).toBe('true');
    const q = url.searchParams.get('q') ?? '';
    const index = Number(url.searchParams.get('page') ?? 0);
    const filtered = products.filter((p) => p.name.includes(q));
    return r.fulfill({
      json: {
        items: filtered.slice(index * 20, index * 20 + 20),
        page: index,
        size: 20,
        totalElements: String(filtered.length),
        totalPages: Math.ceil(filtered.length / 20)
      }
    });
  });
  await page.routeWebSocket('**/ws/livestream', () => {});
  await page.goto('app://auction/#/admin/livestream/new');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Tạo phiên livestream', exact: true })
  ).toBeVisible();
});
test.afterEach(async () => {
  await app?.close();
});
async function open() {
  await page.getByRole('button', { name: '＋ Thêm sản phẩm', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Thêm sản phẩm từ danh mục', exact: true });
  await expect(dialog.getByRole('button', { name: /Sản phẩm 01/ })).toBeVisible();
  return dialog;
}

test('adds several products without moving the catalog/page and preserves order, prices, and form input', async ({}, info) => {
  await page.getByLabel('Tên phiên', { exact: true }).fill('Bộ sưu tập cuối tuần');
  const dialog = await open();
  const geometry = () =>
    dialog.evaluate((e) => {
      const r = e.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, scroll: window.scrollY };
    });
  const before = await geometry();
  for (let i = 1; i <= 5; i++) {
    const button = dialog.getByRole('button', { name: new RegExp(`Sản phẩm 0${i}`) });
    await button.click();
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(await geometry()).toEqual(before);
  }
  await expect(dialog.getByText('Đã thêm 5/30 sản phẩm', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('catalog-batch.png') });
  await dialog.getByLabel('Tìm sản phẩm').fill('Sản phẩm 32');
  await dialog.getByRole('button', { name: /Sản phẩm 32/ }).click();
  await expect(dialog.getByLabel('Tìm sản phẩm')).toHaveValue('Sản phẩm 32');
  expect(await geometry()).toEqual(before);
  await dialog.getByRole('button', { name: 'Xong, xem danh sách', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel('Tên phiên', { exact: true })).toHaveValue('Bộ sưu tập cuối tuần');
  await expect(page.locator('.live-selected-lot')).toHaveCount(6);
  const first = page.locator('.live-selected-lot').first();
  await first.getByRole('textbox').fill('250');
  await first.getByRole('button', { name: 'Xuống', exact: true }).click();
  await expect(page.locator('.live-selected-lot').nth(1).getByRole('textbox')).toHaveValue('250');
  await page
    .locator('.live-selected-lot')
    .first()
    .getByRole('button', { name: 'Bỏ khỏi phiên', exact: true })
    .click();
  await expect(page.locator('.live-selected-lot')).toHaveCount(5);
  const again = await open();
  await expect(again.getByRole('button', { name: /Sản phẩm 01/ })).toBeDisabled();
  await expect(again.getByRole('button', { name: /Sản phẩm 02/ })).toBeEnabled();
  await page.keyboard.press('Escape');
  await page.route('**/api/admin/livestreams', async (r) => {
    const body = r.request().postDataJSON();
    expect(body.title).toBe('Bộ sưu tập cuối tuần');
    expect(body.lots.map((l: any) => l.productId)).toEqual(['1', '3', '4', '5', '32']);
    expect(body.lots[0]).toEqual({ productId: '1', productVersion: 'v1', startingPrice: '250' });
    await r.fulfill({ status: 409, json: { message: 'Kiểm tra dữ liệu thành công' } });
  });
  await page.getByRole('button', { name: 'Lưu phiên livestream', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Kiểm tra dữ liệu thành công');
  await page.screenshot({ path: info.outputPath('selected-products.png') });
});

test('keeps catalog actions visible at small window sizes and enforces thirty distinct products', async () => {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(820, 650));
  const dialog = await open();
  for (let i = 1; i <= 20; i++)
    await dialog
      .getByRole('button', { name: new RegExp(`Sản phẩm ${String(i).padStart(2, '0')}`) })
      .click();
  await dialog.getByRole('button', { name: 'Sau', exact: true }).click();
  for (let i = 21; i <= 30; i++)
    await dialog.getByRole('button', { name: new RegExp(`Sản phẩm ${i}`) }).click();
  await expect(dialog.getByText('Đã thêm 30/30 sản phẩm', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Sản phẩm 31/ })).toBeDisabled();
  const bounds = await dialog.evaluate((e) => {
    const r = e.getBoundingClientRect();
    return {
      top: r.top,
      bottom: r.bottom,
      viewport: innerHeight,
      wide: document.documentElement.scrollWidth > innerWidth
    };
  });
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewport);
  expect(bounds.wide).toBe(false);
  await dialog.getByRole('button', { name: 'Xong, xem danh sách', exact: true }).click();
  const list = page.getByRole('region', { name: 'Sản phẩm đã thêm vào phiên', exact: true });
  expect(await list.evaluate((e) => e.scrollHeight > e.clientHeight)).toBe(true);
  await expect(page.getByRole('button', { name: '＋ Thêm sản phẩm', exact: true })).toBeDisabled();
  await list
    .locator('.live-selected-lot')
    .first()
    .getByRole('button', { name: 'Bỏ khỏi phiên', exact: true })
    .click();
  await expect(page.getByRole('button', { name: '＋ Thêm sản phẩm', exact: true })).toBeEnabled();
});
