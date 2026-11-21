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

// Real Chromium WebRTC between two Electron apps; only HTTP/signaling are fixtures.
test.setTimeout(60000);
let apps: ElectronApplication[];
let sockets: Map<string, WebSocketRoute>;
let session: LiveSession;
function snapshot() {
  return { session, wallet: null, orders: [], serverNow: Date.now() };
}
function broadcast(reason: string) {
  session = { ...session, version: (BigInt(session.version) + 1n).toString() };
  for (const socket of sockets.values())
    socket.send(JSON.stringify({ type: 'STATE', reason, data: snapshot() }));
}

async function launch(host: boolean, profile: string) {
  const key = host ? 'host' : 'viewer';
  const env = Object.fromEntries(
    Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined)
  );
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_DEV_URL;
  const app = await electron.launch({
    args: [path.resolve('.'), `--user-data-dir=${profile}`],
    env
  });
  apps.push(app);
  const page = await app.firstWindow();
  await page.addInitScript(() => {
    (window as any).videoPeers = [];
    const NativePeer = RTCPeerConnection;
    window.RTCPeerConnection = class extends NativePeer {
      constructor(config?: RTCConfiguration) {
        super(config);
        (window as any).videoPeers.push(this);
      }
    };
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async (constraints: MediaStreamConstraints) => {
        if (constraints.video) {
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = 360;
          const context = canvas.getContext('2d')!;
          let frame = 0;
          const draw = () => {
            context.fillStyle = ++frame % 2 ? '#145c53' : '#dcaa69';
            context.fillRect(0, 0, 640, 360);
          };
          draw();
          const stream = canvas.captureStream(15);
          const timer = setInterval(() => {
            if (stream.getVideoTracks()[0].readyState === 'ended') clearInterval(timer);
            else draw();
          }, 66);
          return stream;
        }
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const destination = context.createMediaStreamDestination();
        oscillator.connect(destination);
        oscillator.start();
        destination.stream
          .getAudioTracks()[0]
          .addEventListener('ended', () => void context.close());
        await context.resume();
        return destination.stream;
      }
    });
  });
  await page.route('**/api/auth/me', (r) =>
    r.fulfill({ json: { id: host ? 1 : 2, username: key, role: host ? 'ADMIN' : 'USER' } })
  );
  await page.route('**/api/auth/csrf', (r) => r.fulfill({ json: { token: 'test-csrf' } }));
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
  await page.route('**/api/livestreams/991/snapshot', (r) => r.fulfill({ json: snapshot() }));
  await page.route('**/api/livestreams/991/ice-config', (r) =>
    r.fulfill({ json: { iceServers: [] } })
  );
  await page.route('**/api/admin/livestreams/991/resume', async (r) => {
    session = { ...session, status: 'LIVE' };
    broadcast('COMMAND');
    await r.fulfill({ json: snapshot() });
  });
  await page.routeWebSocket('**/ws/livestream', (socket) => {
    sockets.set(key, socket);
    socket.onMessage((raw) => {
      const message = JSON.parse(raw.toString());
      if (message.type === 'JOIN') broadcast('JOINED');
      if (message.type === 'MEDIA_READY' && host) {
        session = {
          ...session,
          publisherReady: message.ready,
          status: !message.ready && session.status === 'LIVE' ? 'PAUSED' : session.status
        };
        broadcast('MEDIA_READY');
      }
      if (message.type === 'SIGNAL')
        sockets.get(message.target)?.send(
          JSON.stringify({
            ...message,
            sender: key
          })
        );
    });
    socket.send(JSON.stringify({ type: 'WELCOME', connectionId: key }));
  });
  await page.goto(
    host ? 'app://auction/#/admin/livestream/991' : 'app://auction/#/livestream/991/room'
  );
  await page.reload();
  await expect(page.getByText('Đã đồng bộ phòng', { exact: true })).toBeVisible();
  return page;
}

