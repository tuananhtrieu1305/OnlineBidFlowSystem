import { _electron as electron, expect, test, type Page, type TestInfo } from '@playwright/test';
import path from 'node:path';

// Client contract tests. The backend separately verifies these endpoints against SQL in NormalApiTest.
async function mockApi(page: Page, privateJoined = true) {
  let loggedIn = false;
  let joined = privateJoined;
  let publicJoined = false;
  let price = 2500;
  let available = 4400;
  let offline = false;
  let publishPrice = () => {};
  const product = { id: 2, name: 'Mechanical Keyboard', description: 'Bàn phím cơ vỏ nhôm.', quantity: 5, imageUrl: null };
  const baseBids = [{ id: 11, userId: 2, username: 'alice', amount: 2500, createdAt: new Date().toISOString() }];
  const bids = [...baseBids];
  const detail = () => ({ id: 5, product, access: 'PRIVATE', status: 'RUNNING', startingPrice: 2000, increment: 150,
    startsAt: new Date(Date.now() - 60_000).toISOString(), endsAt: new Date(Date.now() + 900_000).toISOString(),
    finishedAt: null, currentPrice: price, leader: bids[bids.length - 1], bids, winner: null, winningPrice: null, joined, serverTime: new Date().toISOString() });
  const publicDetail = () => ({ ...detail(), id: 6, access: 'PUBLIC', status: 'UPCOMING', joined: publicJoined,
    product: { id: 3, name: 'Wireless Headphones', description: 'Tai nghe không dây chống ồn.', quantity: 4, imageUrl: 'https://images.unsplash.com/photo-normal-headphones' },
    startingPrice: 1500, increment: 100, currentPrice: 1500, bids: [], leader: null,
    startsAt: new Date(Date.now() + 3600_000).toISOString(), endsAt: new Date(Date.now() + 7200_000).toISOString() });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const headers = { 'content-type': 'application/json', 'access-control-allow-origin': request.headers().origin ?? 'app://auction',
      'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'x-csrf-token,content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
    const reply = (status: number, body: unknown) => route.fulfill({ status, headers, body: JSON.stringify(body) });
    if (request.method() === 'OPTIONS') return reply(200, {});
    if (pathname.endsWith('/auth/csrf')) return reply(200, { token: 'csrf-test' });
    if (pathname.endsWith('/auth/login')) {
      expect(request.headers()['x-csrf-token']).toBe('csrf-test');
      if (request.postDataJSON().password !== 'Password@123') return reply(401, { code: 'INVALID_CREDENTIALS' });
      loggedIn = true; return reply(200, { id: 2, username: 'alice', role: 'USER' });
    }
    if (pathname.endsWith('/auth/logout')) { loggedIn = false; return route.fulfill({ status: 204, headers }); }
    if (!loggedIn) return reply(401, { code: 'UNAUTHENTICATED' });
    if (pathname.endsWith('/auth/me')) return reply(200, { id: 2, username: 'alice', role: 'USER' });
    if (offline) return reply(503, { message: 'Server tạm thời không truy cập được.' });
    const wallet = () => ({ walletId: '2', availableBalance: String(available), lockedBalance: String(4100 + (4400 - available)), updatedAt: new Date().toISOString() });
    if (pathname.endsWith('/wallet')) return reply(200, wallet());
    if (request.method() === 'POST') expect(request.headers()['x-csrf-token']).toBe('csrf-test');
    if (pathname.endsWith('/auctions')) return reply(200, [{ ...detail(), bids: undefined, leader: undefined }, { ...publicDetail(), bids: undefined, leader: undefined }]);
    if (pathname.endsWith('/auctions/6')) return reply(200, publicDetail());
    if (pathname.endsWith('/auctions/6/join')) { publicJoined = true; return reply(200, publicDetail()); }
    if (pathname.endsWith('/join')) {
      if (request.postDataJSON().roomCode !== 'KEYROOM') return reply(403, { message: 'Mã phòng không đúng.' });
      joined = true;
      return reply(200, detail());
    }
    if (pathname.endsWith('/bids') && request.method() === 'POST') {
      const amount = request.postDataJSON().amount;
      if (!joined) return reply(403, { message: 'Bạn cần tham gia phiên trước khi đặt giá.' });
      if (amount < price + 150) return reply(409, { message: 'Mức giá chưa đạt giá hiện tại cộng bước giá tối thiểu.' });
      if (amount - price > available) return reply(409, { message: 'Coin khả dụng không đủ cho mức giá này.' });
      available -= amount - price;
      price = amount;
      bids.push({ id: 12, userId: 2, username: 'alice', amount, createdAt: new Date().toISOString() });
      return reply(201, { auction: detail(), wallet: wallet() });
    }
    if (!joined) return reply(403, { message: 'Bạn cần nhập mã phòng.' });
    return reply(200, detail());
  });
  await page.routeWebSocket('**/ws/auction', socket => {
    publishPrice = () => socket.send(JSON.stringify({ type: 'NORMAL_PRICE_UPDATED', auctionId: 5, payload: {} }));
    socket.onMessage(raw => {
      const value = JSON.parse(String(raw));
      if (value.type === 'JOIN_ROOM') {
        if (value.payload.roomCode !== 'KEYROOM') {
          socket.send(JSON.stringify({ type: 'ERROR', requestId: value.requestId, payload: { code: 'ROOM_CODE_REQUIRED', message: 'Room code is required.' } }));
        } else socket.send(JSON.stringify({ type: 'AUCTION_STATE', auctionId: 5, payload: { chatHistory: [] } }));
      }
      if (value.type === 'SEND_CHAT_MESSAGE') socket.send(JSON.stringify({ type: 'CHAT_MESSAGE', requestId: value.requestId, auctionId: 5,
        payload: { messageId: 1, auctionId: 5, username: 'alice', content: value.payload.content, sentAt: new Date().toISOString() } }));
    });
  });
  return { goOffline: () => { offline = true; }, outbid: () => {
    price = 2800; available = 6900;
    bids.push({ id: 13, userId: 7, username: 'fiona', amount: 2800, createdAt: new Date().toISOString() });
    publishPrice();
  } };

}

