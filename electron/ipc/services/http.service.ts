import { URLSearchParams } from 'url';
import { httpClient, HttpResponse } from '../../utils/http-client';

type HttpResult = {
  status: number | string;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  error?: { message: string; code: string; hostname: string | null };
};

export class HttpService {
  async get(url: string, params?: any, options?: RequestInit): Promise<HttpResult> {
    try {
      const query = new URLSearchParams(params ?? {}).toString();
      const finalUrl = query ? `${url}?${query}` : url;
      const response: HttpResponse = await httpClient.request(finalUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...(options?.headers as any) }
      });
      return { status: response.status, statusText: response.statusText, headers: response.headers, data: response.data };
    } catch (error: any) {
      return this._formatError(error);
    }
  }

  async post(url: string, body: any, options?: RequestInit): Promise<HttpResult> {
    try {
      const response: HttpResponse = await httpClient.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...(options?.headers as any) },
        body: typeof body === 'string' ? body : JSON.stringify(body)
      });
      return { status: response.status, statusText: response.statusText, headers: response.headers, data: response.data };
    } catch (error: any) {
      return this._formatError(error);
    }
  }

  async put(url: string, body: any, options?: RequestInit): Promise<HttpResult> {
    try {
      const response: HttpResponse = await httpClient.request(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...(options?.headers as any) },
        body: typeof body === 'string' ? body : JSON.stringify(body)
      });
      return { status: response.status, statusText: response.statusText, headers: response.headers, data: response.data };
    } catch (error: any) {
      return this._formatError(error);
    }
  }

  async delete(url: string, options?: RequestInit): Promise<HttpResult> {
    try {
      const response: HttpResponse = await httpClient.request(url, {
        method: 'DELETE',
        headers: { ...(options?.headers as any) }
      });
      return { status: response.status, statusText: response.statusText, headers: response.headers, data: response.data };
    } catch (error: any) {
      return this._formatError(error);
    }
  }

  private _formatError(error: any): HttpResult {
    return {
      status: error.code || 'NET_ERROR',
      statusText: error.message || 'Network Error',
      headers: {},
      data: null,
      error: { message: error.message || 'Unknown error', code: error.code || 'UNKNOWN_ERROR', hostname: error.hostname ?? null }
    };
  }
}
