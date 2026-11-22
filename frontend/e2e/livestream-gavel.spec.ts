import {
  _electron as electron,
  test,
  expect,
  type ElectronApplication,
  type Page,
  type WebSocketRoute
} from '@playwright/test';
import path from 'node:path';
import type { LiveSession } from '../src/features/livestream/liveState';

let app: ElectronApplication;
let page: Page;
let socket: WebSocketRoute;
let session: LiveSession;
function snapshot() {
  return {
    session,
    wallet: { availableBalance: '1863', lockedBalance: '0' },
    orders: [],
    serverNow: Date.now()
  };
}
function update(reason: string) {
  socket.send(JSON.stringify({ type: 'STATE', reason, data: snapshot() }));
}
function sold() {
  session = {
    ...session,
    version: (BigInt(session.version) + 1n).toString(),
    lots: session.lots.map((l) => ({
      ...l,
      status: 'SOLD',
      leaderId: '2',
      leaderName: 'Minh Anh',
      currentPrice: '137'
    }))
  };
  update('LOT_SOLD');
}

test.beforeEach(async ({}, info) => {
  session = {
    id: '90001',
    hostId: '1',
    title: 'Phiên kiểm tra hiệu ứng',
    description: '',
    hostName: 'Host',
    startsAt: Date.now() - 60000,
    status: 'LIVE',
    version: '1',
    currentLotIndex: 0,
    publisherReady: false,
    mediaGeneration: '1',
    hostConnectionId: null,
    connections: [],
    remainingMs: null,
    pauseUntil: null,
    serverNow: Date.now(),
    participants: [{ id: '2', username: 'Minh Anh' }],
    messages: [],
    lots: [
      {
        id: '80001',
        auctionId: '70001',
        productId: '60001',
        name: 'Bàn phím cơ',
        description: '',
        imageUrl: null,
        startingPrice: '100',
        status: 'OPEN',
        currentPrice: '100',
        leaderId: null,
        leaderName: null,
        deadline: null,
        bids: []
      }
    ]
  };
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
  await page.addInitScript(() => {
    (window as any).gavelSounds = [];
    (window as any).gavelImpacts = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args: Parameters<Element['animate']>) {
      if (this.matches('.guest-workspace, .guest-sidebar, .live-sale-card'))
        (window as any).gavelImpacts.push(this.className);
      return animate.apply(this, args);
    };
    const create = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const source = create.call(this);
      const start = source.start.bind(source);
      source.start = (...args: Parameters<AudioBufferSourceNode['start']>) => {
        (window as any).gavelSounds.push(args[0]);
        start(...args);
      };
      return source;
    };
  });
  await page.route('**/api/auth/me', (r) =>
    r.fulfill({ json: { id: 2, username: 'Minh Anh', role: 'USER' } })
  );
  await page.route('**/api/livestreams/state', (r) =>
    r.fulfill({
      json: {
        sessions: [session],
        wallet: { availableBalance: '1863', lockedBalance: '0' },
        orders: [],
        registrations: [],
        notifications: [],
        serverNow: Date.now()
      }
    })
  );
  await page.route('**/api/livestreams/90001/snapshot', (r) => r.fulfill({ json: snapshot() }));
  await page.routeWebSocket('**/ws/livestream', (ws) => {
    socket = ws;
    ws.onMessage((raw) => {
      const m = JSON.parse(raw.toString());
      if (m.type === 'JOIN')
        ws.send(JSON.stringify({ type: 'STATE', reason: 'SNAPSHOT', data: snapshot() }));
    });
    ws.send(JSON.stringify({ type: 'WELCOME', connectionId: 'viewer-connection' }));
  });
  await page.goto('app://auction/#/livestream/90001/room');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Phiên kiểm tra hiệu ứng', exact: true })
  ).toBeVisible();
  await expect(page.getByText('Đã đồng bộ phòng', { exact: true })).toBeVisible();
});
test.afterEach(async () => {
  await app?.close();
});

