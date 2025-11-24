// electron/ipc/services/window.service.ts
import { BrowserWindow, dialog, ipcMain, IpcMainInvokeEvent } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface IWindowService {
  isMaximized(): boolean;
  minimize(): void;
  maximize(): void;
  unmaximize(): void;
  close(): void;
  switchDevTools(): void;
  reloadPage(): void;
  destroy(): void;
  previewHtml(html: string): void;
  selectDirectory(): string;
}

export class WindowService implements IWindowService {
  private registeredHandlers = new Map<string, Function>();
  private isDestroyed = false;

  constructor(private getWindow: () => BrowserWindow | null) {
    // 在构造函数中自动注册 IPC 处理程序
    this.registerIpcHandlers();
  }

  isMaximized(): boolean {
    if (this.isDestroyed) return false;
    const win = this.getWindow();
    return win ? win.isMaximized() : false;
  }

  minimize(): void {
    if (this.isDestroyed) return;
    const win = this.getWindow();
    if (win) win.minimize();
  }

  maximize(): void {
    if (this.isDestroyed) return;
    const win = this.getWindow();
    if (win) win.maximize();
  }

  unmaximize(): void {
    if (this.isDestroyed) return;
    const win = this.getWindow();
    if (win) win.unmaximize();
  }

  close(): void {
    if (this.isDestroyed) return;
    const win = this.getWindow();
    if (win) win.close();
  }

  switchDevTools(): void {
    if (this.isDestroyed) return;
    const win = this.getWindow();

    if (win && win.webContents) {
      if (win.webContents.isDevToolsOpened()) {
        win.webContents.closeDevTools();
      } else {
        win.webContents.openDevTools({ mode: 'detach' });
      }
    }
  }

  reloadPage(): void {
    if (this.isDestroyed) return;
    const win = this.getWindow();
    if (win && win.webContents) {
      // 只重新加载主frame，不包括子frame
      win.webContents.reload();
    }
  }

  previewHtml(html: string): void {
    if (this.isDestroyed) return;
    const tempDir = os.tmpdir();
    const filePath = path.join(tempDir, `preview-${Date.now()}.html`);
    fs.writeFileSync(filePath, html, 'utf-8');

    const win = new BrowserWindow({
      width: 1024,
      height: 768,
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false
      }
    });

    // 判断是否是开发模式
    const isDev = process.env['NODE_ENV'] === 'development';

    if (isDev) {
      win.webContents.openDevTools({ mode: 'detach' });
    }

    win.loadFile(filePath);
    win.on('closed', () => {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.warn(e);
      }
    });
  }

  selectDirectory(): string {
    const result = dialog.showOpenDialogSync({
      properties: ['openDirectory', 'showHiddenFiles']
    });

    return result ? result[0] : '';
  }

  // 注册 IPC 处理程序
  private registerIpcHandlers(): void {
    const handlers = new Map<string, Function>([
      [`ipc:window:isMaximized`, () => this.isMaximized()],
      [`ipc:window:minimize`, () => this.minimize()],
      [`ipc:window:maximize`, () => this.maximize()],
      [`ipc:window:unmaximize`, () => this.unmaximize()],
      [`ipc:window:close`, () => this.close()],
      [`ipc:window:switchDevTools`, () => this.switchDevTools()],
      [`ipc:window:reloadPage`, () => this.reloadPage()],
      [`ipc:window:previewHtml`, (_event: IpcMainInvokeEvent, html: string) => this.previewHtml(html)],
      [`ipc:window:selectDirectory`, () => this.selectDirectory()]
    ]);

    handlers.forEach((handler, eventName) => {
      if (!this.registeredHandlers.has(eventName)) {
        ipcMain.handle(eventName, async (event: IpcMainInvokeEvent, ...args: any[]) => {
          try {
            return await handler(event, ...args);
          } catch (error) {
            throw error;
          }
        });
        this.registeredHandlers.set(eventName, handler);
      }
    });
  }

  // 注销 IPC 处理程序并清理资源
  destroy(): void {
    if (this.isDestroyed) return;

    this.registeredHandlers.forEach((_, eventName) => {
      ipcMain.removeHandler(eventName);
    });
    this.registeredHandlers.clear();
    this.isDestroyed = true;
  }
}
