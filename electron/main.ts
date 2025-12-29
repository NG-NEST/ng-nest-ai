import { app, BrowserWindow, screen } from 'electron';
import * as path from 'path';
import * as url from 'url';
import dotenv from 'dotenv';
import { WindowService } from './ipc/services/window.service';
import { OpenAIService } from './ipc/services/openai.service';
import { HttpService } from './ipc/services/http.service';
import { MinioService } from './ipc/services/minio.service';

const envPath = app.isPackaged ? path.join(process.resourcesPath, '.env') : path.join(__dirname, '../../.env');

dotenv.config({ path: envPath });

let win: BrowserWindow | null = null;
let windowService: WindowService | null = null;
let openaiService: OpenAIService | null = null;
let httpService: HttpService | null = null;
let minioService: MinioService | null = null;

const createBrowserWindow = () => {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  win = new BrowserWindow({
    width: 1024,
    height: 768,
    minHeight: 600,
    minWidth: 800,
    frame: false,
    webPreferences: {
      // 推荐做法：禁用 nodeIntegration 并使用 preload 脚本
      nodeIntegration: false,
      sandbox: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js') // 假设有一个 preload 脚本
    }
  });

  // 创建并注册 IPC 处理程序
  windowService = new WindowService(() => win);
  openaiService = new OpenAIService();
  httpService = new HttpService();
  minioService = new MinioService();

  // 判断是否是开发模式
  const isDev = process.env['NODE_ENV'] === 'development';
  const appPath = isDev
    ? 'http://localhost:5200' // 开发模式：加载 Angular 开发服务器
    : url.format({
        pathname: path.join(__dirname, '../ng-nest-ai/browser/index.html'), // 生产模式：注意这里的路径需要匹配 Angular 的实际输出路径
        protocol: 'file:',
        slashes: true
      });

  win.loadURL(appPath);

  win.on('closed', async () => {
    // 销毁服务以清理资源
    if (windowService) {
      windowService.destroy();
      windowService = null;
    }
    if (openaiService) {
      openaiService.destroy();
      openaiService = null;
    }
    if (httpService) {
      httpService.destroy();
      httpService = null;
    }
    if (minioService) {
      minioService.destroy();
      minioService = null;
    }
    win = null;
  });
};

// Electron 应用生命周期事件
app.on('ready', createBrowserWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createBrowserWindow();
  }
});
