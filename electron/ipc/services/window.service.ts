import { BrowserWindow, dialog, shell } from 'electron';
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
  switchDevTools(show: boolean): void;
  isDevToolsOpened(): boolean;
  getSystemLocale(): string;
  reloadPage(): void;
  destroy(): void;
  previewHtml(html: string): void;
  selectDirectory(): string;
  openExternal(url: string): void;
  executeJavaScript(code: string, context?: Record<string, any>, timeout?: number): any;
}

export class WindowService implements IWindowService {
  constructor(private getWindow: () => BrowserWindow | null) {}

  isMaximized(): boolean {
    const win = this.getWindow();
    return win ? win.isMaximized() : false;
  }

  minimize(): void {
    const win = this.getWindow();
    if (win) win.minimize();
  }

  maximize(): void {
    const win = this.getWindow();
    if (win) win.maximize();
  }

  unmaximize(): void {
    const win = this.getWindow();
    if (win) win.unmaximize();
  }

  close(): void {
    const win = this.getWindow();
    if (win) win.close();
  }

  switchDevTools(show: boolean): void {
    console.log(show);
    const win = this.getWindow();
    if (win && win.webContents) {
      if (show) win.webContents.openDevTools({ mode: 'detach' });
      else win.webContents.closeDevTools();
    }
  }

  isDevToolsOpened(): boolean {
    const win = this.getWindow();
    return win && win.webContents ? win.webContents.isDevToolsOpened() : false;
  }

  getSystemLocale(): string {
    const { app } = require('electron');
    return app.getLocale();
  }

  reloadPage(): void {
    const win = this.getWindow();
    if (win && win.webContents) {
      win.webContents.reload();
    }
  }

  previewHtml(html: string): void {
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

    const isDev = process.env['NODE_ENV'] === 'development';
    if (isDev) win.webContents.openDevTools({ mode: 'detach' });

    win.loadFile(filePath);
    win.on('closed', () => {
      try { fs.unlinkSync(filePath); } catch (e) { console.warn(e); }
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

  executeJavaScript(code: string, context: Record<string, any> = {}, timeout: number = 5000): any {
    if (!code || code.trim() === '') {
      return context;
    }

    try {
      const sandbox = {
        console: {
          log: (...args: any[]) => console.log('[VM Log]', ...args),
          warn: (...args: any[]) => console.warn('[VM Warning]', ...args),
          error: (...args: any[]) => console.error('[VM Error]', ...args)
        },
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
        setInterval: timers.setInterval,
        clearInterval: timers.clearInterval,
        setImmediate: timers.setImmediate,
        clearImmediate: timers.clearImmediate,
        Array, Object, String, Number, Boolean, Date, RegExp, Math,
        JSON,
        ...context,
        crypto,
        require,
        process: undefined,
        global: undefined,
        Buffer: undefined
      };

      const vmContext = vm.createContext(sandbox);
      const wrappedCode = `(function() { ${code} })();`;
      const script = new vm.Script(wrappedCode);
      const result = script.runInContext(vmContext, {
        timeout,
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

  destroy(): void {}
}
