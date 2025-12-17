import { ipcMain, net } from 'electron';
import { URLSearchParams } from 'url';

type HttpResult = {
  status: number | string;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  error?: {
    message: string;
    code: string;
    hostname: string | null;
  };
};

export class HttpService {
  private registeredHandlers = new Map<string, Function>();
  private isDestroyed = false;

  constructor() {
    this.registerIpcHandlers();
  }

  /* ------------------------------------------------------------------ */
  /* Core net.request wrapper                                            */
  /* ------------------------------------------------------------------ */

  private request(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    options?: {
      headers?: Record<string, string>;
      body?: string | Buffer;
    }
  ): Promise<HttpResult> {
    return new Promise((resolve, reject) => {
      const req = net.request({
        method,
        url
      });

      // headers
      if (options?.headers) {
        for (const [key, value] of Object.entries(options.headers)) {
          if (value !== undefined) {
            req.setHeader(key, value);
          }
        }
      }

      req.on('response', (res) => {
        const chunks: Buffer[] = [];

        res.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const text = buffer.toString('utf-8');

          // headers -> plain object
          const headers: Record<string, string> = {};
          for (const [key, value] of Object.entries(res.headers)) {
            headers[key] = Array.isArray(value) ? value.join('; ') : String(value);
          }

          let data: any = text;
          try {
            data = JSON.parse(text);
          } catch {
            /* non-json response */
          }

          resolve({
            status: res.statusCode,
            statusText: res.statusMessage ?? '',
            headers,
            data
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (options?.body) {
        req.write(options.body);
      }

      req.end();
    });
  }

  /* ------------------------------------------------------------------ */
  /* HTTP methods                                                       */
  /* ------------------------------------------------------------------ */

  private async get(url: string, params?: any, options?: RequestInit): Promise<HttpResult> {
    if (this.isDestroyed) return this.abortedResult();

    try {
      const query = new URLSearchParams(params ?? {}).toString();
      const finalUrl = query ? `${url}?${query}` : url;

      return await this.request('GET', finalUrl, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...(options?.headers as any)
        }
      });
    } catch (error: any) {
      return this.formatError(error);
    }
  }

  private async post(url: string, body: any, options?: RequestInit): Promise<HttpResult> {
    if (this.isDestroyed) return this.abortedResult();

    try {
      return await this.request('POST', url, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...(options?.headers as any)
        },
        body: typeof body === 'string' ? body : JSON.stringify(body)
      });
    } catch (error: any) {
      return this.formatError(error);
    }
  }

  private async put(url: string, body: any, options?: RequestInit): Promise<HttpResult> {
    if (this.isDestroyed) return this.abortedResult();

    try {
      return await this.request('PUT', url, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...(options?.headers as any)
        },
        body: typeof body === 'string' ? body : JSON.stringify(body)
      });
    } catch (error: any) {
      return this.formatError(error);
    }
  }

  private async delete(url: string, options?: RequestInit): Promise<HttpResult> {
    if (this.isDestroyed) return this.abortedResult();

    try {
      return await this.request('DELETE', url, {
        headers: {
          ...(options?.headers as any)
        }
      });
    } catch (error: any) {
      return this.formatError(error);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Error helpers                                                      */
  /* ------------------------------------------------------------------ */

  private formatError(error: any): HttpResult {
    return {
      status: error.code || 'NET_ERROR',
      statusText: error.message || 'Network Error',
      headers: {},
      data: null,
      error: {
        message: error.message || 'Unknown error',
        code: error.code || 'UNKNOWN_ERROR',
        hostname: error.hostname ?? null
      }
    };
  }

  private abortedResult(): HttpResult {
    return {
      status: 'ABORTED',
      statusText: 'HttpService destroyed',
      headers: {},
      data: null
    };
  }

  /* ------------------------------------------------------------------ */
  /* IPC registration                                                   */
  /* ------------------------------------------------------------------ */

  private registerIpcHandlers(): void {
    const handlers = new Map<string, Function>([
      [
        'ipc:http:get',
        (_e: Electron.IpcMainInvokeEvent, url: string, params: any, options?: RequestInit) =>
          this.get(url, params, options)
      ],
      [
        'ipc:http:post',
        (_e: Electron.IpcMainInvokeEvent, url: string, body: any, options?: RequestInit) =>
          this.post(url, body, options)
      ],
      [
        'ipc:http:put',
        (_e: Electron.IpcMainInvokeEvent, url: string, body: any, options?: RequestInit) => this.put(url, body, options)
      ],
      [
        'ipc:http:delete',
        (_e: Electron.IpcMainInvokeEvent, url: string, options?: RequestInit) => this.delete(url, options)
      ]
    ]);

    handlers.forEach((handler, channel) => {
      if (!this.registeredHandlers.has(channel)) {
        ipcMain.handle(channel, async (event, ...args) => {
          return handler(event, ...args);
        });
        this.registeredHandlers.set(channel, handler);
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Cleanup                                                            */
  /* ------------------------------------------------------------------ */

  public destroy(): void {
    if (this.isDestroyed) return;

    this.registeredHandlers.forEach((_, channel) => {
      ipcMain.removeHandler(channel);
    });

    this.registeredHandlers.clear();
    this.isDestroyed = true;
  }
}
