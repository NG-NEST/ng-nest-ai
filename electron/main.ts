import { app, BrowserWindow, screen } from 'electron';
import * as path from 'path';
import * as url from 'url';
import dotenv from 'dotenv';
import { IpcRouter } from './ipc/common/ipc-router';
import { WindowService } from './ipc/services/window.service';
import { OpenAIService } from './ipc/services/openai.service';
import { HttpService } from './ipc/services/http.service';
import { MinioService } from './ipc/services/minio.service';
import { FileSystemService } from './ipc/services/file-system.service';
import { SafeStorageService } from './ipc/services/safe-storage.service';
import { logEnvStatus } from './config/env.config';

const envPath = app.isPackaged ? path.join(process.resourcesPath, '.env') : path.join(__dirname, '../../.env');
dotenv.config({ path: envPath });
logEnvStatus();

let win: BrowserWindow | null = null;

const createBrowserWindow = () => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: 1024,
    height: 768,
    minHeight: 600,
    minWidth: 800,
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      sandbox: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const isDev = process.env['NODE_ENV'] === 'development';
  win.loadURL(
    isDev
      ? 'http://localhost:5200'
      : url.format({
          pathname: path.join(__dirname, '../ng-nest-ai/browser/index.html'),
          protocol: 'file:',
          slashes: true
        })
  );

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      event.preventDefault();
      require('electron').shell.openExternal(url);
    }
  });
  win.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(['clipboard-read', 'media'].includes(permission));
  });

  const router = new IpcRouter()
    .add('window', new WindowService(() => win))
    .add('openai', new OpenAIService(), {
      expose: ['initialize', 'loadSkills', 'chatCompletionStream', 'chatCompletionStreamCancel'],
      useEventSender: ['chatCompletionStream']
    })
    .add('http', new HttpService(), { expose: ['get', 'post', 'put', 'delete'] })
    .add('minio', new MinioService(), { expose: ['uploadFile'] })
    .add('fs', new FileSystemService(), {
      expose: [
        'watch',
        'watchWithoutScan',
        'unwatch',
        'getContents',
        'pathExists',
        'getFileInfo',
        'initialScan',
        'createFile',
        'createFolder',
        'rename',
        'delete',
        'copy',
        'showInExplorer'
      ],
      useEventSender: ['watch', 'watchWithoutScan', 'initialScan']
    })
    .add('safeStorage', new SafeStorageService(), {
      expose: ['isEncryptionAvailable', 'encryptString', 'decryptString']
    });

  win.on('closed', () => {
    router.destroy();
    win = null;
  });
};

app.on('ready', createBrowserWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createBrowserWindow();
});
