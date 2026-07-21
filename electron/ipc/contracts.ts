import type { FsFile, FsEvent } from './services/file-system.service';

/* ─── Window ─── */
export interface IWindowService {
  isMaximized(): Promise<boolean>;
  minimize(): Promise<void>;
  maximize(): Promise<void>;
  unmaximize(): Promise<void>;
  close(): Promise<void>;
  switchDevTools(show: boolean): Promise<void>;
  isDevToolsOpened(): Promise<boolean>;
  getSystemLocale(): Promise<string>;
  reloadPage(): Promise<void>;
  previewHtml(html: string): Promise<void>;
  selectDirectory(): Promise<string>;
  openExternal(url: string): Promise<void>;
  executeJavaScript(code: string, context?: Record<string, any>, timeout?: number): Promise<any>;
}

/* ─── OpenAI ─── */
export interface IOpenAIService {
  initialize(params: { apiKey: string; baseURL?: string }): Promise<{ success: boolean; error?: string }>;
  loadSkills(skills: any[]): Promise<{ success: boolean; count?: number; error?: string }>;
}

export interface ChatStreamOptions {
  model: string;
  messages: any[];
  streamId?: string;
  workspace?: string;
  [key: string]: any;
}

/* ─── HTTP ─── */
export interface IHttpService {
  get(url: string, params?: any, options?: RequestInit): Promise<any>;
  post(url: string, body: any, options?: RequestInit): Promise<any>;
  put(url: string, body: any, options?: RequestInit): Promise<any>;
  delete(url: string, options?: RequestInit): Promise<any>;
}

/* ─── MinIO ─── */
export interface IMinioService {
  uploadFile(bucketName: string, objectName: string, fileData: string, contentType?: string): Promise<boolean>;
}

/* ─── File System ─── */
export interface IFileSystemService {
  watch(root: string): Promise<boolean>;
  watchWithoutScan(root: string): Promise<boolean>;
  unwatch(root: string): Promise<boolean>;
  getContents(dirPath: string, maxFiles?: number): Promise<FsFile[]>;
  pathExists(dirPath: string): Promise<boolean>;
  getFileInfo(filePath: string): Promise<FsFile | null>;
  initialScan(root: string): Promise<void>;
  createFile(filePath: string): Promise<void>;
  createFolder(dirPath: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  delete(filePath: string): Promise<void>;
  copy(source: string, destination: string): Promise<void>;
  showInExplorer(filePath: string): Promise<void>;
}

/* ─── Safe Storage ─── */
export interface ISafeStorageService {
  isEncryptionAvailable(): Promise<boolean>;
  encryptString(plainText: string): Promise<string>;
  decryptString(encryptedBase64: string): Promise<string>;
}

/* ─── Aggregate API exposed to renderer ─── */
export interface IElectronAPI {
  windowControls: IWindowService;
  openAI: IOpenAIService & {
    chatCompletionStream(
      options: ChatStreamOptions,
      onData: (data: any) => void,
      onDone: () => void,
      onError: (error: any) => void
    ): () => void;
    registerIndexedDBHandler(handler: (args: any) => Promise<any>): void;
  };
  http: IHttpService;
  minio: IMinioService;
  fileSystem: IFileSystemService & {
    onDidChange(listener: (event: FsEvent) => void): () => void;
  };
  safeStorage: ISafeStorageService;
}