test('immersive camera keeps a draggable lit podium and retains video while drawers open', async ({}, info) => {
  await page.route('**/api/product-images/gallery-keyboard.svg', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 360"><defs><linearGradient id="g" x2="0" y2="1"><stop stop-color="#d9c9a4"/><stop offset="1" stop-color="#9a845e"/></linearGradient></defs><ellipse cx="250" cy="252" rx="193" ry="21" fill="#14251c" opacity=".12"/><path d="M57 135 417 113l34 123-359 18z" fill="#5d634e"/><path d="m57 128 360-22 34 123-359 18z" fill="url(#g)" stroke="#c9b78d" stroke-width="3"/><g stroke="#7c765c" stroke-width="15" stroke-dasharray="22 6"><path d="m78 149 325-20m-317 43 323-20m-316 42 322-19m-316 40 320-19"/></g><path d="m167 222 143-9" stroke="#f5edd8" stroke-width="13"/><circle cx="410" cy="135" r="4" fill="#4b7550"/></svg>'
    })
  );
  session = {
    ...session,
    version: '2',
    lots: session.lots.map((l) => ({ ...l, imageUrl: '/api/product-images/gallery-keyboard.svg' }))
  };
  update('COMMAND');
  const stage = page.getByTestId('product-showcase-stage');
  const room = page.getByTestId('auction-room');
  await expect(room.locator('.live-grandstand.is-integrated')).toHaveCount(1);
  const continuity = await room.evaluate((element) => {
    const video = element.querySelector('.showcase-feed')!.getBoundingClientRect();
    const rowTops = [...element.querySelectorAll('.live-grandstand li')]
      .map((seat) => seat.getBoundingClientRect().top)
      .sort((a, b) => a - b);
    return {
      platformSeam:
        element.querySelector('.showcase-theatre-platform')!.getBoundingClientRect().top -
        video.bottom,
      rows: rowTops.filter((top, index) => index === 0 || top - rowTops[index - 1] > 20).length,
      floor: getComputedStyle(element.querySelector('.live-audience-floor')!).backgroundColor,
      image: getComputedStyle(element).backgroundImage
    };
  });
  expect(Math.abs(continuity.platformSeam)).toBeLessThan(8);
  expect(continuity.rows).toBe(3);
  await expect(room.locator('.showcase-curtain')).toHaveCount(2);
  await expect(room.getByTestId('host-theatre')).toBeVisible();
  await expect(page.locator('.guest-sidebar')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Toàn màn hình', exact: true })).toBeVisible();
  expect(continuity.floor).toBe('rgba(0, 0, 0, 0)');
  expect(continuity.image).toContain('auction-salon-v1');
  const picture = stage.locator('.showcase-photo-front img');
  await expect(picture).toBeVisible();
  await expect
    .poll(() => picture.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
  await page.mouse.move(0, 0);
  await expect
    .poll(() =>
      stage
        .locator('.showcase-photo-turntable')
        .evaluate((e) => getComputedStyle(e).animationPlayState)
    )
    .toBe('running');
  const frames = await stage.locator('.showcase-photo-turntable').evaluate(async (e) => {
    const animation = e.getAnimations()[0];
    animation.currentTime = 0;
    const front = getComputedStyle(e).transform;
    animation.currentTime = 12000;
    const back = getComputedStyle(e).transform;
    animation.currentTime = 0;
    return { front, back };
  });
  expect(frames.front).not.toBe(frames.back);
  await expect(page.locator('.showcase-motion-toggle')).toHaveCount(0);
  const photo = stage.getByRole('button', {
    name: 'Bàn phím cơ · Kéo để xoay ảnh',
    exact: true
  });
  await photo.hover();
  await expect(stage).toHaveAttribute('data-paused', 'false');
  await expect(page.getByText(/Giữ chuột trên ảnh|Thả chuột để tiếp tục/)).toHaveCount(0);
  const bounds = await photo.boundingBox();
  const origin = { x: bounds!.x + bounds!.width / 2, y: bounds!.y + bounds!.height / 2 };
  await page.mouse.down();
  await expect(stage).toHaveAttribute('data-paused', 'true');
  await expect
    .poll(() =>
      stage
        .locator('.showcase-photo-turntable')
        .evaluate((e) => getComputedStyle(e).animationPlayState)
    )
    .toBe('paused');
  await page.mouse.move(origin.x + 60, origin.y, { steps: 5 });
  const right = await photo.evaluate((e) =>
    parseFloat((e as HTMLElement).style.getPropertyValue('--showcase-drag-angle'))
  );
  expect(right).toBeGreaterThan(30);
  const rightTransform = await stage
    .locator('.showcase-photo-manual')
    .evaluate((e) => getComputedStyle(e).transform);
  await page.mouse.move(origin.x - 60, origin.y, { steps: 5 });
  const left = await photo.evaluate((e) =>
    parseFloat((e as HTMLElement).style.getPropertyValue('--showcase-drag-angle'))
  );
  expect(left).toBeLessThan(-30);
  expect(
    await stage.locator('.showcase-photo-manual').evaluate((e) => getComputedStyle(e).transform)
  ).not.toBe(rightTransform);
  await page.mouse.move(0, 0);
  await expect(stage).toHaveAttribute('data-paused', 'true');
  const beforeRelease = await photo.evaluate((e) =>
    (e as HTMLElement).style.getPropertyValue('--showcase-drag-angle')
  );
  await page.mouse.up();
  await expect(stage).toHaveAttribute('data-paused', 'false');
  expect(
    await photo.evaluate((e) => (e as HTMLElement).style.getPropertyValue('--showcase-drag-angle'))
  ).toBe(beforeRelease);
  await photo.focus();
  await page.keyboard.press('ArrowRight');
  expect(
    await photo.evaluate((e) =>
      parseFloat((e as HTMLElement).style.getPropertyValue('--showcase-drag-angle'))
    )
  ).toBeCloseTo(parseFloat(beforeRelease) + 15);
  await page.keyboard.down('Space');
  await expect(stage).toHaveAttribute('data-paused', 'true');
  await page.keyboard.up('Space');
  await expect(stage).toHaveAttribute('data-paused', 'false');
  await page.keyboard.down('Enter');
  await expect(stage).toHaveAttribute('data-paused', 'true');
  await page.getByRole('button', { name: 'Toàn màn hình', exact: true }).focus();
  await page.keyboard.up('Enter');
  await expect(stage).toHaveAttribute('data-paused', 'false');
  await expect(room.locator('.showcase-product-light .showcase-light-beam')).toHaveCount(1);
  await expect(stage.locator('.showcase-pedestal')).toHaveCount(1);
  const camera = page.locator('video[aria-label="Livestream từ host"]');
  await camera.evaluate((e) => {
    e.dataset.retained = 'same-video';
  });
  await page.getByRole('button', { name: /Trò chuyện/ }).click();
  const chat = page.getByRole('region', { name: 'Trò chuyện', exact: true });
  await expect(chat).toBeVisible();
  await expect(camera).toHaveAttribute('data-retained', 'same-video');
  await expect(page.getByRole('button', { name: 'Đặt giá', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(chat).toHaveCount(0);
  await page.getByRole('button', { name: /Sản phẩm/ }).click();
  await expect(
    page.getByRole('region', { name: 'Sản phẩm trong phiên', exact: true })
  ).toBeVisible();
  await expect(camera).toHaveAttribute('data-retained', 'same-video');
  await page.keyboard.press('Escape');
  await page.locator('.live-room-grid').screenshot({ path: info.outputPath('gallery-room.png') });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.showcase-motion-hint')).toHaveCount(0);
  expect(
    await stage
      .locator('.showcase-photo-turntable')
      .evaluate((e) => getComputedStyle(e).animationName)
  ).toBe('none');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(820, 650));
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('mini podium previews keep bidding available, and fit desktop and compact windows', async ({}, info) => {
  session = {
    ...session,
    version: '2',
    lots: [
      session.lots[0],
      ...['Máy ảnh', 'Đèn bàn', 'Tai nghe'].map((name, index) => ({
        ...session.lots[0],
        id: String(80002 + index),
        name,
        description: 'Sản phẩm xem trước',
        status: 'QUEUED' as const
      }))
    ]
  };
  update('COMMAND');
  const video = page.locator('video');
  await video.evaluate((element) => {
    element.dataset.retained = 'camera-still-mounted';
  });
  await expect(page.locator('.showcase-mini')).toHaveCount(2);
  await page.getByRole('button', { name: 'Xem sản phẩm Máy ảnh', exact: true }).click();
  const products = page.getByRole('region', { name: 'Sản phẩm trong phiên', exact: true });
  await expect(products.getByRole('heading', { name: 'Máy ảnh', exact: true })).toBeVisible();
  await expect(
    products.getByRole('button', { name: 'Đưa sản phẩm này lên', exact: true })
  ).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Bàn phím cơ', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đặt giá', exact: true })).toBeEnabled();
  await expect(video).toHaveAttribute('data-retained', 'camera-still-mounted');
  const boundary = await products.evaluate((element) => ({
    drawerRight: element.getBoundingClientRect().right,
    bidLeft: document.querySelector('.live-bid-column')!.getBoundingClientRect().left
  }));
  expect(boundary.drawerRight).toBeLessThan(boundary.bidLeft);
  await page.keyboard.press('Escape');
  await expect(products).toHaveCount(0);
  for (const [width, height] of [
    [1366, 768],
    [1920, 1080],
    [820, 650],
    [820, 600]
  ]) {
    await app.evaluate(
      ({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setSize(size[0], size[1]),
      [width, height]
    );
    await expect(page.getByRole('button', { name: 'Đặt giá', exact: true })).toBeInViewport({
      ratio: 1
    });
    const layout = await page.evaluate(() => {
      const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
      const camera = rect('.showcase-feed'),
        podium = rect('.showcase-stage'),
        bid = rect('.live-bid-column');
      const rowTops = [...document.querySelectorAll('.live-grandstand li')]
        .map((seat) => seat.getBoundingClientRect().top)
        .sort((a, b) => a - b);
      return {
        overflow:
          document.documentElement.scrollWidth > innerWidth ||
          document.documentElement.scrollHeight > innerHeight,
        surfaceHeight: rect('.showcase-theatre-platform > i').height,
        onPlatform: [...document.querySelectorAll('.showcase-pedestal, .showcase-mini-plinth')]
          .filter((element) => (element as HTMLElement).offsetParent !== null)
          .every((element) => {
            const base = element.getBoundingClientRect(),
              surface = rect('.showcase-theatre-platform > i');
            return (
              base.left >= surface.left &&
              base.right <= surface.right &&
              base.bottom >= surface.top &&
              base.bottom <= surface.bottom
            );
          }),
        lampClear:
          rect('.showcase-photo-position').top >= rect('.showcase-light-fixture > span').bottom + 4,
        lampOnCeiling: rect('.showcase-light-fixture').top - rect('.showcase-theatre').top,
        lightAligned: Math.abs(
          (rect('.showcase-light-fixture').left + rect('.showcase-light-fixture').right) / 2 -
            (rect('.showcase-pedestal').left + rect('.showcase-pedestal').right) / 2
        ),
        lightConnected: Math.abs(
          rect('.showcase-light-beam').top - rect('.showcase-light-fixture > span').bottom
        ),
        lightOnWood:
          rect('.showcase-light-beam').bottom >= rect('.showcase-pedestal-top').top &&
          rect('.showcase-light-beam').bottom <= rect('.showcase-pedestal-top').bottom,
        cameraFraction: camera.width / innerWidth,
        cameraHeight: camera.height,
        rowCount: rowTops.filter((top, index) => index === 0 || top - rowTops[index - 1] > 20)
          .length,
        fillsAuditorium:
          Math.abs(rect('.live-audience-floor').width - rect('.showcase-room-audience').width) < 1,
        seatCount: document.querySelectorAll('.live-grandstand li').length,
        spread: (() => {
          const chairs = document.querySelectorAll(
            '.live-grandstand li[data-row="2"] .live-seat-art'
          );
          return (
            (chairs[chairs.length - 1].getBoundingClientRect().right -
              chairs[0].getBoundingClientRect().left) /
            rect('.live-audience-floor').width
          );
        })(),
        clusterCenter: Math.abs(
          (rect('.live-audience-floor').left + rect('.live-audience-floor').right) / 2 -
            (rect('.showcase-theatre').left + rect('.showcase-theatre').right) / 2
        ),
        stageClear:
          rect('.showcase-theatre-platform').bottom <=
          rect('.live-grandstand .live-section-title').top,

        podiumClear: podium.right < bid.left,
        seats: [...document.querySelectorAll('.live-grandstand li')].every(
          (seat) => seat.getBoundingClientRect().bottom <= innerHeight
        ),
        captionClear:
          rect('.showcase-lot-caption').bottom <= rect('.live-grandstand .live-section-title').top,
        dock: rect('.live-room-dock').top >= bid.bottom
      };
    });
    expect(layout.overflow).toBe(false);
    expect(layout.cameraFraction).toBeGreaterThan(0.25);
    expect(layout.cameraFraction).toBeLessThan(0.65);
    expect(layout.cameraHeight).toBeGreaterThan(100);
    expect(layout.lampOnCeiling).toBeGreaterThanOrEqual(0);
    expect(layout.lampOnCeiling).toBeLessThan(16);
    expect(layout.lightAligned).toBeLessThan(1);
    expect(layout.lightConnected).toBeLessThan(3);
    expect(layout.lightOnWood).toBe(true);
    expect(layout.lampClear).toBe(true);
    await expect(page.locator('.showcase-light-fixture')).toBeVisible();
    expect(layout.rowCount).toBe(3);
    expect(layout.fillsAuditorium).toBe(true);
    expect(layout.seatCount).toBeGreaterThan(15);
    expect(layout.seatCount % 3).toBe(0);
    expect(layout.spread).toBeGreaterThan(0.85);
    expect(layout.clusterCenter).toBeLessThan(2);
    expect(layout.stageClear).toBe(true);
    expect(layout.surfaceHeight).toBeGreaterThanOrEqual(70);
    expect(layout.onPlatform, JSON.stringify({ width, height, ...layout })).toBe(true);
    expect(
      layout.podiumClear && layout.seats && layout.dock && layout.captionClear,
      JSON.stringify({ width, height, ...layout })
    ).toBe(true);
    if (width === 820) await expect(page.locator('.showcase-mini').nth(1)).toBeHidden();
    await page.screenshot({ path: info.outputPath(`immersive-${width}x${height}.png`) });
  }
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1366, 768));
  await page.getByRole('button', { name: 'Toàn màn hình', exact: true }).click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await page.getByRole('button', { name: 'Thoát toàn màn hình', exact: true }).click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
});

test('bids and chat work through the floating controls without closing the camera', async () => {
  await page.route('**/api/auth/csrf', (route) =>
    route.fulfill({ json: { token: 'test-csrf', headerName: 'X-CSRF-TOKEN' } })
  );
  const received: string[] = [];
  await page.route('**/api/livestreams/90001/lots/80001/bids', async (route) => {
    const input = route.request().postDataJSON();
    expect(route.request().headers()['x-csrf-token']).toBe('test-csrf');
    expect(input.requestId).toBeTruthy();
    received.push(input.amount);
    session = {
      ...session,
      version: '2',
      lots: session.lots.map((item) => ({
        ...item,
        currentPrice: input.amount,
        leaderId: '2',
        leaderName: 'Minh Anh',
        deadline: Date.now() + 5000
      }))
    };
    await route.fulfill({ json: snapshot() });
  });
  await page.route('**/api/livestreams/90001/chat', async (route) => {
    const input = route.request().postDataJSON();
    expect(input.requestId).toBeTruthy();
    session = {
      ...session,
      version: '3',
      messages: [{ id: '1', userId: '2', username: 'Minh Anh', text: input.text, at: Date.now() }]
    };
    await route.fulfill({ json: snapshot() });
  });
  await page.getByRole('button', { name: /Trò chuyện/ }).click();
  const chat = page.getByRole('region', { name: 'Trò chuyện', exact: true });
  await chat
    .getByRole('textbox', { name: 'Tin nhắn', exact: true })
    .fill('Chào host, mình đang xem!');
  await page.getByRole('textbox', { name: 'Giá của bạn (Coin)', exact: true }).fill('150');
  await page.getByRole('button', { name: 'Đặt 150 Coin', exact: true }).click();
  await expect.poll(() => received).toEqual(['150']);
  await expect(page.getByTestId('live-current-price')).toHaveText('150 Coin');
  await expect(page.getByRole('button', { name: 'Bạn đang dẫn đầu', exact: true })).toBeDisabled();
  await expect(chat.getByRole('textbox')).toHaveValue('Chào host, mình đang xem!');
  await chat.getByRole('button', { name: 'Gửi', exact: true }).click();
  await expect(chat.getByText('Chào host, mình đang xem!', { exact: true })).toBeVisible();
  await expect(chat.getByRole('textbox')).toHaveValue('');
  await page.keyboard.press('Escape');
  await expect(chat).toHaveCount(0);
});

test('gallery handles missing/broken product photos and updates the displayed product', async () => {
  const stage = page.getByTestId('product-showcase-stage');
  await expect(stage.getByRole('img', { name: /Chưa có ảnh: Bàn phím cơ/ })).toBeVisible();
  await page.route('**/api/product-images/missing.png', (r) =>
    r.fulfill({ status: 404, body: '' })
  );
  session = {
    ...session,
    version: '2',
    lots: session.lots.map((l) => ({ ...l, imageUrl: '/api/product-images/missing.png' }))
  };
  update('COMMAND');
  await expect(stage.getByRole('img', { name: /Không tải được ảnh: Bàn phím cơ/ })).toBeVisible();
  await expect(stage).toHaveAttribute('data-paused', 'true');
  session = {
    ...session,
    version: '3',
    lots: session.lots.map((l) => ({ ...l, id: '80002', name: 'Chuột', imageUrl: null }))
  };
  update('COMMAND');
  await expect(stage.getByRole('img', { name: /Chưa có ảnh: Chuột/ })).toBeVisible();
  await expect(stage.getByRole('img', { name: /Bàn phím cơ/ })).toHaveCount(0);
});

test('ending replaces the viewer room with a personal summary without interrupting the final gavel', async ({}, info) => {
  sold();
  const overlay = page.getByTestId('live-sale-overlay');
  await expect(overlay).toBeVisible();
  session = {
    ...session,
    status: 'ENDED',
    version: '3',
    lots: [
      session.lots[0],
      {
        ...session.lots[0],
        id: '80002',
        name: 'Máy ảnh',
        leaderId: '3',
        leaderName: 'Lan Ngọc',
        currentPrice: '250'
      },
      {
        ...session.lots[0],
        id: '80003',
        name: 'Chuột không dây',
        status: 'UNSOLD',
        currentPrice: '999',
        leaderId: '2'
      }
    ]
  };
  update('ENDED');
  await expect(
    page.getByRole('heading', { name: 'Phiên livestream đã kết thúc', exact: true })
  ).toBeVisible();
  await expect(overlay).toBeVisible();
  await expect(
    page.locator('video, .live-bid-form, .live-grandstand, .live-chat, .live-countdown')
  ).toHaveCount(0);
  const personal = page.getByRole('region', { name: 'Kết quả của bạn', exact: true });
  await expect(personal.getByRole('heading')).toHaveText('Bạn đã thắng 1 món');
  await expect(personal.locator('strong')).toHaveText('137 Coin');
  const results = page.getByRole('list', { name: 'Kết quả sản phẩm trong phiên', exact: true });
  await expect(results.getByRole('listitem')).toHaveCount(3);
  await expect(results.locator('.is-own-win')).toHaveCount(1);
  await expect(results.getByText('Người thắng: Lan Ngọc', { exact: true })).toBeVisible();
  const unsold = results.getByRole('listitem').filter({ hasText: 'Chuột không dây' });
  await expect(unsold.getByText('Chưa bán', { exact: true })).toBeVisible();
  await expect(unsold.getByText('999 Coin', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Xem món đã thắng', exact: true })).toHaveAttribute(
    'href',
    '#/livestream/purchases'
  );
  await expect(
    page.getByRole('link', { name: 'Khám phá phiên khác', exact: true })
  ).toHaveAttribute('href', '#/livestream');
  await expect(overlay).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).gavelSounds.length)).toBe(3);
  await page.screenshot({ path: info.outputPath('viewer-ended-summary.png'), fullPage: true });
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Phiên livestream đã kết thúc', exact: true })
  ).toBeVisible();
  await expect(page.locator('.live-gavel-scene, video, .live-bid-form')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).gavelSounds.length)).toBe(0);
});

