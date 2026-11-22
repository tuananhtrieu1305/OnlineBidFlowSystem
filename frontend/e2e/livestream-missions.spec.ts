import { _electron as electron, test, expect, type ElectronApplication, type Page, type WebSocketRoute } from '@playwright/test';
import path from 'node:path';
import type { LiveSession, LivePersonalMission } from '../src/features/livestream/liveState';
let app: ElectronApplication, page: Page, socket: WebSocketRoute;
let session: LiveSession, mission: LivePersonalMission;
let role: 'USER' | 'ADMIN';
function snapshot() { return { session, mission: role === 'USER' ? mission : null, wallet: role === 'USER' ? { availableBalance: '800', lockedBalance: '0' } : null, orders: [], serverNow: Date.now() }; }
function update() {
  session = { ...session, version: (BigInt(session.version) + 1n).toString() };
  mission = { ...mission, version: session.version };
  socket.send(JSON.stringify({ type: 'STATE', reason: 'SNAPSHOT', data: snapshot() }));
}
test.beforeEach(async ({}, info) => {
  role = 'USER';
  session = { id: '901', hostId: '1', hostName: 'Host', title: 'Săn vé bí ẩn', description: '', startsAt: Date.now(), status: 'SCHEDULED', version: '1', currentLotIndex: 0, serverNow: Date.now(), publisherReady: false, mediaGeneration: '1', hostConnectionId: null, connections: [], remainingMs: null, pauseUntil: null, participants: [], messages: [], mysteryEnabled: true, finalState: 'LOCKED', ticketCount: 0,
    lots: [{ id: '801', auctionId: '701', productId: '601', name: 'Bàn phím', description: '', imageUrl: null, startingPrice: '100', currentPrice: '100', status: 'QUEUED', leaderId: null, leaderName: null, deadline: null, bids: [] }] };
  mission = { sessionId: session.id, userId: '2', version: session.version, status: 'ASSIGNED', title: 'Mua bàn phím và chuột', progress: 0, ticket: false, groupA: [{ productId: '601', name: 'Bàn phím', purchased: false }], groupB: [{ productId: '602', name: 'Chuột', purchased: false }] };
  const env = Object.fromEntries(Object.entries(process.env).filter((v): v is [string,string] => v[1] !== undefined));
  delete env.ELECTRON_RUN_AS_NODE; delete env.ELECTRON_DEV_URL;
  app = await electron.launch({ args: [path.resolve('.'), `--user-data-dir=${info.outputPath('profile')}`], env });
  page = await app.firstWindow();
  await page.waitForURL('app://auction/**');
  await page.route('**/api/auth/me', r => r.fulfill({ json: { id: role === 'USER' ? 2 : 1, username: role === 'USER' ? 'Viewer' : 'Host', role } }));
  await page.route('**/api/livestreams/state', r => r.fulfill({ json: { sessions: [session], wallet: snapshot().wallet, orders: [], registrations: [], notifications: [], serverNow: Date.now() } }));
  await page.route('**/api/livestreams/901', r => r.fulfill({ json: session }));
  await page.route('**/api/livestreams/901/snapshot', r => r.fulfill({ json: snapshot() }));
  await page.routeWebSocket('**/ws/livestream', ws => {
    socket = ws;
    ws.onMessage(raw => { if (JSON.parse(raw.toString()).type === 'JOIN') update(); });
    ws.send(JSON.stringify({ type: 'WELCOME', connectionId: 'mission-fixture' }));
  });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Đăng xuất', exact:true })).toBeVisible();
  await page.goto('app://auction/#/livestream/901/room'); await page.reload();
  await expect(page.getByText('Đã đồng bộ phòng', { exact: true })).toBeVisible();
});
test.afterEach(async () => { await app?.close(); });
test('viewer receives private task, progress and one ticket, keeping the task after reload', async ({}, info) => {
  const panel = page.getByRole('region', { name: 'Nhiệm vụ riêng của bạn' });
  await expect(panel.getByText('Mua bàn phím và chuột', { exact: true })).toBeVisible();
  await expect(panel.getByRole('progressbar')).toHaveAttribute('value', '0');
  mission = { ...mission, progress: 1 }; update();
  await expect(panel.getByRole('status')).toHaveText('Đã thanh toán 1/2 sản phẩm phù hợp');
  mission = { ...mission, progress: 2, ticket: true }; update();
  await expect(panel.getByRole('status')).toHaveText('Bạn đã nhận một vé vào vòng cuối');
  await page.reload();
  await expect(panel.getByText('Mua bàn phím và chuột', { exact: true })).toBeVisible();
  await expect(panel.getByRole('progressbar')).toHaveAttribute('value', '2');
  await expect(panel.getByRole('status')).toHaveText('Bạn đã nhận một vé vào vòng cuối');
  await page.screenshot({ path: info.outputPath('mission-ticket.png'), fullPage: true });
});
test('no feasible task is explained without displaying a prior private task', async () => {
  mission = { sessionId: '901', userId: '2', version: session.version, status: 'UNAVAILABLE', progress: 0, ticket: false }; update();
  const panel = page.getByRole('region', { name: 'Nhiệm vụ riêng của bạn' });
  await expect(panel.getByRole('status')).toContainText('Không còn nhiệm vụ khả thi');
  await expect(panel.getByRole('progressbar')).toHaveCount(0);
  await expect(panel.getByText('Mua bàn phím và chuột')).toHaveCount(0);
});
test('host sees only issued ticket count and can start the configured game', async () => {
  role = 'ADMIN'; session = { ...session, ticketCount: 3 };
  await page.goto('app://auction/#/admin/livestream/901'); await page.reload();
  await expect(page.getByRole('region', { name: 'Vé vào vòng cuối' }).getByRole('status')).toHaveText('Đã phát 3 vé');
  await expect(page.getByRole('heading', { name: 'Nhiệm vụ riêng của bạn' })).toHaveCount(0);
  await expect(page.getByText('Mua bàn phím và chuột', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Bắt đầu live', exact: true })).toBeVisible();
});


test('final product is announced before bidding and only a ticket unlocks the bid form', async ({}, info) => {
  const final = { ...session.lots[0], id: '802', productId: '602', auctionId: '702', name: 'Máy chơi game', kind: 'SECRET' as const, status: 'PRESENTING' as const };
  session = { ...session, status: 'LIVE', finalState: 'REVEALED', currentLotIndex: 1, lots: [{ ...session.lots[0], status:'SOLD' }, final] }; update();
  await expect(page.getByRole('region', { name: 'Vòng bí mật' }).getByText('Máy chơi game', { exact:true })).toBeVisible();
  await expect(page.getByLabel('Giá của bạn (Coin)')).toBeDisabled();
  session = { ...session, finalState:'OPEN', lots:[session.lots[0], { ...final, status:'OPEN' }] }; update();
  await expect(page.getByText('Bạn không có vé của phiên này. Bạn vẫn được xem và chat.', { exact:true })).toBeVisible();
  await expect(page.getByLabel('Giá của bạn (Coin)')).toBeDisabled();
  mission = { ...mission, progress:2, ticket:true }; update();
  await expect(page.getByLabel('Giá của bạn (Coin)')).toBeEnabled();
  await page.screenshot({ path:info.outputPath('final-revealed.png'), fullPage:true });
});
test('ended ineligible session keeps secret product and price hidden in results', async () => {
  session = { ...session, status:'ENDED', finalState:'SKIPPED', lots:[{...session.lots[0],status:'SOLD'}, { id:'802',kind:'SECRET',name:'Hộp bí mật',description:'',hidden:true,imageUrl:null,status:'UNSOLD',deadline:null,bids:[] } as any] }; update();
  await expect(page.getByRole('heading', {name:'Phiên livestream đã kết thúc',exact:true})).toBeVisible();
  await expect(page.getByText('Món bí mật chưa được tiết lộ.',{exact:true})).toBeVisible();
  await expect(page.getByRole('region',{name:'Vòng bí mật'}).getByRole('status')).toContainText('Không mở vòng bí mật');
  await expect(page.getByText('Giá khởi điểm 0 Coin',{exact:true})).toHaveCount(0);
});
