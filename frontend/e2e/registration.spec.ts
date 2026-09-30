import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';

let app: ElectronApplication;
let page: Page;
test.beforeEach(async ({}, info) => {
  const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_DEV_URL;
  const executablePath = process.env.E2E_EXECUTABLE;
  app = await electron.launch({ ...(executablePath ? { executablePath } : {}), args: [...(executablePath ? [] : [path.resolve('.')]), `--user-data-dir=${info.outputPath('profile')}`], env });
  page = await app.firstWindow();
  await page.goto('app://auction/#/register');
});
test.afterEach(async () => { await app?.close(); });

test('shows the registration form and prevents invalid submissions', async ({}, info) => {
  await expect(page.getByRole('heading', { name: 'Bắt đầu bộ sưu tập của bạn.' })).toBeVisible();
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  await expect(page.getByText('Tên đăng nhập cần từ 3 đến 50 ký tự.')).toBeVisible();
  await page.screenshot({ path: info.outputPath('registration-validation.png') });
});

test('creates an account only after server confirmation', async ({}, info) => {
  await page.route('**/api/auth/register', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ username: 'batien', password: 'my-password-123' });
    await route.fulfill({ status: 201, json: { id: 42, username: 'batien', role: 'USER' } });
  });
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill('batien');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('my-password-123');
  await page.getByLabel('Xác nhận mật khẩu', { exact: true }).fill('my-password-123');
  await page.screenshot({ path: info.outputPath('registration.png'), fullPage: true });
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Chào mừng, batien.' })).toBeVisible();
  await expect(page.getByText('Tài khoản và ví Coin của bạn đã được tạo.')).toBeVisible();
});

test('handles duplicate names, rate limits and unavailable server', async () => {
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill('batien');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('my-password-123');
  await page.getByLabel('Xác nhận mật khẩu', { exact: true }).fill('my-password-123');
  for (const [status, message] of [
    [409, 'Tên đăng nhập đã được sử dụng. Hãy chọn tên khác.'],
    [429, 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau một phút.'],
    [500, 'Máy chủ chưa thể tạo tài khoản. Vui lòng thử lại sau.']
  ] as const) {
    await page.unroute('**/api/auth/register');
    await page.route('**/api/auth/register', route => route.fulfill({ status, json: {} }));
    await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
    if (status === 409) await expect(page.getByText(message, { exact: true })).toBeVisible();
    else await expect(page.getByRole('alert')).toContainText(message);
  }
  await page.unroute('**/api/auth/register');
  await page.route('**/api/auth/register', route => route.abort());
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('tài khoản có thể đã được tạo');
});

test('supports password visibility and a narrow window without horizontal overflow', async () => {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(820, 650));
  await page.getByLabel('Mật khẩu', { exact: true }).fill('my-password-123');
  await page.getByRole('button', { name: 'Hiện mật khẩu', exact: true }).click();
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Ẩn mật khẩu', exact: true }).click();
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveAttribute('type', 'password');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