test('an ended viewer with no wins sees a clear empty result at small window sizes', async () => {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(820, 650));
  session = {
    ...session,
    status: 'ENDED',
    version: '2',
    lots: session.lots.map((l) => ({ ...l, status: 'UNSOLD' }))
  };
  update('ENDED');
  await expect(
    page.getByRole('heading', { name: 'Hẹn bạn ở phiên tiếp theo', exact: true })
  ).toBeVisible();
  await expect(page.locator('.live-ended-results .is-own-win')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Xem món đã thắng', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Khám phá phiên khác', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('hides the gavel until a committed sale, shows a large centered overlay for exactly three hits, then hides it', async ({}, info) => {
  await expect(page.locator('.live-gavel-scene')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Tiếng búa/ })).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).gavelSounds.length)).toBe(0);
  await expect(page.getByRole('button', { name: 'Gõ thử 3 lần', exact: true })).toHaveCount(0);
  await page.evaluate(() => {
    (window as any).gavelHits = 0;
    for (const name of ['animationstart', 'animationiteration'])
      document.addEventListener(name, (e) => {
        if ((e.target as Element).classList.contains('live-gavel-hammer'))
          (window as any).gavelHits++;
      });
  });
  sold();
  const overlay = page.getByTestId('live-sale-overlay');
  await expect(overlay).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).gavelSounds.length)).toBe(3);
  await expect(overlay.getByRole('heading', { name: 'Minh Anh', exact: true })).toBeVisible();
  const grandstand = page.locator('.live-grandstand');
  await expect(grandstand.getByText('Minh Anh', { exact: true })).toBeVisible();
  await expect(grandstand.getByText('Người thắng', { exact: true })).toHaveCount(0);
  await expect(grandstand.locator('.is-leading')).toHaveCount(0);
  await expect(overlay.getByText('137 Coin', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).gavelImpacts.length)).toBe(9);
  const impacts = await page.evaluate(() => (window as any).gavelImpacts as string[]);
  for (const target of ['guest-workspace', 'guest-sidebar', 'live-sale-card'])
    expect(impacts.filter((name) => name.split(' ').includes(target))).toHaveLength(3);
  await overlay
    .locator('.live-sale-card')
    .evaluate((element) =>
      Promise.all(element.getAnimations().map((animation) => animation.finished))
    );
  const position = await overlay.evaluate((element) => {
    const viewport = element.getBoundingClientRect();
    const card = element.querySelector('.live-sale-card')!.getBoundingClientRect();
    const scene = element.querySelector('.live-gavel-scene')!.getBoundingClientRect();
    return {
      fixed: getComputedStyle(element).position,
      centerX: Math.abs(card.x + card.width / 2 - viewport.width / 2),
      centerY: Math.abs(card.y + card.height / 2 - viewport.height / 2),
      gavelWidth: scene.width
    };
  });
  expect(position.fixed).toBe('fixed');
  expect(position.centerX).toBeLessThan(2);
  expect(position.centerY).toBeLessThan(2);
  expect(position.gavelWidth).toBeGreaterThan(320);
  await page.screenshot({ path: info.outputPath('sale-overlay.png') });
  await expect.poll(() => page.evaluate(() => (window as any).gavelHits)).toBe(3);
  await expect(overlay).toHaveCount(0);
  update('LOT_SOLD');
  await expect(overlay).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/live-screen-impact-active/);
  expect(await page.evaluate(() => (window as any).gavelImpacts.length)).toBe(9);
  expect(await page.evaluate(() => (window as any).gavelSounds.length)).toBe(3);
  await page.reload();
  await expect(page.getByText('Bạn đã thắng', { exact: true })).toBeVisible();
  await expect(page.locator('.live-gavel-scene')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).gavelSounds.length)).toBe(0);
  expect(await page.evaluate(() => (window as any).gavelImpacts.length)).toBe(0);
});

