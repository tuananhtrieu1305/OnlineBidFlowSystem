import { _electron as electron, expect, test } from '@playwright/test';
import path from 'node:path';

test('development window loads discovery and registration', async ({}, testInfo) => {
  const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  delete env.ELECTRON_RUN_AS_NODE;
  env.ELECTRON_DEV_URL = 'http://localhost:5173';
  const app = await electron.launch({
      args: [path.resolve('.'), `--user-data-dir=${testInfo.outputPath('profile')}`], env
    });
  try {
      const page = await app.firstWindow();
      await expect(page.getByRole('heading', { name: 'Món đồ đặc biệt. Lựa chọn của bạn.' })).toBeVisible();
      expect(page.url()).toMatch(/^http:\/\/localhost:5173/);
      await page.getByRole('link', { name: 'Tạo tài khoản', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Bắt đầu bộ sưu tập của bạn.' })).toBeVisible();
  } finally {
    await app.close();
  }
});