async function videoTrack(page: Page) {
  return page
    .locator('video[aria-label="Livestream từ host"]')
    .evaluate((video: HTMLVideoElement) => {
      const track = (video.srcObject as MediaStream | null)?.getVideoTracks()[0];
      return video.videoWidth > 0 && video.readyState >= 2 && track?.readyState === 'live'
        ? track.id
        : '';
    });
}
async function decodedFrames(page: Page) {
  return page.evaluate(async () => {
    let frames = 0;
    for (const pc of (window as any).videoPeers as RTCPeerConnection[]) {
      if (pc.connectionState !== 'connected') continue;
      (await pc.getStats()).forEach((row) => {
        if (row.type === 'inbound-rtp' && row.kind === 'video') frames += row.framesDecoded ?? 0;
      });
    }
    return frames;
  });
}

test.beforeEach(() => {
  apps = [];
  sockets = new Map();
  session = {
    id: '991',
    title: 'Khôi phục camera',
    description: '',
    hostId: '1',
    hostName: 'host',
    version: '1',
    serverNow: Date.now(),
    startsAt: Date.now(),
    status: 'SCHEDULED',
    currentLotIndex: 0,
    publisherReady: false,
    mediaGeneration: '1',
    hostConnectionId: 'host',
    connections: [{ id: 'viewer', userId: '2' }],
    remainingMs: null,
    pauseUntil: null,
    participants: [{ id: '2', username: 'viewer' }],
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
        status: 'PRESENTING',
        leaderId: null,
        leaderName: null,
        deadline: null,
        bids: []
      }
    ]
  };
});
test.afterEach(async () => {
  await Promise.allSettled(apps.map((app) => app.close()));
});

test('existing viewer receives a fresh camera after repeated off/on while auction stays paused', async ({}, info) => {
  const host = await launch(true, info.outputPath('host-profile'));
  const viewer = await launch(false, info.outputPath('viewer-profile'));
  // Begin with a live stream, then reproduce the server's camera-off -> PAUSED transition.
  await host.getByRole('button', { name: 'Bật camera', exact: true }).click();
  await expect.poll(() => session.publisherReady).toBe(true);
  await expect.poll(() => videoTrack(viewer), { timeout: 10000 }).not.toBe('');
  expect(session.status).toBe('SCHEDULED');
  session = { ...session, status: 'LIVE' };
  broadcast('COMMAND');
  await expect.poll(() => videoTrack(viewer), { timeout: 10000 }).not.toBe('');
  let previousTrack = await videoTrack(viewer);
  for (let attempt = 0; attempt < 2; attempt++) {
    await host.getByRole('button', { name: 'Tắt camera', exact: true }).click();
    await expect(viewer.getByText(/Phiên tạm dừng\./)).toBeVisible();
    await expect.poll(() => videoTrack(viewer)).toBe('');
    await host.getByRole('button', { name: 'Bật camera', exact: true }).click();
    await expect(host.getByRole('button', { name: 'Tiếp tục đấu', exact: true })).toBeEnabled();
    await expect.poll(() => videoTrack(viewer), { timeout: 8000 }).not.toBe('');
    const nextTrack = await videoTrack(viewer);
    expect(nextTrack).not.toBe(previousTrack);
    await expect.poll(() => decodedFrames(viewer)).toBeGreaterThan(3);
    expect(session.status).toBe('PAUSED');
    previousTrack = nextTrack;
    await host.getByRole('button', { name: 'Tiếp tục đấu', exact: true }).click();
    await expect(viewer.getByText(/Phiên tạm dừng\./)).toHaveCount(0);
    await expect.poll(() => videoTrack(viewer), { timeout: 8000 }).not.toBe('');
  }
  await host.getByRole('button', { name: 'Bật mic', exact: true }).click();
  await expect
    .poll(() =>
      viewer
        .locator('video')
        .evaluate(
          (v: HTMLVideoElement) => (v.srcObject as MediaStream | null)?.getAudioTracks().length ?? 0
        )
    )
    .toBe(1);
  await expect.poll(() => decodedFrames(viewer)).toBeGreaterThan(3);
  session = {
    ...session,
    status: 'ENDED',
    publisherReady: false,
    lots: session.lots.map((l) => ({ ...l, status: 'UNSOLD' }))
  };
  broadcast('ENDED');
  await expect(
    viewer.getByRole('heading', { name: 'Phiên livestream đã kết thúc', exact: true })
  ).toBeVisible();
  await expect(viewer.locator('video')).toHaveCount(0);
  for (const page of [host, viewer])
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as any).videoPeers.every(
            (pc: RTCPeerConnection) => pc.connectionState === 'closed'
          )
        )
      )
      .toBe(true);
});
