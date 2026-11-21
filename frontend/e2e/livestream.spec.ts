import {
  _electron as electron,
  test,
  expect,
  type ElectronApplication,
  type Page
} from '@playwright/test';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Explicitly opt in: this suite connects to a real isolated backend/MySQL.
test.skip(
  process.env.LIVESTREAM_E2E !== 'true',
  'Requires the isolated local backend documented in docs/livestream.md'
);
test.setTimeout(120000);
const base = process.env.LIVESTREAM_API_URL ?? 'http://localhost:18081';
let host: ElectronApplication, viewer: ElectronApplication, other: ElectronApplication;
let hostPage: Page, viewerPage: Page, otherPage: Page;
const prefix = 'e2elive_' + Date.now();
async function launch(info: any, name: string) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  );
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_DEV_URL;
  const app = await electron.launch({
    args: [path.resolve('.'), `--user-data-dir=${info.outputPath(name)}`],
    env
  });
  return { app, page: await app.firstWindow() };
}
async function login(page: Page, username: string) {
  await page.goto('app://auction/#/login');
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill(username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Password@123');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Đăng xuất', exact: true })).toBeVisible();
}
async function request(page: Page, url: string, body?: object) {
  return page.evaluate(
    async ({ base, url, body }) => {
      const csrf = await fetch(base + '/api/auth/csrf', { credentials: 'include' }).then((r) =>
        r.json()
      );
      const r = await fetch(base + url, {
        method: body ? 'POST' : 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf.token },
        body: body ? JSON.stringify(body) : undefined
      });
      const data = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(data));
      return data;
    },
    { base, url, body }
  );
}
async function syntheticCamera(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async (constraints: MediaStreamConstraints) => {
        if (constraints.video) {
          const canvas = document.createElement('canvas');
          canvas.width = 1280;
          canvas.height = 720;
          const ctx = canvas.getContext('2d')!;
          let frame = 0;
          const timer = setInterval(() => {
            ctx.fillStyle = frame++ % 2 ? '#145c53' : '#dcaa69';
            ctx.fillRect(0, 0, 1280, 720);
          }, 66);
          const stream = canvas.captureStream(15);
          stream.getVideoTracks()[0].addEventListener('ended', () => clearInterval(timer));
          return stream;
        }
        const audio = new AudioContext();
        const source = audio.createOscillator();
        const dest = audio.createMediaStreamDestination();
        source.connect(dest);
        source.start();
        await audio.resume();
        return dest.stream;
      }
    });
  });
}
async function mediaProbe(page: Page) {
  await page.evaluate((relay) => {
    const Native = window.RTCPeerConnection;
    (window as any).testPeers = [];
    window.RTCPeerConnection = class extends Native {
      constructor(config?: RTCConfiguration) {
        super({ ...config, iceTransportPolicy: relay ? 'relay' : 'all' });
        (window as any).testPeers.push(this);
      }
    };
  }, process.env.LIVESTREAM_FORCE_RELAY === 'true');
}
test.afterEach(async () => {
  await Promise.allSettled([host?.close(), viewer?.close(), other?.close()]);
});