test('renders responsive rows of upholstered chairs, fills occupied seats, and keeps usernames on one line', async ({}, info) => {
  session = {
    ...session,
    version: '2',
    participants: [
      { id: '2', username: 'khach_test_ten_rat_dai_de_kiem_tra' },
      { id: '3', username: 'Lan Ngọc' },
      { id: '4', username: 'Hoàng Anh' }
    ],
    lots: session.lots.map((l) => ({
      ...l,
      leaderId: '2',
      leaderName: 'Khách',
      deadline: Date.now() + 5000
    }))
  };
  update('BID');
  const grandstand = page.locator('.live-grandstand');
  await expect.poll(() => grandstand.locator('svg.live-chair').count()).toBeGreaterThan(15);
  const totalSeats = await grandstand.locator('svg.live-chair').count();
  expect(totalSeats % 3).toBe(0);
  await expect(grandstand.locator('.is-occupied')).toHaveCount(3);
  await expect(grandstand.locator('.is-empty .live-seat-name')).toHaveCount(0);
  await expect(grandstand.getByRole('listitem', { name: 'Ghế trống', exact: true })).toHaveCount(
    totalSeats - 3
  );
  await expect(grandstand.getByText('Đang dẫn', { exact: true })).toBeVisible();
  await grandstand.scrollIntoViewIfNeeded();
  await grandstand.screenshot({ path: info.outputPath('grandstand.png') });
  await grandstand
    .locator('.live-audience-floor')
    .screenshot({ path: info.outputPath('auditorium-compact.png') });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(820, 650));
  const layout = await grandstand
    .locator('.live-seat-name')
    .first()
    .evaluate((e) => ({
      wrap: getComputedStyle(e).whiteSpace,
      overflow: getComputedStyle(e).textOverflow,
      scrolls: document.documentElement.scrollWidth > innerWidth
    }));
  expect(layout).toEqual({ wrap: 'nowrap', overflow: 'ellipsis', scrolls: false });
});

