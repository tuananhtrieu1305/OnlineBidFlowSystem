import {
  _electron as electron,
  test,
  expect,
  type ElectronApplication,
  type Page
} from '@playwright/test';
import path from 'node:path';
import type { LiveLot, LiveSession } from '../src/features/livestream/liveState';
let app: ElectronApplication, page: Page, sessions: LiveSession[];
function lot(
  id: string,
  name: string,
  status: LiveLot['status'],
  amount: string,
  leader: string | null = null
): LiveLot {
  return {
    id,
    auctionId: id,
    productId: id,
    name,
    description: '',
    imageUrl: '/api/product-images/' + id + '.png',
    startingPrice: '100',
    status,
    currentPrice: amount,
    leaderId: leader ? '2' : null,
    leaderName: leader,
    deadline: null,
    bids: []
  };
}
function session(
  id: string,
  title: string,
  status: LiveSession['status'],
  lots: LiveLot[]
): LiveSession {
  return {
    id,
    title,
    status,
    lots,
    description: '',
    hostId: '1',
    hostName: 'Mai Anh',
    startsAt: Date.now(),
    version: '1',
    serverNow: Date.now(),
    currentLotIndex: 0,
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
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="100"><rect x="10" y="25" width="100" height="50" rx="8" fill="#a9c1b1"/><path d="M25 40H95M25 55H95" stroke="#145c53" stroke-width="6"/></svg>';
test.beforeEach(async ({}, info) => {
  sessions = [
    session('101', 'Phiên đã kết thúc', 'ENDED', [
      lot('11', 'Bàn phím cơ', 'SOLD', '137', 'Minh Anh'),
      lot('12', 'Máy ảnh', 'SOLD', '250', 'Lan Ngọc'),
      { ...lot('13', 'Chuột không dây', 'UNSOLD', '88', 'Người dẫn cũ'), startingPrice: '50' }
    ]),
    session('102', 'Phiên sắp diễn ra', 'SCHEDULED', [lot('21', 'Tai nghe', 'QUEUED', '100')]),
    session('103', 'Phiên đang live', 'LIVE', [
      lot('31', 'Đèn bàn', 'OPEN', '150', 'Người đang dẫn')
    ]),
    session('104', 'Phiên tạm dừng', 'PAUSED', [
      lot('41', 'Đồng hồ', 'OPEN', '150', 'Người đang dẫn')
    ])
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
  await page.route('**/api/auth/me', (r) =>
    r.fulfill({ json: { id: 1, username: 'Mai Anh', role: 'ADMIN' } })
  );
  await page.route('**/api/livestreams/state', (r) =>
    r.fulfill({
      json: {
        sessions,
        wallet: null,
        orders: [],
        registrations: [],
        notifications: [],
        serverNow: Date.now()
      }
    })
  );
  await page.route(/\/api\/livestreams\/[0-9]+$/, (r) =>
    r.fulfill({ json: sessions.find((s) => s.id === r.request().url().split('/').pop()) })
  );
  await page.route('**/api/product-images/**', (r) =>
    r.fulfill({ contentType: 'image/svg+xml', body: picture })
  );
  await page.routeWebSocket('**/ws/livestream', (ws) => {
    ws.send(JSON.stringify({ type: 'WELCOME', connectionId: 'admin-fixture' }));
  });
  await page.goto('app://auction/#/admin/livestream');
  await page.reload();
  await expect(page.locator('.live-admin-table > article')).toHaveCount(4);
});
test.afterEach(async () => {
  await app?.close();
});
function row(title: string) {
  return page
    .locator('.live-admin-table > article')
    .filter({ has: page.getByText(title, { exact: true }) });
}
async function openResults(title = 'Phiên đã kết thúc') {
  await row(title).getByRole('link', { name: 'Kết quả', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

test('ended sessions expose results only, while scheduled/live/paused sessions retain host controls', async () => {
  await expect(row('Phiên đã kết thúc').getByRole('link')).toHaveCount(1);
  await expect(
    row('Phiên đã kết thúc').getByRole('link', { name: 'Kết quả', exact: true })
  ).toHaveAttribute('href', '#/admin/livestream/101/results');
  await expect(page.getByRole('link', { name: 'Xem phiên', exact: true })).toHaveCount(0);
  for (const title of ['Phiên sắp diễn ra', 'Phiên đang live', 'Phiên tạm dừng'])
    await expect(row(title).getByRole('link', { name: 'Điều khiển', exact: true })).toBeVisible();
});

test('shows sold-only totals, correct winners, product photos, and working filters in a responsive results report', async ({}, info) => {
  await openResults();
  await expect(
    page.getByRole('article', { name: 'Tổng sản phẩm', exact: true }).locator('strong')
  ).toHaveText('3');
  await expect(
    page.getByRole('article', { name: 'Đã bán', exact: true }).locator('strong')
  ).toHaveText('2');
  await expect(
    page.getByRole('article', { name: 'Chưa bán', exact: true }).locator('strong')
  ).toHaveText('1');
  await expect(
    page.getByRole('article', { name: 'Tổng Coin chốt', exact: true }).locator('strong')
  ).toHaveText('387 Coin');
  const table = page.getByRole('table');
  const unsold = table.getByRole('row').filter({ hasText: 'Chuột không dây' });
  await expect(unsold.getByRole('cell').nth(2)).toHaveText('—');
  await expect(unsold.getByRole('cell').nth(3)).toHaveText('—');
  await expect(table.getByText('Người dẫn cũ', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Minh Anh', exact: true })).toHaveAttribute(
    'href',
    '#/admin/users/2'
  );
  await expect(page.getByRole('link', { name: 'Điều khiển phiên', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '← Danh sách phiên', exact: true })).toBeVisible();
  const img = table.getByRole('img', { name: 'Bàn phím cơ', exact: true });
  await img.scrollIntoViewIfNeeded();
  await expect.poll(() => img.evaluate((e: HTMLImageElement) => e.naturalWidth)).toBe(120);
  await page.screenshot({ path: info.outputPath('results-report.png'), fullPage: true });
  await page.getByRole('button', { name: 'Chưa bán (1)', exact: true }).click();
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table.getByText('Chuột không dây', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Đã bán (2)', exact: true }).click();
  await expect(table.locator('tbody tr')).toHaveCount(2);
  await page.getByLabel('Tìm sản phẩm hoặc người thắng', { exact: true }).fill('Minh Anh');
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table.getByText('Bàn phím cơ', { exact: true })).toBeVisible();
  await page.getByLabel('Tìm sản phẩm hoặc người thắng', { exact: true }).fill('Không tồn tại');
  await expect(page.getByText('Không có sản phẩm phù hợp', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click();
  await expect(table.locator('tbody tr')).toHaveCount(3);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(820, 650));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    await page
      .getByRole('region', { name: 'Bảng kết quả sản phẩm', exact: true })
      .evaluate((e) => getComputedStyle(e).overflowX)
  ).toBe('auto');
});

test('keeps active leaders out of final results and preserves exact large Coin totals', async () => {
  await openResults('Phiên đang live');
  await expect(
    page.getByRole('article', { name: 'Đã bán', exact: true }).locator('strong')
  ).toHaveText('0');
  await expect(
    page.getByRole('article', { name: 'Chưa bán', exact: true }).locator('strong')
  ).toHaveText('0');
  await expect(
    page.getByText('Kết quả tạm thời · Còn 1 sản phẩm chưa chốt.', { exact: true })
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Điều khiển phiên', exact: true })).toHaveAttribute(
    'href',
    '#/admin/livestream/103'
  );
  await expect(page.getByRole('table').getByText('Người đang dẫn', { exact: true })).toHaveCount(0);
  sessions[0].version = '2';
  sessions[0].lots[1].currentPrice = '9007199254740993';
  await page.getByRole('link', { name: '← Danh sách phiên', exact: true }).click();
  await openResults();
  await expect(
    page.getByRole('article', { name: 'Tổng Coin chốt', exact: true }).locator('strong')
  ).toHaveText('9.007.199.254.741.130 Coin');
});
