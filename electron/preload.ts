import { contextBridge, ipcRenderer } from 'electron';
import { ChatCompletionMessageParam } from 'openai/resources';

// window controls
interface WindowControls {
  isMaximized: () => Promise<boolean>;
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  unmaximize: () => Promise<void>;
  close: () => Promise<void>;
  openDevTools: () => Promise<void>;
  reloadPage: () => Promise<void>;
  closeDevTools: () => Promise<void>;
}
const windowControls: WindowControls = {
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke('ipc:window:isMaximized'),
  minimize: (): Promise<void> => ipcRenderer.invoke('ipc:window:minimize'),
  maximize: (): Promise<void> => ipcRenderer.invoke('ipc:window:maximize'),
  unmaximize: (): Promise<void> => ipcRenderer.invoke('ipc:window:unmaximize'),
  close: (): Promise<void> => ipcRenderer.invoke('ipc:window:close'),
  openDevTools: (): Promise<void> => ipcRenderer.invoke('ipc:window:openDevTools'),
  reloadPage: (): Promise<void> => ipcRenderer.invoke('ipc:window:reloadPage'),
  closeDevTools: (): Promise<void> => ipcRenderer.invoke('ipc:window:closeDevTools')
};

// openai
interface OpenAI {
  initialize: (param: { apiKey: string; baseURL: string }) => Promise<void>;
  chatCompletionStream: (
    options: {
      model: string;
      messages: ChatCompletionMessageParam[];
    },
    onData: (data: any) => void,
    onDone: () => void,
    onError: (error: any) => void
  ) => () => void;
}
const openAI: OpenAI = {
  initialize: (param: { apiKey: string; baseURL: string }) => ipcRenderer.invoke('ipc:openai:initialize', param),
  chatCompletionStream: (
    options: {
      model: string;
      messages: ChatCompletionMessageParam[];
    },
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

interface IElectronAPI {
  windowControls: WindowControls;
  openAI: OpenAI;
}

contextBridge.exposeInMainWorld('electronAPI', {
  windowControls,
  openAI
} as IElectronAPI);