test('keeps the announced winner while the host moves to the next product', async () => {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(820, 650));
  sold();
  const overlay = page.getByTestId('live-sale-overlay');
  await expect(overlay).toBeVisible();
  await overlay
    .locator('.live-sale-card')
    .evaluate((element) =>
      Promise.all(element.getAnimations().map((animation) => animation.finished))
    );
  const bounds = await overlay.locator('.live-sale-card').evaluate((element) => {
    const r = element.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, height: innerHeight };
  });
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.height);
  session = {
    ...session,
    version: '3',
    lots: [
      {
        ...session.lots[0],
        id: '80002',
        name: 'Chuột không dây',
        status: 'PRESENTING',
        leaderId: null,
        leaderName: null,
        currentPrice: '200'
      }
    ]
  };
  update('COMMAND');
  await expect(page.getByRole('heading', { name: 'Chuột không dây', exact: true })).toBeVisible();
  await expect(overlay.getByRole('heading', { name: 'Minh Anh', exact: true })).toBeVisible();
  await expect(overlay.getByText('Bàn phím cơ', { exact: true })).toBeVisible();
  await expect(overlay).toHaveCount(0);
});

test('does not show a gavel for an unsold product and respects reduced motion', async () => {
  session = {
    ...session,
    version: '2',
    lots: session.lots.map((l) => ({ ...l, status: 'UNSOLD' }))
  };
  update('COMMAND');
  await expect(page.locator('.live-gavel-scene')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  sold();
  const overlay = page.getByTestId('live-sale-overlay');
  await expect(overlay).toBeVisible();
  expect(
    await page.locator('.live-gavel-hammer').evaluate((e) => getComputedStyle(e).animationName)
  ).toBe('none');
  await expect(overlay).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).gavelSounds.length)).toBe(3);
  expect(await page.evaluate(() => (window as any).gavelImpacts.length)).toBe(0);
});
