// electron/ipc/services/openai.service.ts
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import OpenAI from 'openai';

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
      (_event: IpcMainInvokeEvent, { apiKey, baseURL }: { apiKey: string; baseURL?: string }) => {
        try {
          // 验证API密钥格式（基本验证）
          if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
            return {
              success: false,
              error: 'Invalid API key provided'
            };
          }

          // 尝试创建OpenAI实例
          const newOpenai = new OpenAI({
            apiKey: apiKey.trim(),
            baseURL: baseURL && typeof baseURL === 'string' ? baseURL.trim() : undefined
          });

          // 验证实例是否创建成功
          if (!newOpenai) {
            return {
              success: false,
              error: 'Failed to create OpenAI instance'
            };
          }

          // 替换旧实例
          this.openai = newOpenai;

          return {
            success: true,
            message: 'OpenAI initialized successfully'
          };
        } catch (error) {
          // 清理可能的部分初始化状态
          this.openai = null;

          // 记录详细错误信息
          const errorMessage = error instanceof Error ? error.message : String(error);

          return {
            success: false,
            error: `OpenAI initialization failed: ${errorMessage}`,
            // 可以考虑添加更多调试信息
            debugInfo: {
              hasApiKey: !!apiKey,
              apiKeyLength: apiKey ? apiKey.length : 0,
              hasBaseURL: !!baseURL
            }
          };
        }
      }
    );
    // 注册流式聊天完成处理程序
    ipcMain.handle(
      'ipc:openai:chatCompletionStream',
      async (event: IpcMainInvokeEvent, { model, messages, streamId }) => {
        const abortController = new AbortController();
        const streamControl = { cancel: false, abortController };
        this.activeStreams.set(streamId, streamControl);

        if (!this.openai) {
          event.sender.send('ipc:openai:chatCompletionStream:error', { streamId, error: 'OpenAI not initialized' });
          return;
        }

        try {
          const stream = await this.openai.chat.completions.create(
            {
              model,
              messages,
              stream: true
            },
            { signal: abortController.signal }
          );

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