async function launch(testInfo: TestInfo) {
  const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_DEV_URL;
  return electron.launch({ args: [path.resolve('.'), `--user-data-dir=${testInfo.outputPath('profile')}`], env });
}

test('NORMAL uses authenticated API balances, handles rejected bid, network failure and logout', async ({}, testInfo) => {
  const app = await launch(testInfo);
  try {
    const page = await app.firstWindow();
    const api = await mockApi(page);
    await page.goto('app://auction/#/normal');
    await page.reload();
    await page.getByLabel('Tên đăng nhập', { exact: true }).fill('alice');
    await page.getByLabel('Mật khẩu', { exact: true }).fill('wrong');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(page.getByText('Tên đăng nhập hoặc mật khẩu không đúng.')).toBeVisible();
    await page.getByLabel('Mật khẩu', { exact: true }).fill('Password@123');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await page.getByRole('article', { name: 'Phiên #5 · Mechanical Keyboard', exact: true }).getByRole('button', { name: 'Vào phòng' }).click();
    await page.getByLabel('Mã phòng', { exact: true }).fill('KEYROOM');
    await page.getByRole('button', { name: 'Tham gia phiên', exact: true }).click();
    await expect(page.getByTestId('normal-current-price')).toHaveText('2.500 Coin');
    const amount = page.getByLabel('Mức giá của bạn (Coin)', { exact: true });
    await amount.fill('2500');
    await page.getByRole('button', { name: 'Đặt giá', exact: true }).click();
    await expect(page.getByText('Mức giá chưa đạt giá hiện tại cộng bước giá tối thiểu.')).toBeVisible();
    await expect(page.getByTestId('normal-available')).toHaveText('4.400 Coin');
    await expect(page.getByRole('button', { name: 'Đặt giá', exact: true })).toBeEnabled({ timeout: 10_000 });
    await amount.fill('2650');
    await page.getByRole('button', { name: 'Đặt giá', exact: true }).click();
    await expect(page.getByTestId('normal-current-price')).toHaveText('2.650 Coin');
    await expect(page.getByTestId('normal-available')).toHaveText('4.250 Coin');
    await expect(page.getByText('Server đã ghi nhận mức giá 2.650 Coin.')).toBeVisible();
    api.goOffline();
    await expect(page.getByText('Server tạm thời không truy cập được.')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Đặt giá', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
    await page.goto('app://auction/#/normal');
    await expect(page.getByRole('heading', { name: 'Chào mừng bạn trở lại.' })).toBeVisible();
    await expect(page.getByTestId('normal-current-price')).toHaveCount(0);
  } finally { await app.close(); }
});

test('NORMAL requires private room code before showing bids', async ({}, testInfo) => {
  const app = await launch(testInfo);
  try {
    const page = await app.firstWindow();
    const api = await mockApi(page, false);
    await page.goto('app://auction/#/normal');
    await page.reload();
    await page.getByLabel('Tên đăng nhập', { exact: true }).fill('alice');
    await page.getByLabel('Mật khẩu', { exact: true }).fill('Password@123');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByTestId('normal-product-panel')).toHaveCount(0);
    await page.getByRole('article', { name: 'Phiên #5 · Mechanical Keyboard', exact: true }).getByRole('button', { name: 'Vào phòng' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel('Mã phòng', { exact: true })).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Tham gia phiên', exact: true })).toBeEnabled();
    await page.getByLabel('Mã phòng', { exact: true }).fill('wrong');
    await page.getByRole('button', { name: 'Tham gia phiên', exact: true }).click();
    await expect(page.getByText('Mã phòng không đúng.')).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Tham gia phiên', exact: true })).toBeEnabled({ timeout: 10_000 });
    await page.getByLabel('Mã phòng', { exact: true }).fill('KEYROOM');
    await page.getByRole('button', { name: 'Tham gia phiên', exact: true }).click();
    await expect(page.getByRole('table')).toContainText('2.500 Coin');
    await expect(page.getByRole('button', { name: 'Đặt giá', exact: true })).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath('normal-integrated.png'), fullPage: true });
    await expect(page.getByLabel('Tin nhắn', { exact: true })).toBeEnabled();
    await page.getByLabel('Tin nhắn', { exact: true }).fill('Chào mọi người');
    await page.getByRole('button', { name: 'Gửi', exact: true }).click();
    await expect(page.getByRole('log')).toContainText('Chào mọi người');
    api.outbid();
    await expect(page.getByTestId('normal-current-price')).toHaveText('2.800 Coin', { timeout: 2000 });
    await expect(page.getByTestId('normal-available')).toHaveText('6.900 Coin', { timeout: 2000 });

    await page.screenshot({ path: testInfo.outputPath('normal-integrated.png'), fullPage: true });
  } finally { await app.close(); }
});

