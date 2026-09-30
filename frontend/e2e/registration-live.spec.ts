import { _electron as electron, expect, test } from '@playwright/test';
import path from 'node:path';

test('registers through Spring Boot and verifies duplicate account response', async ({}, info) => {
  const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_DEV_URL;
  const executablePath = process.env.E2E_EXECUTABLE;
  const app = await electron.launch({ ...(executablePath ? { executablePath } : {}), args: [...(executablePath ? [] : [path.resolve('.')]), `--user-data-dir=${info.outputPath('profile')}`], env });
  try {
    const page = await app.firstWindow();
    const username = `desktop_${Date.now()}`;
    await page.goto('app://auction/#/register');
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.getByLabel('Tên đăng nhập', { exact: true }).fill(username);
      await page.getByLabel('Mật khẩu', { exact: true }).fill('my-password-123');
      await page.getByLabel('Xác nhận mật khẩu', { exact: true }).fill('my-password-123');
      await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
      if (attempt === 0) {
        await expect(page.getByRole('heading', { name: `Chào mừng, ${username}.` })).toBeVisible();
        await page.reload();
      } else await expect(page.getByText('Tên đăng nhập đã được sử dụng. Hãy chọn tên khác.')).toBeVisible();
    }
  } finally { await app.close(); }
});
