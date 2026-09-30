import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';

let app: ElectronApplication;
let page: Page;

test.beforeEach(async ({}, testInfo) => {
  const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_DEV_URL;
  const executablePath = process.env.E2E_EXECUTABLE;
  app = await electron.launch({
    ...(executablePath ? { executablePath } : {}),
    args: [...(executablePath ? [] : [path.resolve('.')]), `--user-data-dir=${testInfo.outputPath('profile')}`],
    env
  });
  page = await app.firstWindow();
});

test.afterEach(async () => { await app?.close(); });

test('isolates Node, blocks new windows and prevents asset traversal', async () => {
  expect(await page.evaluate(() => typeof (window as unknown as { require?: unknown }).require)).toBe('undefined');
  expect(await page.evaluate(() => typeof (window as unknown as { process?: unknown }).process)).toBe('undefined');
  await page.evaluate(() => window.open('https://example.com'));
  expect(app.windows()).toHaveLength(1);
  expect(await page.evaluate(async () => (await fetch('app://auction/%2e%2e%2fpackage.json')).status)).toBe(404);
});
