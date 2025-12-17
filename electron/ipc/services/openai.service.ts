// electron/ipc/services/openai.service.ts
import { ipcMain, IpcMainInvokeEvent, net, session } from 'electron';
import OpenAI from 'openai';
import { Stream } from 'openai/core/streaming';

// 自定义 fetch 函数，使用 Electron 的 net 模块
function electronFetch(input: string | URL | Request, options?: RequestInit): Promise<Response> {
  let url = (input instanceof Request ? input.url : input).toString();

  let method = options?.method ?? 'GET';
  let headers = (options?.headers as Headers) ?? '';
  let body = options?.body ?? '';

  return new Promise((resolve, reject) => {
    const request = net.request({ method, url });

    // 设置请求头
    if (headers) {
      headers.forEach((value, key) => {
        request.setHeader(key, value);
      });
    }

    // 如果有请求体，写入 body
    if (body) {
      request.write(body as string);
    }

    // 处理响应
    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        try {
          // 使用 new Response 来构造响应对象
          const responseBody = new TextEncoder().encode(data); // 编码为 Uint8Array
          // 将响应头转换为 Headers 对象
          const responseHeaders = new Headers();
          for (const [key, value] of Object.entries(response.headers)) {
            responseHeaders.append(key, value as string); // 对于每个头部字段，添加到 Headers 对象中
          }
          // 构造一个完整的 Response 对象
          const electronResponse = new Response(responseBody, {
            status: response.statusCode,
            statusText: response.statusMessage,
            headers: responseHeaders
          });
          resolve(electronResponse); // 返回模拟的 Response
        } catch (err) {
          reject(new Error('Failed to parse response JSON'));
        }
      });
    });

    // 处理请求错误
    request.on('error', (err) => {
      reject(err);
    });

    request.end();
  });
}

async function resolveSystemProxy(targetUrl: string): Promise<string | null> {
  const proxy = await session.defaultSession.resolveProxy(targetUrl);

  // 示例：
  // "DIRECT"
  // "PROXY 127.0.0.1:7890; DIRECT"
  // "SOCKS5 127.0.0.1:1080; DIRECT"

  if (!proxy || proxy === 'DIRECT') {
    return null;
  }

  const match = proxy.match(/PROXY\s+([^\s;]+)/) || proxy.match(/SOCKS5?\s+([^\s;]+)/);

  if (!match) return null;

  const host = match[1];

  // undici 需要 schema
  if (proxy.startsWith('SOCKS')) {
    return `socks://${host}`;
  }

  return `http://${host}`;
}

export class OpenAIService {
  private openai: OpenAI | null = null;
  private activeStreams: Map<string, { cancel: boolean; abortController: AbortController }> = new Map();

  constructor() {
    this.registerIpcHandlers();
  }

  private registerIpcHandlers() {
    // 初始化 OpenAI 实例
    ipcMain.handle(
      'ipc:openai:initialize',
      async (_event, { apiKey, baseURL }: { apiKey: string; baseURL?: string }) => {
        try {
          if (!apiKey || typeof apiKey !== 'string') {
            return { success: false, error: 'Invalid API key' };
          }

          const targetUrl = baseURL || 'https://api.openai.com';

          // 🔑 自动检测系统代理
          const proxyUrl = await resolveSystemProxy(targetUrl);

          if (proxyUrl) {
            // const agent = new ProxyAgent(proxyUrl);
            // setGlobalDispatcher(agent);
            // console.log('[OpenAI] Using proxy:', proxyUrl);
          } else {
            console.log('[OpenAI] No proxy detected, direct connection');
          }

          this.openai = new OpenAI({
            apiKey: apiKey.trim(),
            baseURL: baseURL?.trim(),
            fetch: electronFetch
          });

          return {
            success: true,
            proxy: proxyUrl ?? 'DIRECT'
          };
        } catch (error: any) {
          this.openai = null;
          return {
            success: false,
            error: error.message ?? String(error)
          };
        }
      }
    );
    // 注册流式聊天完成处理程序
    ipcMain.handle(
      'ipc:openai:chatCompletionStream',
      async (event: IpcMainInvokeEvent, { model, messages, streamId, ...options }) => {
        const abortController = new AbortController();
        const streamControl = { cancel: false, abortController };
        this.activeStreams.set(streamId, streamControl);

        if (!this.openai) {
          event.sender.send('ipc:openai:chatCompletionStream:error', { streamId, error: 'OpenAI not initialized' });
          return;
        }

        try {
          const stream = (await this.openai.chat.completions.create(
            {
              model,
              messages,
              stream: true,
              ...options
            } as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
            { signal: abortController.signal }
          )) as Stream<OpenAI.Chat.Completions.ChatCompletionChunk> & {
            _request_id?: string | null;
          };

          for await (const chunk of stream) {
            // 检查是否需要取消
            if (streamControl.cancel) {
              break;
            }

            // 发送数据到渲染进程
            event.sender.send('ipc:openai:chatCompletionStream:stream', {
              streamId,
              data: chunk
            });
          }

          // 发送结束信号
          event.sender.send('ipc:openai:chatCompletionStream:stream', {
            streamId,
            done: true
          });

          this.activeStreams.delete(streamId);
        } catch (error) {
          event.sender.send('ipc:openai:chatCompletionStream:error', {
            streamId,
            error: error instanceof Error ? error.message : String(error)
          });
          this.activeStreams.delete(streamId);
        }
      }
    );

    // 注册取消流式请求处理程序
    ipcMain.handle('ipc:openai:chatCompletionStream:cancel', (_event: IpcMainInvokeEvent, streamId: string) => {
      const stream = this.activeStreams.get(streamId);
      if (stream) {
        stream.cancel = true;
        // 强制终止请求
        if (stream.abortController) {
          stream.abortController.abort();
        }
      }
    });
  }

  // 销毁服务时清理资源
  destroy() {
    this.activeStreams.forEach((stream) => {
      stream.cancel = true;
    });
    this.activeStreams.clear();
  }
}
