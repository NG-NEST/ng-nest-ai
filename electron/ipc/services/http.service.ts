// electron/ipc/services/http.service.ts
import { ipcMain } from 'electron';

export class HttpService {
  private registeredHandlers = new Map<string, Function>();
  private isDestroyed = false;

  constructor() {
    this.registerIpcHandlers();
  }

  /**
   * 发起 HTTP GET 请求
   */
  private async get(url: string, options?: RequestInit): Promise<any> {
    if (this.isDestroyed) return;

    try {
      const response = await fetch(url, {
        method: 'GET'
      });

      // 将 Headers 对象转换为普通对象
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return {
        status: response.status,
        statusText: response.statusText,
        headers,
        data: await response.json().catch(() => response.text())
      };
    } catch (error: any) {
      // 更好地处理 fetch 错误
      return {
        status: error.cause?.code || 'FETCH_ERROR',
        statusText: error.message,
        headers: {},
        data: null,
        error: {
          message: error.message,
          code: error.cause?.code || 'UNKNOWN_ERROR',
          hostname: error.cause?.hostname || null
        }
      };
    }
  }

  /**
   * 发起 HTTP POST 请求
   */
  private async post(url: string, body: any, options?: RequestInit): Promise<any> {
    if (this.isDestroyed) return;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...options?.headers
        },
        body: typeof body === 'string' ? body : JSON.stringify(body)
      });

      // 将 Headers 对象转换为普通对象
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return {
        status: response.status,
        statusText: response.statusText,
        headers,
        data: await response.json().catch(() => response.text())
      };
    } catch (error: any) {
      // 更好地处理 fetch 错误
      return {
        status: error.cause?.code || 'FETCH_ERROR',
        statusText: error.message,
        error
      };
    }
  }

  /**
   * 发起 HTTP PUT 请求
   */
  private async put(url: string, body: any, options?: RequestInit): Promise<any> {
    if (this.isDestroyed) return;

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers
        },
        body: typeof body === 'string' ? body : JSON.stringify(body),
        ...options
      });

      // 将 Headers 对象转换为普通对象
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return {
        status: response.status,
        statusText: response.statusText,
        headers,
        data: await response.json().catch(() => response.text())
      };
    } catch (error: any) {
      // 更好地处理 fetch 错误
      return {
        status: error.cause?.code || 'FETCH_ERROR',
        statusText: error.message,
        headers: {},
        data: null,
        error: {
          message: error.message,
          code: error.cause?.code || 'UNKNOWN_ERROR',
          hostname: error.cause?.hostname || null
        }
      };
    }
  }

  /**
   * 发起 HTTP DELETE 请求
   */
  private async delete(url: string, options?: RequestInit): Promise<any> {
    if (this.isDestroyed) return;

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        ...options
      });

      // 将 Headers 对象转换为普通对象
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return {
        status: response.status,
        statusText: response.statusText,
        headers,
        data: await response.json().catch(() => response.text())
      };
    } catch (error: any) {
      // 更好地处理 fetch 错误
      return {
        status: error.cause?.code || 'FETCH_ERROR',
        statusText: error.message,
        headers: {},
        data: null,
        error: {
          message: error.message,
          code: error.cause?.code || 'UNKNOWN_ERROR',
          hostname: error.cause?.hostname || null
        }
      };
    }
  }

  /**
   * 注册 IPC 处理程序
   */
  private registerIpcHandlers(): void {
    const handlers = new Map([
      [
        `ipc:http:get`,
        (_event: Electron.IpcMainInvokeEvent, url: string, options?: RequestInit) => this.get(url, options)
      ],
      [
        `ipc:http:post`,
        (_event: Electron.IpcMainInvokeEvent, url: string, body: any, options?: RequestInit) =>
          this.post(url, body, options)
      ],
      [
        `ipc:http:put`,
        (_event: Electron.IpcMainInvokeEvent, url: string, body: any, options?: RequestInit) =>
          this.put(url, body, options)
      ],
      [
        `ipc:http:delete`,
        (_event: Electron.IpcMainInvokeEvent, url: string, options?: RequestInit) => this.delete(url, options)
      ]
    ]);

    handlers.forEach((handler, eventName) => {
      if (!this.registeredHandlers.has(eventName)) {
        ipcMain.handle(eventName, async (event, ...args: any[]) => {
          try {
            return await (handler as any)(event, ...args);
          } catch (error) {
            throw error;
          }
        });
        this.registeredHandlers.set(eventName, handler);
      }
    });
  }

  /**
   * 注销 IPC 处理程序并清理资源
   */
  public destroy(): void {
    if (this.isDestroyed) return;

    this.registeredHandlers.forEach((_, eventName) => {
      ipcMain.removeHandler(eventName);
    });

    this.registeredHandlers.clear();
    this.isDestroyed = true;
  }
}
