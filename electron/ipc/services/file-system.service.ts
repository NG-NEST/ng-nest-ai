import { ipcMain, WebContents } from 'electron';
import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import fs from 'fs/promises';

export type FsEvent =
  | { type: 'add'; path: string; isDir: boolean }
  | { type: 'unlink'; path: string }
  | { type: 'change'; path: string }
  | { type: 'addDir'; path: string }
  | { type: 'unlinkDir'; path: string }
  | { type: 'error'; error: string }
  | { type: 'initial-scan'; files: FsFile[]; root: string };

export type FsFile = {
  path: string;
  name: string;
  isDir: boolean;
  size?: number;
  mtime?: Date;
  ctime?: Date;
};

export class FileSystemService {
  private watchers = new Map<string, FSWatcher>();
  private registeredHandlers = new Map<string, Function>();
  private isDestroyed = false;

  constructor() {
    this.registerIpcHandlers();
  }

  /* ------------------------------------------------------------------ */
  /* Core watch logic                                                    */
  /* ------------------------------------------------------------------ */

  private async watch(root: string, sender: WebContents, scanInitialFiles: boolean = true): Promise<boolean> {
    if (this.isDestroyed) return false;

    // 检查是否已经存在监听器
    if (this.watchers.has(root)) {
      // 如果监听器已存在，可以发送当前状态
      if (scanInitialFiles) {
        await this.sendInitialScan(root, sender);
      }
      return true;
    }

    const watcher = chokidar.watch(root, {
      persistent: true,
      ignoreInitial: true, // 设为true，因为我们手动处理初始扫描
      depth: Infinity
    });

    const send = (event: FsEvent) => {
      if (!sender.isDestroyed()) {
        sender.send('fs:event', event);
      }
    };

    watcher
      .on('add', (p) => send({ type: 'add', path: p, isDir: false }))
      .on('addDir', (p) => send({ type: 'addDir', path: p }))
      .on('change', (p) => send({ type: 'change', path: p }))
      .on('unlink', (p) => send({ type: 'unlink', path: p }))
      .on('unlinkDir', (p) => send({ type: 'unlinkDir', path: p }))
      .on('error', (err: any) =>
        send({
          type: 'error',
          error: err.message || String(err)
        })
      );

    this.watchers.set(root, watcher);

    // 发送初始文件列表
    if (scanInitialFiles) {
      await this.sendInitialScan(root, sender);
    }

    return true;
  }

  private async unwatch(root: string): Promise<boolean> {
    const watcher = this.watchers.get(root);
    if (!watcher) return false;

    await watcher.close();
    this.watchers.delete(root);
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Initial scan logic with async yielding                              */
  /* ------------------------------------------------------------------ */

  private async scanDirectory(
    dirPath: string,
    maxDepth: number = 10,
    currentDepth: number = 0,
    options?: {
      maxFiles?: number;
      currentCount?: number;
    }
  ): Promise<FsFile[]> {
    if (currentDepth > maxDepth) {
      return [];
    }

    // 检查是否超过最大文件限制
    if (options?.maxFiles && options.currentCount! >= options.maxFiles) {
      return [];
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      let files: FsFile[] = [];
      let currentCount = options?.currentCount || 0;

      for (const entry of entries) {
        // 定期让出控制权以避免阻塞事件循环
        if (files.length > 0 && files.length % 100 === 0) {
          // 让出事件循环控制权
          await this.yieldToEventLoop();
        }

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // 添加目录
          files.push({
            path: fullPath,
            name: entry.name,
            isDir: true
          });

          // 递归扫描子目录
          const subDirFiles = await this.scanDirectory(fullPath, maxDepth, currentDepth + 1, {
            maxFiles: options?.maxFiles,
            currentCount
          });

          files = files.concat(subDirFiles);
          currentCount += subDirFiles.length;
        } else {
          // 检查是否超过最大文件限制
          if (options?.maxFiles && currentCount >= options.maxFiles) {
            break;
          }

          // 添加文件
          try {
            const stat = await fs.stat(fullPath);
            files.push({
              path: fullPath,
              name: entry.name,
              isDir: false,
              size: stat.size,
              mtime: stat.mtime,
              ctime: stat.ctime
            });
          } catch (err) {
            // 如果无法获取文件状态，仍然添加基本信息
            files.push({
              path: fullPath,
              name: entry.name,
              isDir: false
            });
          }

          currentCount++;
        }
      }

      return files;
    } catch (error) {
      console.error(`Error scanning directory ${dirPath}:`, error);
      return [];
    }
  }

