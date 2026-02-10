declare global {
  interface Window {
    electronAPI: {
      windowControls: {
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
      };
      openAI: {
        initialize(param: { apiKey: string; baseURL: string }): Promise<void>;
        loadSkills(skills: any[]): Promise<{ success: boolean; count?: number; error?: string }>;
        chatCompletionStream(
          options: any,
          onData: (data: any) => void,
          onDone: () => void,
          onError: (error: any) => void
        ): () => void;
        registerIndexedDBHandler(handler: (args: any) => Promise<any>): void;
      };
      http: {
        get(url: string, params?: any, options?: RequestInit): Promise<any>;
        post(url: string, body: any, options?: RequestInit): Promise<any>;
        put(url: string, body: any, options?: RequestInit): Promise<any>;
        delete(url: string, options?: RequestInit): Promise<any>;
      };
      minio: {
        uploadFile(bucketName: string, objectName: string, fileData: string, contentType?: string): Promise<boolean>;
      };
      fileSystem: {
        watch(root: string): Promise<boolean>;
        watchWithoutScan(root: string): Promise<boolean>;
        unwatch(root: string): Promise<boolean>;
        getContents(dirPath: string): Promise<any[]>;
        pathExists(dirPath: string): Promise<boolean>;
        getFileInfo(filePath: string): Promise<any>;
        onDidChange(listener: (event: any) => void): () => void;
        initialScan(root: string): Promise<void>;
        createFile(filePath: string): Promise<void>;
        createFolder(dirPath: string): Promise<void>;
        rename(oldPath: string, newPath: string): Promise<void>;
        delete(filePath: string): Promise<void>;
        copy(source: string, destination: string): Promise<void>;
        showInExplorer(filePath: string): Promise<void>;
      };
      safeStorage: {
        isEncryptionAvailable(): Promise<boolean>;
        encryptString(plainText: string): Promise<string>;
        decryptString(encryptedBase64: string): Promise<string>;
      };
    };
  }
}

export {};
