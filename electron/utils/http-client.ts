/**
 * 统一 HTTP 客户端
 * 封装 Electron net 模块，提供一致的 HTTP 调用接口
 */

import { net } from 'electron';

export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string | Buffer | object;
  timeout?: number;
}

export interface HttpResponse<T = any> {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: T;
  rawText: string;
}

/**
 * 统一 HTTP 客户端类
 */
export class HttpClient {
  private defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  private defaultTimeout: number = 30000;

  /**
   * 设置默认请求头
   */
  setDefaultHeaders(headers: Record<string, string>): void {
    this.defaultHeaders = { ...this.defaultHeaders, ...headers };
  }

  /**
   * 发送 HTTP 请求
   */
  async request<T = any>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    const { method = 'GET', headers = {}, body, timeout = this.defaultTimeout } = options;

    return new Promise((resolve, reject) => {
      const request = net.request({ method, url });

      // 合并默认 headers 和自定义 headers
      const mergedHeaders = { ...this.defaultHeaders, ...headers };
      for (const [key, value] of Object.entries(mergedHeaders)) {
        if (value !== undefined) {
          request.setHeader(key, value);
        }
      }

      // 设置超时
      const timeoutId = setTimeout(() => {
        request.abort();
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      request.on('response', (response) => {
        clearTimeout(timeoutId);
        const chunks: Buffer[] = [];

        response.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const rawText = buffer.toString('utf-8');

          // 转换响应头
          const responseHeaders: Record<string, string> = {};
          for (const [key, value] of Object.entries(response.headers)) {
            responseHeaders[key] = Array.isArray(value) ? value.join('; ') : String(value);
          }

          // 尝试解析 JSON
          let data: T;
          try {
            data = JSON.parse(rawText) as T;
          } catch {
            data = rawText as unknown as T;
          }

          const ok = response.statusCode !== undefined && response.statusCode >= 200 && response.statusCode < 300;

          resolve({
            ok,
            status: response.statusCode ?? 0,
            statusText: response.statusMessage ?? '',
            headers: responseHeaders,
            data,
            rawText
          });
        });
      });

      request.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });

      // 写入请求体
      if (body) {
        if (typeof body === 'string') {
          request.write(body);
        } else if (Buffer.isBuffer(body)) {
          request.write(body);
        } else if (typeof body === 'object') {
          request.write(JSON.stringify(body));
        }
      }

      request.end();
    });
  }

  /**
   * GET 请求
   */
  async get<T = any>(url: string, params?: Record<string, any>, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    let finalUrl = url;
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      }
      finalUrl = `${url}?${searchParams.toString()}`;
    }
    return this.request<T>(finalUrl, { ...options, method: 'GET' });
  }

  /**
   * POST 请求
   */
  async post<T = any>(url: string, body?: any, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'POST', body });
  }

  /**
   * PUT 请求
   */
  async put<T = any>(url: string, body?: any, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'PUT', body });
  }

  /**
   * DELETE 请求
   */
  async delete<T = any>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }

  /**
   * PATCH 请求
   */
  async patch<T = any>(url: string, body?: any, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'PATCH', body });
  }
}

// 导出单例实例
export const httpClient = new HttpClient();