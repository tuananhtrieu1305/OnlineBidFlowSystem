import { app, BrowserWindow, dialog, net, protocol, session } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveAsset } from './asset-path';

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

function createWindow() {
  const window = new BrowserWindow({
    title: 'OnlineBidFlow', width: 1180, height: 780, minWidth: 820, minHeight: 600,
    backgroundColor: '#f8fafc', autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true
    }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  // Only the development launcher can select Vite; packaged apps always load local assets.
  const development = !app.isPackaged && process.env.ELECTRON_DEV_URL === 'http://localhost:5173';
  void window.loadURL(development ? 'http://localhost:5173' : 'app://auction/').catch((error: Error) => {
    dialog.showErrorBox('Unable to start OnlineBidFlow', error.message);
    app.quit();
  });
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  protocol.handle('app', (request) => {
    const file = resolveAsset(request.url, path.join(__dirname, '../dist'));
    if (!file || request.method !== 'GET') return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString()).catch(() => new Response('Not found', { status: 404 }));
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((error: Error) => {
  dialog.showErrorBox('Unable to start OnlineBidFlow', error.message);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
