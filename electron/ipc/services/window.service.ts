// electron/ipc/services/window.service.ts
import { BrowserWindow, ipcMain } from 'electron';

export interface IWindowService {
  isMaximized(): boolean;
  minimize(): void;
  maximize(): void;
  unmaximize(): void;
  close(): void;
  openDevTools(): void;
  closeDevTools(): void;
  reloadPage(): void;
  destroy(): void;
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

  openDevTools(): void {
    if (this.isDestroyed) return;
    const win = this.getWindow();
    if (win && win.webContents) win.webContents.openDevTools();
  }

  reloadPage(): void {
    if (this.isDestroyed) return;
    const win = this.getWindow();
    if (win && win.webContents) {
      // 只重新加载主frame，不包括子frame
      win.webContents.reload();
    }
  }

  closeDevTools(): void {
    if (this.isDestroyed) return;
    const win = this.getWindow();
    if (win && win.webContents) win.webContents.closeDevTools();
  }

  // 注册 IPC 处理程序
  private registerIpcHandlers(): void {
    const handlers = new Map<string, Function>([
      [`ipc:window:isMaximized`, () => this.isMaximized()],
      [`ipc:window:minimize`, () => this.minimize()],
      [`ipc:window:maximize`, () => this.maximize()],
      [`ipc:window:unmaximize`, () => this.unmaximize()],
      [`ipc:window:close`, () => this.close()],
      [`ipc:window:openDevTools`, () => this.openDevTools()],
      [`ipc:window:reloadPage`, () => this.reloadPage()],
      [`ipc:window:closeDevTools`, () => this.closeDevTools()]
    ]);

    handlers.forEach((handler, eventName) => {
      if (!this.registeredHandlers.has(eventName)) {
        ipcMain.handle(eventName, async () => {
          try {
            return await handler();
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
