import { contextBridge, ipcRenderer } from 'electron';
import type { FsEvent, FsFile } from './ipc/services/file-system.service';
import type { IElectronAPI } from './ipc/contracts';

// window controls
const windowControls: IElectronAPI['windowControls'] = {
  isMaximized: () => ipcRenderer.invoke('ipc:window:isMaximized'),
  minimize: () => ipcRenderer.invoke('ipc:window:minimize'),
  maximize: () => ipcRenderer.invoke('ipc:window:maximize'),
  unmaximize: () => ipcRenderer.invoke('ipc:window:unmaximize'),
  close: () => ipcRenderer.invoke('ipc:window:close'),
  switchDevTools: (show: boolean) => ipcRenderer.invoke('ipc:window:switchDevTools', show),
  isDevToolsOpened: () => ipcRenderer.invoke('ipc:window:isDevToolsOpened'),
  getSystemLocale: () => ipcRenderer.invoke('ipc:window:getSystemLocale'),
  reloadPage: () => ipcRenderer.invoke('ipc:window:reloadPage'),
  previewHtml: (html: string) => ipcRenderer.invoke('ipc:window:previewHtml', html),
  selectDirectory: () => ipcRenderer.invoke('ipc:window:selectDirectory'),
  openExternal: (url: string) => ipcRenderer.invoke('ipc:window:openExternal', url),
  executeJavaScript: (code: string, context?: Record<string, any>, timeout?: number) =>
    ipcRenderer.invoke('ipc:window:executeJavaScript', code, context, timeout)
};

// openai
const openAI: IElectronAPI['openAI'] = {
  initialize: (param: { apiKey: string; baseURL: string }) => ipcRenderer.invoke('ipc:openai:initialize', param),
  loadSkills: (skills: any[]) => ipcRenderer.invoke('ipc:openai:loadSkills', skills),
  chatCompletionStream: (
    options: any,
    onData: (data: any) => void,
    onDone: () => void,
    onError: (error: any) => void
  ) => {
    const streamId = `${Date.now()}-${Math.random()}`;

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
      if (args.streamId && args.streamId !== streamId) return;
      cleanup();
      onError(args.error);
    };

    const cleanup = () => {
      ipcRenderer.removeListener('ipc:openai:chatCompletionStream:stream', handleStream);
      ipcRenderer.removeListener('ipc:openai:chatCompletionStream:error', handleError);
    };

    ipcRenderer.on('ipc:openai:chatCompletionStream:stream', handleStream);
    ipcRenderer.on('ipc:openai:chatCompletionStream:error', handleError);

    ipcRenderer.invoke('ipc:openai:chatCompletionStream', { ...options, streamId }).catch((invokeError) => {
      cleanup();
      onError(invokeError);
    });

    return () => {
      ipcRenderer.invoke('ipc:openai:chatCompletionStream:cancel', streamId);
    };
  },
  registerIndexedDBHandler: (handler: (args: any) => Promise<any>) => {
    ipcRenderer.on('ipc:openai:query-indexeddb', async (_event, args) => {
      try {
        const result = await handler(args);
        ipcRenderer.send('ipc:openai:query-indexeddb-result', { success: true, data: result });
      } catch (error) {
        ipcRenderer.send('ipc:openai:query-indexeddb-result', {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }
};

// http
const http: IElectronAPI['http'] = {
  get: (url: string, params?: any, options?: RequestInit) => ipcRenderer.invoke('ipc:http:get', url, params, options),
  post: (url: string, body: any, options?: RequestInit) => ipcRenderer.invoke('ipc:http:post', url, body, options),
  put: (url: string, body: any, options?: RequestInit) => ipcRenderer.invoke('ipc:http:put', url, body, options),
  delete: (url: string, options?: RequestInit) => ipcRenderer.invoke('ipc:http:delete', url, options)
};

// minio
const minio: IElectronAPI['minio'] = {
  uploadFile: (bucketName: string, objectName: string, fileData: string, contentType?: string) =>
    ipcRenderer.invoke('ipc:minio:uploadFile', bucketName, objectName, fileData, contentType)
};

// file system
const fsListeners = new Set<(e: FsEvent) => void>();
ipcRenderer.on('fs:event', (_e, event: FsEvent) => {
  fsListeners.forEach((fn) => fn(event));
});

const fileSystem: IElectronAPI['fileSystem'] = {
  watch: (root: string) => ipcRenderer.invoke('ipc:fs:watch', root),
  watchWithoutScan: (root: string) => ipcRenderer.invoke('ipc:fs:watch-without-scan', root),
  unwatch: (root: string) => ipcRenderer.invoke('ipc:fs:unwatch', root),
  getContents: (dirPath: string) => ipcRenderer.invoke('ipc:fs:get-contents', dirPath),
  pathExists: (dirPath: string) => ipcRenderer.invoke('ipc:fs:path-exists', dirPath),
  getFileInfo: (filePath: string) => ipcRenderer.invoke('ipc:fs:get-file-info', filePath),
  onDidChange(listener: (event: FsEvent) => void) {
    fsListeners.add(listener);
    return () => fsListeners.delete(listener);
  },
  initialScan: (root: string) => ipcRenderer.invoke('ipc:fs:initial-scan', root),
  createFile: (filePath: string) => ipcRenderer.invoke('ipc:fs:create-file', filePath),
  createFolder: (dirPath: string) => ipcRenderer.invoke('ipc:fs:create-folder', dirPath),
  rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('ipc:fs:rename', oldPath, newPath),
  delete: (filePath: string) => ipcRenderer.invoke('ipc:fs:delete', filePath),
  copy: (source: string, destination: string) => ipcRenderer.invoke('ipc:fs:copy', source, destination),
  showInExplorer: (filePath: string) => ipcRenderer.invoke('ipc:fs:showInExplorer', filePath)
};

// safeStorage
const safeStorage: IElectronAPI['safeStorage'] = {
  isEncryptionAvailable: () => ipcRenderer.invoke('ipc:safeStorage:isEncryptionAvailable'),
  encryptString: (plainText: string) => ipcRenderer.invoke('ipc:safeStorage:encryptString', plainText),
  decryptString: (encryptedBase64: string) => ipcRenderer.invoke('ipc:safeStorage:decryptString', encryptedBase64)
};

contextBridge.exposeInMainWorld('electronAPI', {
  windowControls,
  openAI,
  http,
  minio,
  fileSystem,
  safeStorage
} as unknown as IElectronAPI);
