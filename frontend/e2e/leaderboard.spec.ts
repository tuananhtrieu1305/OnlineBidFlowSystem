import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import path from 'node:path';

let app: ElectronApplication;
test.afterEach(async () => { await app?.close(); });

async function launch(info: { outputPath: (name: string) => string }) {
  const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string,string] => entry[1] !== undefined));
  delete env.ELECTRON_RUN_AS_NODE; delete env.ELECTRON_DEV_URL;
  app = await electron.launch({ args: [path.resolve('.'), `--user-data-dir=${info.outputPath('profile')}`], env });
  return app.firstWindow();
}

test('guest sees public ranks and can filter to monthly BLIND results', async ({}, info) => {
  const page = await launch(info);
  await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: { code: 'UNAUTHENTICATED' } }));
  let privateRequests = 0;
  await page.route('**/api/leaderboard/me?*', route => { privateRequests++; return route.abort(); });
  await page.route('**/api/leaderboard?*', route => {
    const url = new URL(route.request().url());
    const blind = url.searchParams.get('type') === 'BLIND';
    const monthly = url.searchParams.get('period') === 'MONTH';
    return route.fulfill({ json: { type: blind ? 'BLIND' : 'ALL', period: monthly ? 'MONTH' : 'ALL_TIME',
      month: monthly ? '2026-10' : null, totalPlayers: blind ? 1 : 2,
      top: blind ? [{ id: '2', username: 'alice', rank: 1, wins: 1, played: 2 }] : [
        { id: '2', username: 'alice', rank: 1, wins: 3, played: 5 },
        { id: '3', username: 'bob', rank: 2, wins: 1, played: 3 }] } });
  });
  await page.goto('app://auction/#/leaderboard');
  await expect(page.getByRole('heading', { name: 'Những người chơi dẫn đầu' })).toBeVisible();
  await expect(page.getByText('3 lần thắng')).toBeVisible();
  await expect(page.getByText('Đăng nhập để xem vị trí')).toBeVisible();
  await page.getByRole('button', { name: 'Tháng này' }).click();
  await page.getByRole('button', { name: 'Chỉ BLIND' }).click();
  await expect(page.getByText('Tháng 10/2026')).toBeVisible();
  await expect(page.getByText('1 lần thắng')).toBeVisible();
  expect(privateRequests).toBe(0);
});

test('user sees own rank and private achievements without exposing private auction details', async ({}, info) => {
  const page = await launch(info);
  await page.route('**/api/auth/me', route => route.fulfill({ json: { id: 8, username: 'charlie', role: 'USER' } }));
  await page.route('**/api/leaderboard?*', route => route.fulfill({ json: { type: 'ALL', period: 'ALL_TIME', month: null, totalPlayers: 12,
    top: [{ id: '2', username: 'alice', rank: 1, wins: 5, played: 8 }] } }));
  await page.route('**/api/leaderboard/me?*', route => route.fulfill({ json: {
    publicRank: { id: '8', username: 'charlie', rank: 12, wins: 1, played: 4 },
    privateStats: { wins: 2, played: 3, coinSpent: '600' },
    allStats: { wins: 3, played: 7, coinSpent: '900' }
  } }));
  await page.goto('app://auction/#/leaderboard');
  await expect(page.getByRole('heading', { name: 'Thành tích của bạn' })).toBeVisible();
  await expect(page.getByText('#12', { exact: true })).toBeVisible();
  await expect(page.getByText('900 Coin')).toBeVisible();
  await expect(page.getByText('Không tính giao dịch Clue')).toBeVisible();
  await expect(page.getByText('RANKROOM')).toHaveCount(0);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(820, 650));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