test('selecting rooms shows matching product images and aligns the desktop panels', async ({}, testInfo) => {
  const app = await launch(testInfo);
  try {
    const page = await app.firstWindow();
    await mockApi(page, false);
    await page.route('https://images.unsplash.com/photo-normal-headphones', route => route.fulfill({
      contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="#dce6df"/><path d="M140 210v-40a100 100 0 0 1 200 0v40" fill="none" stroke="#145c53" stroke-width="20"/><rect x="120" y="175" width="55" height="95" rx="20" fill="#145c53"/><rect x="305" y="175" width="55" height="95" rx="20" fill="#145c53"/></svg>'
    }));
    await page.goto('app://auction/#/normal'); await page.reload();
    await page.getByLabel('Tên đăng nhập', { exact: true }).fill('alice');
    await page.getByLabel('Mật khẩu', { exact: true }).fill('Password@123');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    const publicCard = page.getByRole('article', { name: 'Phiên #6 · Wireless Headphones', exact: true });
    await expect(publicCard.getByRole('img')).toBeVisible();
    await page.getByRole('group', { name: 'Loại truy cập', exact: true }).getByRole('button', { name: 'PRIVATE', exact: true }).click();
    await expect(publicCard).toHaveCount(0);
    await expect(page.getByRole('article')).toHaveCount(1);
    await page.getByRole('group', { name: 'Loại truy cập', exact: true }).getByRole('button', { name: 'Tất cả', exact: true }).click();
    await page.getByLabel('Tìm kiếm sản phẩm').fill('Headphones');
    await expect(page.getByRole('article')).toHaveCount(1);
    await page.getByLabel('Tìm kiếm sản phẩm').fill('');
    await page.screenshot({ path: testInfo.outputPath('normal-catalog.png'), fullPage: true });
    await publicCard.getByRole('button', { name: 'Vào phòng' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(/#\/normal\/6$/);
    await expect(page.getByRole('heading', { name: 'Tham gia phiên #6', exact: true })).toHaveCount(0);
    const productPanel = page.getByTestId('normal-product-panel');
    await expect(productPanel.getByRole('heading')).toHaveText('Wireless Headphones');
    await expect(productPanel).toContainText('Tai nghe không dây chống ồn.');
    const image = productPanel.getByRole('img', { name: 'Wireless Headphones' });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByText('Phiên chưa bắt đầu. Bạn có thể đặt giá khi đến giờ mở phiên.')).toBeVisible();
    const left = await productPanel.boundingBox();
    const right = await page.getByTestId('normal-session-column').boundingBox();
    expect(Math.abs(left!.y - right!.y)).toBeLessThan(1);
    expect(Math.abs(left!.y + left!.height - right!.y - right!.height)).toBeLessThan(1);
    await page.screenshot({ path: testInfo.outputPath('normal-room-layout.png'), fullPage: true });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(820, 800));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('link', { name: '← Danh sách sản phẩm' }).click();
    await page.getByRole('article', { name: 'Phiên #5 · Mechanical Keyboard', exact: true }).getByRole('button', { name: 'Vào phòng' }).click();
    await page.getByLabel('Mã phòng', { exact: true }).fill('KEYROOM');
    await page.getByRole('button', { name: 'Tham gia phiên', exact: true }).click();
    await expect(productPanel.getByRole('heading')).toHaveText('Mechanical Keyboard');
    await expect(productPanel.getByRole('img', { name: 'Wireless Headphones' })).toHaveCount(0);
  } finally { await app.close(); }
});