  /**
   * 让出事件循环控制权，避免阻塞
   */
  private yieldToEventLoop(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve));
  }

  /**
   * 异步发送初始扫描结果，避免阻塞
   */
  private async sendInitialScan(root: string, sender: WebContents): Promise<void> {
    try {
      // 对于大量文件，使用 Worker 线程
      const fileCount = await this.estimateFileCount(root);

      if (fileCount > 5000) {
        // 如果文件数量超过 5000，使用 Worker
        const { Worker } = await import('worker_threads');

        const worker = new Worker(__dirname + '/workers/file-scanner.worker.js', {
          workerData: { dirPath: root, maxFiles: 10000 }
        });

        const files = await new Promise<FsFile[]>((resolve, reject) => {
          worker.on('message', (result) => {
            if (result.success) {
              resolve(result.data);
            } else {
              reject(new Error(result.error));
            }
          });

          worker.on('error', reject);
        });

        const event: FsEvent = {
          type: 'initial-scan',
          files,
          root
        };

        if (!sender.isDestroyed()) {
          sender.send('fs:event', event);
        }
      } else {
        // 对于少量文件，直接扫描
        const files = await this.scanDirectory(root, 10, 0, { maxFiles: 10000 });

        const event: FsEvent = {
          type: 'initial-scan',
          files,
          root
        };

        if (!sender.isDestroyed()) {
          sender.send('fs:event', event);
        }
      }
    } catch (error) {
      const event: FsEvent = {
        type: 'error',
        error: `Initial scan failed: ${error instanceof Error ? error.message : String(error)}`
      };

      if (!sender.isDestroyed()) {
        sender.send('fs:event', event);
      }
    }
  }

  /**
   * 估算目录中的文件数量（快速估算，不扫描所有文件）
   */
  private async estimateFileCount(dirPath: string, maxDepth: number = 3, currentDepth: number = 0): Promise<number> {
    if (currentDepth > maxDepth) {
      return 0;
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      let count = 0;

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          count += await this.estimateFileCount(fullPath, maxDepth, currentDepth + 1);
        } else {
          count++;
        }
      }

      return count;
    } catch (error) {
      console.error(`Error estimating file count in directory ${dirPath}:`, error);
      return 0;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Additional utility methods                                          */
  /* ------------------------------------------------------------------ */

  /**
   * 获取指定目录的文件列表（不启动监听器）
   */
  public async getDirectoryContents(dirPath: string, maxFiles: number = 10000): Promise<FsFile[]> {
    if (this.isDestroyed) return [];
    return await this.scanDirectory(dirPath, 10, 0, { maxFiles });
  }

  /**
   * 检查路径是否存在
   */
  public async pathExists(dirPath: string): Promise<boolean> {
    try {
      await fs.access(dirPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取文件/目录信息
   */
  public async getFileInfo(filePath: string): Promise<FsFile | null> {
    try {
      const stat = await fs.stat(filePath);
      const dir = path.dirname(filePath);
      const name = path.basename(filePath);

      return {
        path: filePath,
        name,
        isDir: stat.isDirectory(),
        size: stat.isFile() ? stat.size : undefined,
        mtime: stat.mtime,
        ctime: stat.ctime
      };
    } catch (error) {
      console.error(`Error getting file info for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * 创建新文件
   */
  public async createFile(filePath: string): Promise<void> {
    try {
      // 确保父目录存在
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // 创建空文件
      await fs.writeFile(filePath, '');
    } catch (error) {
      console.error(`Error creating file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * 创建新目录
   */
  public async createDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      console.error(`Error creating directory ${dirPath}:`, error);
      throw error;
    }
  }

  /* ------------------------------------------------------------------ */
  /* IPC handlers                                                       */
  /* ------------------------------------------------------------------ */

  private registerIpcHandlers(): void {
    const handlers = new Map<string, Function>([
      [
        'ipc:fs:watch',
        async (e: Electron.IpcMainInvokeEvent, root: string) => {
          return this.watch(path.resolve(root), e.sender, true);
        }
      ],
      [
        'ipc:fs:watch-without-scan',
        async (e: Electron.IpcMainInvokeEvent, root: string) => {
          return this.watch(path.resolve(root), e.sender, false);
        }
      ],
      [
        'ipc:fs:unwatch',
        async (_e: Electron.IpcMainInvokeEvent, root: string) => {
          return this.unwatch(path.resolve(root));
        }
      ],
      [
        'ipc:fs:get-contents',
        async (_e: Electron.IpcMainInvokeEvent, dirPath: string, maxFiles?: number) => {
          return this.getDirectoryContents(path.resolve(dirPath), maxFiles ?? 10000);
        }
      ],
      [
        'ipc:fs:path-exists',
        async (_e: Electron.IpcMainInvokeEvent, dirPath: string) => {
          return this.pathExists(path.resolve(dirPath));
        }
      ],
      [
        'ipc:fs:get-file-info',
        async (_e: Electron.IpcMainInvokeEvent, filePath: string) => {
          return this.getFileInfo(path.resolve(filePath));
        }
      ],
      [
        'ipc:fs:initial-scan',
        async (e: Electron.IpcMainInvokeEvent, root: string) => {
          return this.sendInitialScan(path.resolve(root), e.sender);
        }
      ],
      [
        'ipc:fs:create-file',
        async (_e: Electron.IpcMainInvokeEvent, filePath: string) => {
          return this.createFile(path.resolve(filePath));
        }
      ],
      [
        'ipc:fs:create-folder',
        async (_e: Electron.IpcMainInvokeEvent, dirPath: string) => {
          return this.createDirectory(path.resolve(dirPath));
        }
      ]
    ]);

    handlers.forEach((handler, channel) => {
      if (!this.registeredHandlers.has(channel)) {
        ipcMain.handle(channel, async (event, ...args) => {
          return handler(event, ...args);
        });
        this.registeredHandlers.set(channel, handler);
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Cleanup                                                            */
  /* ------------------------------------------------------------------ */

  public async destroy(): Promise<void> {
    if (this.isDestroyed) return;

    for (const watcher of this.watchers.values()) {
      await watcher.close();
    }

    this.watchers.clear();

    this.registeredHandlers.forEach((_, channel) => {
      ipcMain.removeHandler(channel);
    });

    this.registeredHandlers.clear();
    this.isDestroyed = true;
  }
}