test('real host and viewers transmit video/audio, settle once, pause/resume and do not replay gavel', async ({
  request: publicClient
}, info) => {
  ({ app: host, page: hostPage } = await launch(info, 'host'));
  ({ app: viewer, page: viewerPage } = await launch(info, 'viewer'));
  ({ app: other, page: otherPage } = await launch(info, 'other'));
  // Fixture-only account creation in the dedicated test container. Funding uses the real ledger API.
  execFileSync('docker', [
    'exec',
    'onlinebidflow-livestream-test',
    'mysql',
    '-uroot',
    '-plive_local_test',
    'auction_db',
    '-e',
    `INSERT INTO users(username,password_hash,role) SELECT '${prefix}a',password_hash,'USER' FROM users WHERE username='admin'; INSERT INTO users(username,password_hash,role) SELECT '${prefix}b',password_hash,'USER' FROM users WHERE username='admin'; INSERT INTO wallets(user_id,wallet_type,available_balance,locked_balance,updated_at) SELECT id,'USER',0,0,UTC_TIMESTAMP(6) FROM users WHERE username IN ('${prefix}a','${prefix}b');`
  ]);
  await login(hostPage, 'admin');
  await login(viewerPage, prefix + 'a');
  await login(otherPage, prefix + 'b');
  await request(viewerPage, '/api/wallet/deposits', { amount: '2000' });
  await request(otherPage, '/api/wallet/deposits', { amount: '2000' });
  // Product creation uses the existing multipart API, then reads its server version.
  await Promise.all([hostPage, viewerPage, otherPage].map(mediaProbe));
  const p = await hostPage.evaluate(
    async ({ base, name }) => {
      const csrf = await fetch(base + '/api/auth/csrf', { credentials: 'include' }).then((r) =>
        r.json()
      );
      const form = new FormData();
      form.append(
        'data',
        new Blob(
          [
            JSON.stringify({
              name,
              description: 'Real integration lot',
              quantity: 1,
              estimatedPrice: '100'
            })
          ],
          { type: 'application/json' }
        )
      );
      const r = await fetch(base + '/api/admin/products', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-TOKEN': csrf.token },
        body: form
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    { base, name: prefix }
  );
  const session = await request(hostPage, '/api/admin/livestreams', {
    requestId: crypto.randomUUID(),
    title: prefix,
    description: 'Local integration',
    startsAt: Date.now() + 60000,
    lots: [{ productId: p.id, productVersion: p.version, startingPrice: '100' }]
  });
  expect((await publicClient.get(base + '/api/livestreams')).status()).toBe(200);
  expect((await publicClient.get(base + '/api/livestreams/' + session.id)).status()).toBe(200);
  for (const suffix of ['/snapshot', '/ice-config'])
    expect(
      (await publicClient.get(base + '/api/livestreams/' + session.id + suffix)).status()
    ).toBe(401);
  await expect(
    request(viewerPage, '/api/admin/livestreams/' + session.id + '/start', {
      requestId: crypto.randomUUID()
    })
  ).rejects.toThrow('FORBIDDEN');
  const csrfStatus = await viewerPage.evaluate(
    async ({ base, id }) =>
      (
        await fetch(base + '/api/livestreams/' + id + '/registration', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ registered: true })
        })
      ).status,
    { base, id: session.id }
  );
  expect(csrfStatus).toBe(403);
  await hostPage.goto(`app://auction/#/admin/livestream/${session.id}`);
  await syntheticCamera(hostPage);
  await hostPage.getByRole('button', { name: 'Bật camera', exact: true }).click();
  await hostPage.getByRole('button', { name: 'Bật mic', exact: true }).click();
  await viewerPage.goto(`app://auction/#/livestream/${session.id}/room`);
  await otherPage.goto(`app://auction/#/livestream/${session.id}/room`);
  await hostPage.getByRole('button', { name: 'Bắt đầu live', exact: true }).click();
  await expect
    .poll(() => viewerPage.locator('video').evaluate((v: HTMLVideoElement) => v.videoWidth))
    .toBeGreaterThan(0);
  await expect
    .poll(() => otherPage.locator('video').evaluate((v: HTMLVideoElement) => v.videoWidth))
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      viewerPage
        .locator('video')
        .evaluate(
          (v: HTMLVideoElement) => (v.srcObject as MediaStream)?.getAudioTracks().length ?? 0
        )
    )
    .toBe(1);
  await expect
    .poll(() =>
      viewerPage.evaluate(async () => {
        let packets = 0;
        for (const pc of (window as any).testPeers as RTCPeerConnection[]) {
          const stats = await pc.getStats();
          stats.forEach((row) => {
            if (row.type === 'inbound-rtp' && row.kind === 'audio') packets += row.packetsReceived;
          });
        }
        return packets;
      })
    )
    .toBeGreaterThan(0);
  if (process.env.LIVESTREAM_FORCE_RELAY === 'true') {
    await expect
      .poll(() =>
        viewerPage.evaluate(async () => {
          for (const pc of (window as any).testPeers as RTCPeerConnection[]) {
            const stats = await pc.getStats();
            let relay = false;
            stats.forEach((row) => {
              if (row.type === 'candidate-pair' && row.state === 'succeeded' && row.nominated)
                relay ||= stats.get(row.localCandidateId)?.candidateType === 'relay';
            });
            if (relay) return true;
          }
          return false;
        })
      )
      .toBe(true);
  }
  const admission = await viewerPage.evaluate(
    async ({ base, sessionId }) => {
      (window as any).extraSockets = [];
      const results: boolean[] = [];
      for (let i = 0; i < 9; i++) {
        results.push(
          await new Promise<boolean>((resolve, reject) => {
            const ws = new WebSocket(base.replace('http', 'ws') + '/ws/livestream');
            (window as any).extraSockets.push(ws);
            const timer = setTimeout(() => reject(new Error('Admission timed out')), 10000);
            ws.onmessage = (e) => {
              const m = JSON.parse(e.data);
              if (m.type === 'WELCOME') ws.send(JSON.stringify({ type: 'JOIN', sessionId }));
              if (m.type === 'STATE' || m.type === 'ERROR') {
                clearTimeout(timer);
                resolve(m.type === 'STATE');
              }
            };
          })
        );
      }
      (window as any).extraSockets.forEach((ws: WebSocket) => ws.close());
      return results;
    },
    { base, sessionId: session.id }
  );
  expect(admission.filter(Boolean)).toHaveLength(8);
  expect(admission[8]).toBe(false);

  await viewerPage.getByLabel('Tin nhắn', { exact: true }).fill('Chào host từ cửa sổ thật');
  await viewerPage.getByRole('button', { name: 'Gửi', exact: true }).click();
  await expect(otherPage.getByText('Chào host từ cửa sổ thật', { exact: false })).toBeVisible();
  await hostPage.getByRole('button', { name: 'Mở đấu giá sản phẩm', exact: true }).click();
  await viewerPage.getByLabel('Giá của bạn (Coin)', { exact: true }).fill('137');
  await viewerPage.getByRole('button', { name: 'Đặt 137 Coin', exact: true }).click();
  await expect(otherPage.getByTestId('live-current-price')).toContainText('137');
  // Leaving the host room closes presence and freezes the authoritative countdown.
  await hostPage.goto('app://auction/#/admin/livestream');
  await expect(viewerPage.getByText('Phiên tạm dừng.', { exact: false })).toBeVisible();
  const paused = await request(viewerPage, `/api/livestreams/${session.id}/snapshot`);
  await expect(viewerPage.getByLabel('Giá của bạn (Coin)', { exact: true })).toBeDisabled();
  await hostPage.goto(`app://auction/#/admin/livestream/${session.id}`);
  await syntheticCamera(hostPage);
  await hostPage.getByRole('button', { name: 'Bật camera', exact: true }).click();
  await expect(hostPage.getByRole('button', { name: 'Tiếp tục đấu', exact: true })).toBeEnabled();
  await viewerPage.evaluate(() => {
    (window as any).gavelHits = 0;
    for (const name of ['animationstart', 'animationiteration'])
      document.addEventListener(name, (e) => {
        if ((e.target as Element).classList.contains('live-gavel-hammer'))
          (window as any).gavelHits++;
      });
  });
  await hostPage.getByRole('button', { name: 'Tiếp tục đấu', exact: true }).click();
  await expect(viewerPage.getByText('Bạn đã thắng', { exact: true })).toBeVisible({
    timeout: 12000
  });
  await expect.poll(() => viewerPage.evaluate(() => (window as any).gavelHits)).toBe(3);
  await expect(viewerPage.getByTestId('live-sale-overlay')).toHaveCount(0);
  const purchases = await request(viewerPage, '/api/livestreams/purchases');
  expect(purchases).toHaveLength(1);
  expect(purchases[0].paid).toBe(true);
  expect(purchases[0].amount).toBe('137');
  const state = await request(viewerPage, '/api/livestreams/state');
  expect(state.wallet.availableBalance).toBe('1863');
  expect(state.wallet.lockedBalance).toBe('0');
  expect(paused.session.remainingMs).toBeGreaterThan(0);
  await viewerPage.reload();
  await expect(viewerPage.getByText('Bạn đã thắng', { exact: true })).toBeVisible();
  await expect(viewerPage.locator('.live-gavel-scene')).toHaveCount(0);
  await expect
    .poll(() => viewerPage.locator('video').evaluate((v: HTMLVideoElement) => v.videoWidth), {
      timeout: 15000
    })
    .toBeGreaterThan(0);
  await hostPage.screenshot({ path: info.outputPath('host-room.png'), fullPage: true });
  await viewerPage.screenshot({ path: info.outputPath('viewer-room.png'), fullPage: true });
});
