import { contextBridge, ipcRenderer } from 'electron';
import type { Chat } from 'openai/resources';
import type { FsEvent, FsFile } from './ipc/services/file-system.service';

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
  executeJavaScript: (code: string, context?: Record<string, any>, timeout?: number) => Promise<any>;
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
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('ipc:window:openExternal', url),
  executeJavaScript: (code: string, context?: Record<string, any>, timeout?: number): Promise<any> =>
    ipcRenderer.invoke('ipc:window:executeJavaScript', code, context, timeout)
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
  get: (url: string, params?: any, options?: RequestInit) => Promise<any>;
  post: (url: string, body: any, options?: RequestInit) => Promise<any>;
  put: (url: string, body: any, options?: RequestInit) => Promise<any>;
  delete: (url: string, options?: RequestInit) => Promise<any>;
}
const http: Http = {
  get: (url: string, params?: any, options?: RequestInit): Promise<any> =>
    ipcRenderer.invoke('ipc:http:get', url, params, options),
  post: (url: string, body: any, options?: RequestInit): Promise<any> =>
    ipcRenderer.invoke('ipc:http:post', url, body, options),
  put: (url: string, body: any, options?: RequestInit): Promise<any> =>
    ipcRenderer.invoke('ipc:http:put', url, body, options),
  delete: (url: string, options?: RequestInit): Promise<any> => ipcRenderer.invoke('ipc:http:delete', url, options)
};

// minio
interface Minio {
  uploadFile: (bucketName: string, objectName: string, fileData: string) => Promise<boolean>;
}
const minio: Minio = {
  uploadFile: (bucketName: string, objectName: string, fileData: string) =>
    ipcRenderer.invoke('ipc:minio:uploadFile', bucketName, objectName, fileData)
};

// file system
interface FileSystem {
  watch: (root: string) => Promise<boolean>;
  watchWithoutScan: (root: string) => Promise<boolean>; // 不扫描初始文件的监听
  unwatch: (root: string) => Promise<boolean>;
  getContents: (dirPath: string) => Promise<FsFile[]>; // 获取目录内容
  pathExists: (dirPath: string) => Promise<boolean>; // 检查路径是否存在
  getFileInfo: (filePath: string) => Promise<FsFile | null>; // 获取文件信息
  onDidChange(listener: (event: FsEvent) => void): () => void; // 监听文件系统事件
  initialScan: (root: string) => Promise<void>; // 初始扫描
  createFile: (filePath: string) => Promise<void>; // 创建文件
  createFolder: (dirPath: string) => Promise<void>; // 创建文件夹
}

const fsListeners = new Set<(e: FsEvent) => void>();
ipcRenderer.on('fs:event', (_e, event: FsEvent) => {
  fsListeners.forEach((fn) => fn(event));
});

const fileSystem: FileSystem = {
  watch: (root: string) => ipcRenderer.invoke('ipc:fs:watch', root),
  watchWithoutScan: (root: string) => ipcRenderer.invoke('ipc:fs:watch-without-scan', root),
  unwatch: (root: string) => ipcRenderer.invoke('ipc:fs:unwatch', root),
  getContents: (dirPath: string) => ipcRenderer.invoke('ipc:fs:get-contents', dirPath),
  pathExists: (dirPath: string) => ipcRenderer.invoke('ipc:fs:path-exists', dirPath),
  getFileInfo: (filePath: string) => ipcRenderer.invoke('ipc:fs:get-file-info', filePath),
  onDidChange(listener) {
    fsListeners.add(listener);
    return () => fsListeners.delete(listener);
  },
  initialScan: (root: string) => ipcRenderer.invoke('ipc:fs:initial-scan', root),
  createFile: (filePath: string) => ipcRenderer.invoke('ipc:fs:create-file', filePath),
  createFolder: (dirPath: string) => ipcRenderer.invoke('ipc:fs:create-folder', dirPath)
};

interface IElectronAPI {
  windowControls: WindowControls;
  openAI: OpenAI;
  http: Http;
  minio: Minio;
  fileSystem: FileSystem;
}

contextBridge.exposeInMainWorld('electronAPI', {
  windowControls,
  openAI,
  http,
  minio,
  fileSystem
} as IElectronAPI);
