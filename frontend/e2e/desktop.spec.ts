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

test('opens desktop UI, routes and reloads local assets', async ({}, testInfo) => {
  await expect(page.getByRole('heading', { name: 'OnlineBidFlow Desktop' })).toBeVisible();
  await expect(page.locator('footer')).toContainText('Electron');
  await page.getByRole('link', { name: 'Routing test', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'React Router is working!' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'React Router is working!' })).toBeVisible();
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('desktop.png') });
});

test('connects to real Spring Boot REST and WebSocket endpoints', async () => {
  await page.getByRole('link', { name: 'Connection test', exact: true }).click();
  await expect(page.getByRole('region', { name: 'REST API', exact: true })).toContainText('Connected');
  await expect(page.getByRole('region', { name: 'WebSocket', exact: true })).toContainText('Connected');
  await page.getByRole('button', { name: 'Check again' }).click();
  await expect(page.getByRole('region', { name: 'WebSocket', exact: true })).toContainText('Connected');
});

test('reports unavailable services without crashing', async () => {
  await app.evaluate(({ session }) => {
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ['http://localhost:8080/*', 'ws://localhost:8080/*'] },
      (_details, callback) => callback({ cancel: true })
    );
  });
  await page.getByRole('link', { name: 'Connection test', exact: true }).click();
  await expect(page.getByRole('region', { name: 'REST API', exact: true })).toContainText('Unavailable');
  await expect(page.getByRole('region', { name: 'WebSocket', exact: true })).toContainText('Unavailable');
  await expect(page.getByRole('button', { name: 'Check again' })).toBeEnabled();
  await app.evaluate(({ session }) => session.defaultSession.webRequest.onBeforeRequest(null));
  await page.getByRole('button', { name: 'Check again' }).click();
  await expect(page.getByRole('region', { name: 'REST API', exact: true })).toContainText('Connected');
  await expect(page.getByRole('region', { name: 'WebSocket', exact: true })).toContainText('Connected');
});

test('isolates Node, blocks new windows and prevents asset traversal', async () => {
  expect(await page.evaluate(() => typeof (window as unknown as { require?: unknown }).require)).toBe('undefined');
  expect(await page.evaluate(() => typeof (window as unknown as { process?: unknown }).process)).toBe('undefined');
  await page.evaluate(() => window.open('https://example.com'));
  expect(app.windows()).toHaveLength(1);
  expect(await page.evaluate(async () => (await fetch('app://auction/%2e%2e%2fpackage.json')).status)).toBe(404);
});
