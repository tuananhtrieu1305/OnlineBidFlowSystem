import { _electron as electron, expect, test } from '@playwright/test';
import path from 'node:path';

test('real registration login cookie reload and logout in Electron', async ({}, info) => {
  const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  delete env.ELECTRON_RUN_AS_NODE; delete env.ELECTRON_DEV_URL;
  const executablePath = process.env.E2E_EXECUTABLE;
  const app = await electron.launch({ ...(executablePath ? { executablePath } : {}), args: [...(executablePath ? [] : [path.resolve('.')]), `--user-data-dir=${info.outputPath('profile')}`], env });
  try {
    const page = await app.firstWindow();
    const username = `login_desktop_${Date.now()}`;
    await page.goto('app://auction/#/register');
    await page.getByLabel('Tên đăng nhập', { exact: true }).fill(username);
    await page.getByLabel('Mật khẩu', { exact: true }).fill('my-password-123');
    await page.getByLabel('Xác nhận mật khẩu').fill('my-password-123');
    await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
    await expect(page.getByRole('heading', { name: `Chào mừng, ${username}.` })).toBeVisible();
    await page.getByRole('link', { name: 'Đăng nhập', exact: true }).click();
    await page.screenshot({ path: info.outputPath('login.png'), fullPage: true });
    await page.getByLabel('Tên đăng nhập', { exact: true }).fill(username);
    await page.getByLabel('Mật khẩu', { exact: true }).fill('wrong');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Tên đăng nhập hoặc mật khẩu không đúng.');
    await page.getByLabel('Mật khẩu', { exact: true }).fill('my-password-123');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(page.getByRole('complementary').getByRole('heading', { name: username })).toBeVisible();
    const cookies = await app.evaluate(async ({ session }) => session.defaultSession.cookies.get({ name: 'OBFSESSION' }));
    expect(cookies).toHaveLength(1);
    expect(cookies[0].httpOnly).toBe(true); expect(cookies[0].secure).toBe(true);
    expect(await page.evaluate(() => document.cookie)).not.toContain('OBFSESSION');
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
    await page.reload();
    await expect(page.getByRole('complementary').getByRole('heading', { name: username })).toBeVisible();
    await page.getByRole('link', { name: 'Ví Coin' }).click();
    await expect(page.getByText('Chưa có giao dịch', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '＋ Nạp Coin' }).click();
    await page.getByLabel('Số Coin muốn nạp').fill('1250');
    await page.getByRole('button', { name: 'Xác nhận nạp' }).click();
    await expect(page.getByLabel('Số dư ví')).toContainText('1.250');
    await expect(page.getByRole('cell', { name: '+1.250', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Số dư ví')).toContainText('1.250');
    await page.screenshot({ path: info.outputPath('wallet.png'), fullPage: true });
    const pong = await page.evaluate(() => new Promise<string>((resolve, reject) => {
      const socket = new WebSocket('ws://localhost:18080/ws/auction?userId=999&role=ADMIN');
      (window as unknown as { testSocket: WebSocket }).testSocket = socket;
      const timeout = setTimeout(() => { socket.close(); reject(new Error('Socket authentication timed out')); }, 5000);
      socket.onopen = () => socket.send(JSON.stringify({ type: 'PING' }));
      socket.onmessage = event => { clearTimeout(timeout); resolve(String(event.data)); };
      socket.onerror = () => { clearTimeout(timeout); reject(new Error('Socket authentication failed')); };
    }));
    expect(JSON.parse(pong).payload).toMatchObject({ username, role: 'USER' });
    await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Chào mừng bạn trở lại.' })).toBeVisible();
    await page.waitForFunction(() => (window as unknown as { testSocket: WebSocket }).testSocket.readyState === WebSocket.CLOSED);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Chào mừng bạn trở lại.' })).toBeVisible();
  } finally { await app.close(); }
});
