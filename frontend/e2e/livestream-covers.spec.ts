import {
  _electron as electron,
  test,
  expect,
  type ElectronApplication,
  type Page
} from '@playwright/test';
import path from 'node:path';
import type { LiveSession, LiveLot } from '../src/features/livestream/liveState';
let app: ElectronApplication, page: Page;
let sessions: LiveSession[];
const remote = 'https://images.unsplash.com/photo-test-lamp?auto=format&fit=crop&w=1200';
function lot(id: string, name: string, imageUrl: string | null): LiveLot {
  return {
    id,
    auctionId: id,
    productId: id,
    name,
    description: '',
    imageUrl,
    startingPrice: '100',
    status: 'UNSOLD',
    currentPrice: '100',
    leaderId: null,
    leaderName: null,
    deadline: null,
    bids: []
  };
}
function session(id: string, title: string, lots: LiveLot[]): LiveSession {
  return {
    id,
    title,
    lots,
    hostId: '1',
    hostName: 'Host',
    description: '',
    startsAt: Date.now(),
    status: 'ENDED',
    version: '1',
    currentLotIndex: 0,
    serverNow: Date.now(),
    publisherReady: false,
    mediaGeneration: '1',
    hostConnectionId: null,
    connections: [],
    remainingMs: null,
    pauseUntil: null,
    participants: [],
    messages: []
  };
}
const picture =
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#dce8df"/><path d="M160 30L110 100H210Z M160 100V165 M110 170H210" fill="#145c53" stroke="#145c53" stroke-width="8"/></svg>';
test.beforeEach(async ({}, info) => {
  const live = session('3', 'Phiên nhiều sản phẩm', [
    lot('31', 'Máy ảnh', '/api/product-images/camera.png'),
    lot('32', 'Sách ảnh', '/api/product-images/book.png')
  ]);
  live.currentLotIndex = 1;
  live.status = 'LIVE';
  sessions = [
    session('1', 'Phiên đèn bàn', [lot('11', 'Desk Lamp', remote)]),
    session('2', 'Phiên bàn phím', [lot('21', 'Bàn phím cơ', '/api/product-images/keyboard.png')]),
    live,
    session('4', 'Phiên chưa có ảnh', [lot('41', 'Chuột không dây', null)]),
    session('5', 'Phiên ảnh bị lỗi', [lot('51', 'Tai nghe', '/api/product-images/broken.png')])
  ];
  const env = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  );
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_DEV_URL;
  app = await electron.launch({
    args: [path.resolve('.'), `--user-data-dir=${info.outputPath('profile')}`],
    env
  });
  page = await app.firstWindow();
  await page.route('**/api/auth/me', (r) => r.fulfill({ status: 401, json: {} }));
  await page.route('**/api/livestreams', (r) => r.fulfill({ json: sessions }));
  await page.route('**/api/livestreams/[1-5]', (r) =>
    r.fulfill({ json: sessions.find((s) => s.id === r.request().url().split('/').pop()) })
  );
  await page.route('https://images.unsplash.com/**', (r) =>
    r.fulfill({ contentType: 'image/svg+xml', body: picture })
  );
  await page.route('**/api/product-images/**', (r) =>
    r.request().url().includes('broken')
      ? r.fulfill({ status: 404, body: '' })
      : r.fulfill({ contentType: 'image/svg+xml', body: picture })
  );
  await page.goto('app://auction/#/livestream');
  await page.reload();
  await expect(page.locator('.live-session-card')).toHaveCount(5);
});
test.afterEach(async () => {
  await app?.close();
});
function card(title: string) {
  return page
    .locator('.live-session-card')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
}

test('uses actual product sources on cards, including the current lot and the existing image CDN', async () => {
  for (const [title, name, source] of [
    ['Phiên đèn bàn', 'Desk Lamp', remote],
    ['Phiên bàn phím', 'Bàn phím cơ', '/api/product-images/keyboard.png'],
    ['Phiên nhiều sản phẩm', 'Sách ảnh', '/api/product-images/book.png']
  ]) {
    const img = card(title).getByRole('img', { name, exact: true });
    await img.scrollIntoViewIfNeeded();
    await expect(img).toHaveAttribute(
      'src',
      source.startsWith('/') ? 'http://localhost:8080' + source : source
    );
    await expect.poll(() => img.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBe(320);
    expect(await img.evaluate((node) => getComputedStyle(node).objectFit)).toBe('contain');
  }
  await expect(page.getByAltText('Ảnh minh họa phòng livestream')).toHaveCount(0);
});
test('uses the same product image on session details and shows an honest fallback for missing or broken photos', async () => {
  await expect(
    card('Phiên chưa có ảnh').getByText('Chưa có ảnh sản phẩm', { exact: true })
  ).toBeVisible();
  await card('Phiên ảnh bị lỗi').scrollIntoViewIfNeeded();
  await expect(
    card('Phiên ảnh bị lỗi').getByText('Không tải được ảnh sản phẩm', { exact: true })
  ).toBeVisible();
  await card('Phiên đèn bàn').getByRole('link', { name: 'Xem phiên', exact: true }).click();
  const img = page.locator('.live-product-stage > img');
  await expect(img).toHaveAttribute('src', remote);
  await expect(img).toHaveAttribute('alt', 'Desk Lamp');
  await expect.poll(() => img.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBe(320);
  expect(await img.evaluate((node) => getComputedStyle(node).objectFit)).toBe('contain');
  await expect(page.getByAltText('Ảnh minh họa chủ phiên giới thiệu máy ảnh')).toHaveCount(0);
});
