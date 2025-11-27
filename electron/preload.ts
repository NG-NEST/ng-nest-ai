import { contextBridge, ipcRenderer } from 'electron';
import type { Chat } from 'openai/resources';

// window controls
interface WindowControls {
  isMaximized: () => Promise<boolean>;
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  unmaximize: () => Promise<void>;
  close: () => Promise<void>;
  switchDevTools: () => Promise<void>;
  reloadPage: () => Promise<void>;
  previewHtml: (html: string) => Promise<void>;
  selectDirectory: () => Promise<string>;
  openExternal: (url: string) => Promise<void>;
}
const windowControls: WindowControls = {
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke('ipc:window:isMaximized'),
  minimize: (): Promise<void> => ipcRenderer.invoke('ipc:window:minimize'),
  maximize: (): Promise<void> => ipcRenderer.invoke('ipc:window:maximize'),
  unmaximize: (): Promise<void> => ipcRenderer.invoke('ipc:window:unmaximize'),
  close: (): Promise<void> => ipcRenderer.invoke('ipc:window:close'),
  switchDevTools: (): Promise<void> => ipcRenderer.invoke('ipc:window:switchDevTools'),
  reloadPage: (): Promise<void> => ipcRenderer.invoke('ipc:window:reloadPage'),
  previewHtml: (html: string): Promise<void> => ipcRenderer.invoke('ipc:window:previewHtml', html),
  selectDirectory: (): Promise<string> => ipcRenderer.invoke('ipc:window:selectDirectory'),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('ipc:window:openExternal', url)
};

// openai
interface OpenAI {
  initialize: (param: { apiKey: string; baseURL: string }) => Promise<void>;
  chatCompletionStream: (
    options: Chat.Completions.ChatCompletionCreateParamsStreaming,
    onData: (data: any) => void,
    onDone: () => void,
    onError: (error: any) => void
  ) => () => void;
}
const openAI: OpenAI = {
  initialize: (param: { apiKey: string; baseURL: string }) => ipcRenderer.invoke('ipc:openai:initialize', param),
  chatCompletionStream: (
    options: Chat.Completions.ChatCompletionCreateParamsStreaming,
    onData: (data: any) => void,
    onDone: () => void,
    onError: (error: any) => void
  ) => {
    const streamId = `${Date.now()}-${Math.random()}`;

    // 设置监听器
    const handleStream = (_event: any, args: any) => {
      if (args.streamId !== streamId) return;

      if (args.done) {
        cleanup();
        onDone();
      } else {
        onData(args.data);
      }
    };

    const handleError = (_event: any, args: any) => {
      if (args.streamId && args.streamId !== streamId) return; // 允许没有streamId的早期错误

      cleanup();
      onError(args.error);
    };

    // 统一清理函数
    const cleanup = () => {
      ipcRenderer.removeListener('ipc:openai:chatCompletionStream:stream', handleStream);
      ipcRenderer.removeListener('ipc:openai:chatCompletionStream:error', handleError);
    };

    // 注册监听器
    ipcRenderer.on('ipc:openai:chatCompletionStream:stream', handleStream);
    ipcRenderer.on('ipc:openai:chatCompletionStream:error', handleError);

    // 发起请求
    ipcRenderer.invoke('ipc:openai:chatCompletionStream', { ...options, streamId }).catch((invokeError) => {
      // 处理invoke本身的错误（如网络问题等）
      cleanup();
      onError(invokeError);
    });

    // 返回取消函数
    return () => {
      ipcRenderer.invoke('ipc:openai:chatCompletionStream:cancel', streamId);
    };
  }
};

// http
interface Http {
  get: (url: string, options?: RequestInit) => Promise<any>;
  post: (url: string, body: any, options?: RequestInit) => Promise<any>;
  put: (url: string, body: any, options?: RequestInit) => Promise<any>;
  delete: (url: string, options?: RequestInit) => Promise<any>;
}
const http: Http = {
  get: (url: string, options?: RequestInit): Promise<any> => ipcRenderer.invoke('ipc:http:get', url, options),
  post: (url: string, body: any, options?: RequestInit): Promise<any> =>
    ipcRenderer.invoke('ipc:http:post', url, body, options),
  put: (url: string, body: any, options?: RequestInit): Promise<any> =>
    ipcRenderer.invoke('ipc:http:put', url, body, options),
  delete: (url: string, options?: RequestInit): Promise<any> => ipcRenderer.invoke('ipc:http:delete', url, options)
};

interface IElectronAPI {
  windowControls: WindowControls;
  openAI: OpenAI;
  http: Http;
}

contextBridge.exposeInMainWorld('electronAPI', {
  windowControls,
  openAI,
  http
} as IElectronAPI);
