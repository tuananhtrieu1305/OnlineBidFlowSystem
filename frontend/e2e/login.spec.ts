import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';

let app: ElectronApplication;
let page: Page;
test.beforeEach(async ({}, info) => {
  const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  delete env.ELECTRON_RUN_AS_NODE; delete env.ELECTRON_DEV_URL;
  app = await electron.launch({ args: [path.resolve('.'), `--user-data-dir=${info.outputPath('profile')}`], env });
  page = await app.firstWindow();
  await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: {} }));
  await page.route('**/api/auth/csrf', route => route.fulfill({ json: { token: 'csrf-test' } }));
  await page.goto('app://auction/#/login');
});
test.afterEach(async () => { await app?.close(); });

test('validates required fields, toggles password and links registration', async () => {
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Vui lòng nhập');
  await expect(page.getByLabel('Tên đăng nhập')).toBeFocused();
  await page.getByLabel('Mật khẩu', { exact: true }).fill('test');
  await page.getByRole('button', { name: 'Hiện mật khẩu' }).click();
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Ẩn mật khẩu' }).click();
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveAttribute('type', 'password');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(820, 650));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Tạo tài khoản' }).click();
  await page.getByRole('link', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Chào mừng bạn trở lại.' })).toBeVisible();
});

test('handles credentials, CSRF expiry, rate limits and offline errors', async () => {
  for (const [status, message] of [
    [401, 'Tên đăng nhập hoặc mật khẩu không đúng.'],
    [403, 'Phiên xác thực đã hết hạn. Vui lòng đăng nhập lại.'],
    [429, 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau một phút.'],
    [500, 'Máy chủ chưa thể đăng nhập. Vui lòng thử lại sau.'],
    [0, 'Chưa nhận được xác nhận đăng nhập. Kiểm tra kết nối và thử lại.']
  ] as const) {
    await page.route('**/api/auth/login', route => status ? route.fulfill({ status, json: {} }) : route.abort());
    await page.getByLabel('Tên đăng nhập').fill('batien');
    await page.getByLabel('Mật khẩu', { exact: true }).fill('password');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText(message);
    await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveValue('');
    await page.unroute('**/api/auth/login');
  }
});

test('admin session restores, expires and cannot be replaced by local storage role', async () => {
  const user = { id: 7, username: 'admin_test', role: 'ADMIN' };
  await page.route('**/api/auth/login', async route => {
    expect(route.request().headers()['x-csrf-token']).toBe('csrf-test');
    expect(route.request().postDataJSON()).toEqual({ username: 'admin_test', password: 'password' });
    await route.fulfill({ json: user });
  });
  await page.getByLabel('Tên đăng nhập').fill(' ADMIN_TEST ');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Chào mừng, admin_test.' })).toBeVisible();
  await page.unroute('**/api/auth/me');
  await page.route('**/api/auth/me', route => route.fulfill({ json: user }));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Chào mừng, admin_test.' })).toBeVisible();
  await page.unroute('**/api/auth/me');
  await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: {} }));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Chào mừng bạn trở lại.' })).toBeVisible();
  await page.evaluate(() => localStorage.setItem('role', 'ADMIN'));
  await page.goto('app://auction/#/admin');
  await expect(page.getByRole('heading', { name: 'Chào mừng bạn trở lại.' })).toBeVisible();
});

test('logout waits for server confirmation and can retry', async () => {
  await page.route('**/api/auth/me', route => route.fulfill({ json: { id: 1, username: 'batien', role: 'USER' } }));
  await page.goto('app://auction/');
  await page.route('**/api/auth/logout', route => route.abort());
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(page.getByRole('complementary').getByRole('alert')).toContainText('Chưa thể đăng xuất');
  await expect(page.getByRole('complementary').getByRole('heading', { name: 'batien' })).toBeVisible();
  await page.unroute('**/api/auth/logout');
  await page.route('**/api/auth/logout', route => route.fulfill({ status: 204 }));
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Đăng nhập', exact: true })).toBeVisible();
});

test('late unauthorized response from old login cannot clear a new admin session', async () => {
  const alice={id:2,username:'alice',role:'USER'};
  const admin={id:1,username:'admin_test',role:'ADMIN'};
  await page.route('**/api/auth/me',r=>r.fulfill({json:alice}));
  await page.goto('app://auction/');
  let pending:import('@playwright/test').Route|undefined;
  await page.route('**/api/wallet',r=>{pending=r;});
  await page.route('**/api/wallet/transactions?*',r=>r.fulfill({json:{items:[],nextCursor:null}}));
  await page.getByRole('link',{name:'Ví Coin'}).click();
  await expect.poll(()=>!!pending).toBe(true);
  await page.route('**/api/auth/logout',r=>r.fulfill({status:204}));
  await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();
  await page.route('**/api/auth/login',r=>r.fulfill({json:admin}));
  await page.route('**/api/auth/me',r=>r.fulfill({json:admin}));
  await page.getByLabel('Tên đăng nhập').fill('admin_test');
  await page.getByLabel('Mật khẩu',{exact:true}).fill('password');
  await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Chào mừng, admin_test.'})).toBeVisible();
  const late=page.waitForResponse(r=>r.url().endsWith('/api/wallet')&&r.status()===401);
  await pending!.fulfill({status:401,json:{code:'UNAUTHENTICATED'}});await late;
  // Allow the response interceptor and React to process before asserting identity.
  await page.getByRole('link',{name:'Người dùng',exact:true}).click();
  await expect(page.getByRole('complementary').getByRole('heading',{name:'admin_test',exact:true})).toBeVisible();
});
