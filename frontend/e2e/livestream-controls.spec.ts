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

let app: ElectronApplication, page: Page, session: LiveSession, socket: WebSocketRoute;
let commands: Record<string, unknown>[];
let rejectEnd = false;
function snapshot() {
  return { session, wallet: null, orders: [], serverNow: Date.now() };
}
function update() {
  socket.send(JSON.stringify({ type: 'STATE', reason: 'COMMAND', data: snapshot() }));
}

test.beforeEach(async ({}, info) => {
  commands = [];
  rejectEnd = false;
  session = {
    id: '901',
    hostId: '1',
    hostName: 'Admin',
    title: 'Kiểm tra điều khiển',
    description: '',
    startsAt: Date.now(),
    status: 'LIVE',
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
    messages: [],
    lots: [
      {
        id: '801',
        auctionId: '701',
        productId: '601',
        name: 'Bàn phím',
        description: '',
        imageUrl: null,
        startingPrice: '100',
        currentPrice: '100',
        status: 'OPEN',
        leaderId: null,
        leaderName: null,
        deadline: null,
        bids: []
      }
    ]
  };
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
  await page.route('**/api/auth/me', (r) =>
    r.fulfill({ json: { id: 1, username: 'Admin', role: 'ADMIN' } })
  );
  await page.route('**/api/auth/csrf', (r) =>
    r.fulfill({ json: { token: 'test-csrf', headerName: 'X-CSRF-TOKEN' } })
  );
  await page.route('**/api/livestreams/state', (r) =>
    r.fulfill({
      json: {
        sessions: [session],
        registrations: [],
        notifications: [],
        wallet: null,
        orders: [],
        serverNow: Date.now()
      }
    })
  );
  await page.route('**/api/livestreams/901', (r) => r.fulfill({ json: session }));
  await page.route('**/api/livestreams/901/snapshot', (r) => r.fulfill({ json: snapshot() }));
  await page.route('**/api/admin/livestreams/901/end', async (r) => {
    commands.push(r.request().postDataJSON());
    if (rejectEnd)
      return r.fulfill({ status: 409, json: { message: 'Phiên vừa thay đổi. Vui lòng thử lại.' } });
    session = {
      ...session,
      status: 'ENDED',
      version: (BigInt(session.version) + 1n).toString(),
      lots: session.lots.map((l) => (l.status === 'SOLD' ? l : { ...l, status: 'UNSOLD' }))
    };
    await r.fulfill({ json: snapshot() });
  });
  await page.routeWebSocket('**/ws/livestream', (ws) => {
    socket = ws;
    ws.onMessage((raw) => {
      if (JSON.parse(raw.toString()).type === 'JOIN') update();
    });
    ws.send(JSON.stringify({ type: 'WELCOME', connectionId: 'host-fixture' }));
  });
  await page.goto('app://auction/#/admin/livestream/901');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Kiểm tra điều khiển', exact: true })
  ).toBeVisible();
  await expect(page.getByText('Đã đồng bộ phòng', { exact: true })).toBeVisible();
});
test.afterEach(async () => {
  await app?.close();
});

test('host chooses any item before/live, returns to skipped items, and waits for active bids', async () => {
  session = {
    ...session,
    status: 'SCHEDULED',
    version: '2',
    lots: [
      { ...session.lots[0], status: 'QUEUED' },
      { ...session.lots[0], id: '802', name: 'Chuột', status: 'QUEUED' },
      { ...session.lots[0], id: '803', name: 'Tai nghe', status: 'QUEUED' }
    ]
  };
  update();
  const selected: string[] = [];
  await page.route('**/api/admin/livestreams/901/select', async (route) => {
    const input = route.request().postDataJSON();
    expect(route.request().headers()['x-csrf-token']).toBe('test-csrf');
    expect(input.requestId).toBeTruthy();
    selected.push(input.lotId);
    session = {
      ...session,
      version: (BigInt(session.version) + 1n).toString(),
      currentLotIndex: session.lots.findIndex((l) => l.id === input.lotId),
      lots: session.lots.map((l) =>
        l.id === input.lotId
          ? { ...l, status: session.status === 'SCHEDULED' ? 'QUEUED' : 'PRESENTING' }
          : l.status === 'PRESENTING'
            ? { ...l, status: 'QUEUED' }
            : l
      )
    };
    await route.fulfill({ json: snapshot() });
  });
  const choice = page.getByRole('combobox', { name: 'Chọn sản phẩm đưa lên lần này', exact: true });
  const bring = page.getByRole('button', { name: 'Đưa lên', exact: true });
  await expect(bring).toBeDisabled();
  await choice.selectOption('803');
  await bring.click();
  await expect(page.locator('.live-current-product h2')).toHaveText('Tai nghe');
  expect(selected).toEqual(['803']);
  session = {
    ...session,
    status: 'LIVE',
    version: '4',
    lots: session.lots.map((l) =>
      l.id === '803'
        ? { ...l, status: 'OPEN', leaderId: '2', leaderName: 'Khách', deadline: Date.now() + 5000 }
        : l
    )
  };
  update();
  await expect(choice).toBeDisabled();
  await expect(bring).toBeDisabled();
  session = {
    ...session,
    version: '5',
    lots: session.lots.map((l) => (l.id === '803' ? { ...l, status: 'SOLD' } : l))
  };
  update();
  await expect(choice).toBeEnabled();
  await choice.selectOption('801');
  await bring.click();
  await expect(page.locator('.live-current-product h2')).toHaveText('Bàn phím');
  expect(selected).toEqual(['803', '801']);
  await expect(choice.locator('option[value="803"]')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Mở đấu giá sản phẩm', exact: true })
  ).toBeEnabled();
});

