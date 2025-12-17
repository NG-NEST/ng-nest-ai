// electron/ipc/services/window.service.ts
import { BrowserWindow, dialog, ipcMain, IpcMainInvokeEvent, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vm from 'vm';
import * as timers from 'timers';

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
  openExternal(url: string): void;
  executeJavaScript(code: string, context?: Record<string, any>, timeout?: number): any;
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

  openExternal(url: string): void {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return;
    }
    throw new Error('Invalid external URL');
  }

  // code = "return 'hihi';"
  executeJavaScript(code: string, context: Record<string, any> = {}, timeout: number = 5000): any {
    if (this.isDestroyed) {
      throw new Error('Window service has been destroyed');
    }
    if (!code || code.trim() === '') {
      return context;
    }

    try {
      // 创建基础沙箱环境
      const sandbox = {
        // 提供基本的全局对象
        console: {
          log: (...args: any[]) => console.log('[VM Log]', ...args),
          warn: (...args: any[]) => console.warn('[VM Warning]', ...args),
          error: (...args: any[]) => console.error('[VM Error]', ...args)
        },
        // 提供基本的定时器功能
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
        setInterval: timers.setInterval,
        clearInterval: timers.clearInterval,
        setImmediate: timers.setImmediate,
        clearImmediate: timers.clearImmediate,
        // 提供基本的数据结构
        Array: Array,
        Object: Object,
        String: String,
        Number: Number,
        Boolean: Boolean,
        Date: Date,
        RegExp: RegExp,
        Math: Math,

        JSON: JSON,
        // 将传入的上下文对象合并到沙箱中
        ...context,

        crypto: crypto,

        require: require,
        process: undefined,
        global: undefined,
        Buffer: undefined
      };

      // 创建新的上下文
      const vmContext = vm.createContext(sandbox);

      // 将代码包装在一个函数中，以便正确处理 return 语句
      const wrappedCode = `
      (function() {
        ${code}
      })();
    `;

      // 创建脚本并执行
      const script = new vm.Script(wrappedCode);

      // 执行脚本并返回结果
      const result = script.runInContext(vmContext, {
        timeout: timeout,
        displayErrors: true
      });

      return result;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'ScriptTimeOutError') {
          throw new Error(`JavaScript execution timed out after ${timeout}ms`);
        }
        throw new Error(`JavaScript execution failed: ${error.message}`);
      }
      throw new Error('Unknown error occurred during JavaScript execution');
    }
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
      [`ipc:window:selectDirectory`, () => this.selectDirectory()],
      [`ipc:window:openExternal`, (_event: IpcMainInvokeEvent, url: string) => this.openExternal(url)],
      [
        `ipc:window:executeJavaScript`,
        (_event: IpcMainInvokeEvent, code: string, context?: Record<string, any>, timeout?: number) =>
          this.executeJavaScript(code, context, timeout)
      ]
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
