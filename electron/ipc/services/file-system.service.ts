import { shell, WebContents, IpcMainInvokeEvent } from 'electron';
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

  /* ── Methods that need event.sender (registered with useEventSender) ── */

  watch(event: IpcMainInvokeEvent, root: string): Promise<boolean> {
    return this._watch(path.resolve(root), event.sender, true);
  }

  watchWithoutScan(event: IpcMainInvokeEvent, root: string): Promise<boolean> {
    return this._watch(path.resolve(root), event.sender, false);
  }

  initialScan(event: IpcMainInvokeEvent, root: string): Promise<void> {
    return this._sendInitialScan(path.resolve(root), event.sender);
  }

  unwatch(_event: IpcMainInvokeEvent, root: string): Promise<boolean> {
    return this._unwatch(path.resolve(root));
  }

  /* ── Standard request/response methods ── */

  getContents(dirPath: string, maxFiles?: number): Promise<FsFile[]> {
    return this._scanDirectory(path.resolve(dirPath), 10, 0, { maxFiles: maxFiles ?? 10000 });
  }

  pathExists(dirPath: string): Promise<boolean> {
    return this._pathExists(path.resolve(dirPath));
  }

  getFileInfo(filePath: string): Promise<FsFile | null> {
    return this._getFileInfo(path.resolve(filePath));
  }

  createFile(filePath: string): Promise<void> {
    return this._createFile(path.resolve(filePath));
  }

  createFolder(dirPath: string): Promise<void> {
    return this._createDirectory(path.resolve(dirPath));
  }

  rename(oldPath: string, newPath: string): Promise<void> {
    return this._rename(path.resolve(oldPath), path.resolve(newPath));
  }

  delete(filePath: string): Promise<void> {
    return this._delete(path.resolve(filePath));
  }

  copy(source: string, destination: string): Promise<void> {
    return this._copy(path.resolve(source), path.resolve(destination));
  }

  showInExplorer(filePath: string): Promise<void> {
    shell.showItemInFolder(filePath);
    return Promise.resolve();
  }

  /* ── Internal implementations ── */

  private async _watch(root: string, sender: WebContents, scanInitialFiles: boolean): Promise<boolean> {
    if (this.watchers.has(root)) {
      if (scanInitialFiles) await this._sendInitialScan(root, sender);
      return true;
    }

    const watcher = chokidar.watch(root, { persistent: true, ignoreInitial: true, depth: Infinity });
    const send = (event: FsEvent) => { if (!sender.isDestroyed()) sender.send('fs:event', event); };

    watcher
      .on('add', (p) => send({ type: 'add', path: p, isDir: false }))
      .on('addDir', (p) => send({ type: 'addDir', path: p }))
      .on('change', (p) => send({ type: 'change', path: p }))
      .on('unlink', (p) => send({ type: 'unlink', path: p }))
      .on('unlinkDir', (p) => send({ type: 'unlinkDir', path: p }))
      .on('error', (err: any) => send({ type: 'error', error: err.message || String(err) }));

    this.watchers.set(root, watcher);
    if (scanInitialFiles) await this._sendInitialScan(root, sender);
    return true;
  }

  private async _unwatch(root: string): Promise<boolean> {
    const watcher = this.watchers.get(root);
    if (!watcher) return false;
    await watcher.close();
    this.watchers.delete(root);
    return true;
  }

  private async _scanDirectory(
    dirPath: string, maxDepth: number = 10, currentDepth: number = 0,
    options?: { maxFiles?: number; currentCount?: number }
  ): Promise<FsFile[]> {
    if (currentDepth > maxDepth || (options?.maxFiles && options.currentCount! >= options.maxFiles)) return [];
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      let files: FsFile[] = [];
      let currentCount = options?.currentCount || 0;
      for (const entry of entries) {
        if (files.length > 0 && files.length % 100 === 0) await new Promise(r => setImmediate(r));
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          files.push({ path: fullPath, name: entry.name, isDir: true });
          const sub = await this._scanDirectory(fullPath, maxDepth, currentDepth + 1, { maxFiles: options?.maxFiles, currentCount });
          files = files.concat(sub);
          currentCount += sub.length;
        } else {
          if (options?.maxFiles && currentCount >= options.maxFiles) break;
          try { const stat = await fs.stat(fullPath); files.push({ path: fullPath, name: entry.name, isDir: false, size: stat.size, mtime: stat.mtime, ctime: stat.ctime }); }
          catch { files.push({ path: fullPath, name: entry.name, isDir: false }); }
          currentCount++;
        }
      }
      return files;
    } catch { return []; }
  }

  private async _sendInitialScan(root: string, sender: WebContents): Promise<void> {
    try {
      const fileCount = await this._estimateFileCount(root);
      let files: FsFile[];
      if (fileCount > 5000) {
        const { Worker } = await import('worker_threads');
        const worker = new Worker(__dirname + '/workers/file-scanner.worker.js', { workerData: { dirPath: root, maxFiles: 10000 } });
        files = await new Promise<FsFile[]>((resolve, reject) => {
          worker.on('message', (result) => result.success ? resolve(result.data) : reject(new Error(result.error)));
          worker.on('error', reject);
        });
      } else {
        files = await this._scanDirectory(root, 10, 0, { maxFiles: 10000 });
      }
      if (!sender.isDestroyed()) sender.send('fs:event', { type: 'initial-scan', files, root } as FsEvent);
    } catch (error) {
      if (!sender.isDestroyed()) sender.send('fs:event', { type: 'error', error: `Initial scan failed: ${error instanceof Error ? error.message : String(error)}` } as FsEvent);
    }
  }

  private async _estimateFileCount(dirPath: string, maxDepth = 3, currentDepth = 0): Promise<number> {
    if (currentDepth > maxDepth) return 0;
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      let count = 0;
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) count += await this._estimateFileCount(fullPath, maxDepth, currentDepth + 1);
        else count++;
      }
      return count;
    } catch { return 0; }
  }

  private async _pathExists(dirPath: string): Promise<boolean> {
    try { await fs.access(dirPath); return true; } catch { return false; }
  }

  private async _getFileInfo(filePath: string): Promise<FsFile | null> {
    try {
      const stat = await fs.stat(filePath);
      return { path: filePath, name: path.basename(filePath), isDir: stat.isDirectory(), size: stat.isFile() ? stat.size : undefined, mtime: stat.mtime, ctime: stat.ctime };
    } catch { return null; }
  }

  private async _createFile(filePath: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, '');
  }

  private async _createDirectory(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  private async _rename(oldPath: string, newPath: string): Promise<void> {
    await fs.rename(oldPath, newPath);
  }

  private async _delete(filePath: string): Promise<void> {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) await fs.rm(filePath, { recursive: true, force: true });
    else await fs.unlink(filePath);
  }

  private async _copy(source: string, destination: string): Promise<void> {
    await (fs as any).cp(source, destination, { recursive: true });
  }

  async destroy(): Promise<void> {
    for (const watcher of this.watchers.values()) await watcher.close();
    this.watchers.clear();
  }
}