test('ends through a centered confirmation, reports HTTP errors there, and permits retry', async ({}, info) => {
  await page.getByRole('button', { name: 'Kết thúc live', exact: true }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  const bounds = await dialog.evaluate((e) => {
    const r = e.getBoundingClientRect();
    return {
      x: Math.abs(r.x + r.width / 2 - document.documentElement.clientWidth / 2),
      y: Math.abs(r.y + r.height / 2 - document.documentElement.clientHeight / 2)
    };
  });
  expect(bounds.x).toBeLessThan(2);
  expect(bounds.y).toBeLessThan(2);
  await page.screenshot({ path: info.outputPath('end-confirmation.png') });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(commands).toHaveLength(0);
  await page.getByRole('button', { name: 'Kết thúc live', exact: true }).click();
  rejectEnd = true;
  await dialog.getByRole('button', { name: 'Xác nhận kết thúc', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Phiên vừa thay đổi. Vui lòng thử lại.');
  rejectEnd = false;
  await dialog.getByRole('button', { name: 'Xác nhận kết thúc', exact: true }).click();
  await expect(page).toHaveURL(/\/901\/results$/);
  expect(commands).toHaveLength(2);
  expect(commands[0].lotId).toBe('801');
  expect(commands[0].requestId).toBeTruthy();
  expect(commands[1].requestId).not.toBe(commands[0].requestId);
});

test('allows ending scheduled and paused sessions even without a synchronized socket', async () => {
  for (const status of ['SCHEDULED', 'PAUSED'] as const) {
    session = { ...session, status, version: (BigInt(session.version) + 1n).toString() };
    update();
    await page.getByRole('button', { name: 'Kết thúc live', exact: true }).click();
    await expect(
      page.getByRole('alertdialog').getByRole('button', { name: 'Xác nhận kết thúc', exact: true })
    ).toBeEnabled();
    await page.keyboard.press('Escape');
  }
  socket.send(JSON.stringify({ type: 'ERROR', message: 'Chưa đồng bộ phòng' }));
  // A reload without JOIN acknowledgement leaves the room unjoined; END still uses authenticated HTTP.
  await page.routeWebSocket('**/ws/livestream', (ws) => {
    socket = ws;
    ws.send(JSON.stringify({ type: 'WELCOME', connectionId: 'no-join' }));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Kết thúc live', exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Xác nhận kết thúc', exact: true })
    .click();
  await expect(page).toHaveURL(/\/901\/results$/);
  expect(commands).toHaveLength(1);
});

test('explains an active bid and waits for the server result before allowing end', async () => {
  session = {
    ...session,
    version: '2',
    lots: session.lots.map((l) => ({
      ...l,
      leaderId: '2',
      leaderName: 'Khách',
      deadline: Date.now() + 5000
    }))
  };
  update();
  await page.getByRole('button', { name: 'Kết thúc live', exact: true }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog.getByText(/Có người đang dẫn đầu/)).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Xác nhận kết thúc', exact: true })
  ).toBeDisabled();
  session = { ...session, status: 'PAUSED', version: '3' };
  update();
  await expect(dialog.getByText(/Có lượt trả giá đang tạm dừng/)).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Xác nhận kết thúc', exact: true })
  ).toBeDisabled();
  expect(commands).toHaveLength(0);
  session = { ...session, version: '4', lots: session.lots.map((l) => ({ ...l, status: 'SOLD' })) };
  update();
  await expect(
    dialog.getByRole('button', { name: 'Xác nhận kết thúc', exact: true })
  ).toBeEnabled();
  await dialog.getByRole('button', { name: 'Xác nhận kết thúc', exact: true }).click();
  await expect(page).toHaveURL(/\/901\/results$/);
});
