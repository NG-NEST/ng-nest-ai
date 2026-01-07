import { Injectable, signal, computed } from '@angular/core';
import { FileNode, FsEvent, FsFile } from './file-tree.types';
import { basename, dirname, createId, normalizePath } from './file-tree.utils';

@Injectable({ providedIn: 'root' })
export class FileTreeService {
  /* ------------------------------------------------------------------ */
  /* Core index (VS Code 核心思想)                                      */
  /* ------------------------------------------------------------------ */

  private index = new Map<string, FileNode>();

  private _roots = signal<FileNode[]>([]);
  readonly roots = this._roots.asReadonly();

  private _selectedPath = signal<string | null>(null);
  readonly selectedPath = this._selectedPath.asReadonly();

  /* ------------------------------------------------------------------ */
  /* FS Event entry                                                     */
  /* ------------------------------------------------------------------ */

  applyFsEvent(event: FsEvent): void {
    switch (event.type) {
      case 'add':
        this.addNode(event.path, event.isDir);
        break;
      case 'addDir':
        this.addNode(event.path, true);
        break;
      case 'unlink':
      case 'unlinkDir':
        this.removeNode(event.path);
        break;
      case 'change':
        this.markDirty(event.path);
        break;
      case 'initial-scan':
        this.handleInitialScan(event.files, event.root);
        break;
      case 'error':
        console.error('File system error:', event.error);
        break;
    }
  }

  /**
   * 处理初始扫描事件，构建目录树
   */
  private handleInitialScan(files: FsFile[], root: string): void {
    // 清空现有索引和根节点
    this.index.clear();
    const newRoots: FileNode[] = [];

    // 按路径排序，确保父目录在子目录之前处理
    const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

    // 创建根节点
    const rootNode: FileNode = {
      id: createId(root),
      name: basename(root),
      path: normalizePath(root), // 确保路径格式一致
      type: 'dir',
      children: [],
      expanded: true,
      selected: false,
      deleted: false,
      dirty: false
    };

    this.index.set(rootNode.path, rootNode);
    newRoots.push(rootNode);

    // 处理每个文件/目录
    for (const file of sortedFiles) {
      this.addNodeFromInitialScan(file, rootNode.path, rootNode);
    }

    // 更新信号
    this._roots.set(newRoots);
  }

  /**
   * 从初始扫描结果添加节点
   */
  private addNodeFromInitialScan(file: FsFile, rootPath: string, rootNode: FileNode): void {
    const path = normalizePath(file.path);
    const isDir = file.isDir;

    // 检查节点是否已存在
    if (this.index.has(path)) {
      return;
    }

    // 确定父路径
    const parentPath = dirname(path);
    let parent: FileNode | undefined;

    // 如果是根目录的直接子项
    if (parentPath === rootPath) {
      parent = rootNode;
    } else {
      // 查找或创建父节点
      parent = this.index.get(parentPath);

      // 如果父节点不存在，需要创建路径上的所有中间目录
      if (!parent) {
        parent = this.createMissingPath(parentPath, rootPath, rootNode);
      }
    }

    if (!parent || parent.type !== 'dir') {
      console.warn(`Parent directory not found or invalid for path: ${path}`);
      return;
    }

    const node: FileNode = {
      id: createId(path),
      name: file.name,
      path,
      type: isDir ? 'dir' : 'file',
      parent,
      children: isDir ? [] : undefined,
      expanded: false,
      selected: false,
      deleted: false,
      dirty: false
    };

    parent.children!.push(node);

    // 对父节点的子节点进行排序：文件夹在前，文件在后
    this.sortChildren(parent);

    this.index.set(path, node);

    // 触发 _roots 信号更新以使计算信号重新计算
    this._roots.set([...this._roots()]);
  }

  /**
   * 创建缺失的路径节点
   */
  private createMissingPath(targetPath: string, rootPath: string, rootNode: FileNode): FileNode | undefined {
    const targetPathNormalized = normalizePath(targetPath);
    const pathParts = targetPathNormalized.split('/').filter((part) => part);

    // 从根路径开始，逐级创建缺失的目录节点
    let currentParent: FileNode = rootNode;

    // 找到路径中已存在的最高层级
    for (let i = 0; i < pathParts.length; i++) {
      const currentPath = pathParts.slice(0, i + 1).join('/');

      // 如果当前路径的节点已存在，使用它作为父节点
      const existingNode = this.index.get(currentPath);
      if (existingNode) {
        currentParent = existingNode;
        continue;
      }

      // 否则创建新的目录节点
      const newNode: FileNode = {
        id: createId(currentPath),
        name: pathParts[i],
        path: currentPath,
        type: 'dir',
        parent: currentParent,
        children: [],
        expanded: false,
        selected: false,
        deleted: false,
        dirty: false
      };

      currentParent.children!.push(newNode);

      // 对父节点的子节点进行排序
      this.sortChildren(currentParent);

      this.index.set(currentPath, newNode);
      currentParent = newNode;
    }

    return currentParent;
  }

  /* ------------------------------------------------------------------ */
  /* Node operations                                                    */
  /* ------------------------------------------------------------------ */

  private addNode(rawPath: string, isDir: boolean): void {
    const path = normalizePath(rawPath);
    if (this.index.has(path)) return;

    const parentPath = dirname(path);
    const parent = this.index.get(parentPath);
    if (!parent || parent.type !== 'dir') return;

    const node: FileNode = {
      id: createId(path),
      name: basename(path),
      path,
      type: isDir ? 'dir' : 'file',
      parent,
      children: isDir ? [] : undefined,
      expanded: false,
      selected: false,
      deleted: false,
      dirty: false
    };

    parent.children!.push(node);

    // 对父节点的子节点进行排序：文件夹在前，文件在后
    this.sortChildren(parent);

    this.index.set(path, node);

    // 触发 _roots 信号更新以使计算信号重新计算
    this._roots.set([...this._roots()]);
  }

  private removeNode(rawPath: string): void {
    const path = normalizePath(rawPath);
    const node = this.index.get(path);
    if (!node) return;

    node.deleted = true;

    const parent = node.parent;
    if (parent?.children) {
      parent.children = parent.children.filter((c) => c !== node);

      // 对父节点的子节点进行排序
      this.sortChildren(parent);
    }

    this.index.delete(path);

    this._roots.set([...this._roots()]);
  }

  private markDirty(rawPath: string): void {
    const path = normalizePath(rawPath);
    const node = this.index.get(path);
    if (node) {
      node.dirty = true;

      this._roots.set([...this._roots()]);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Sorting logic                                                      */
  /* ------------------------------------------------------------------ */

  /**
   * 对节点的子节点进行排序：文件夹在前，文件在后，同类型按名称排序
   */
  private sortChildren(parent: FileNode): void {
    if (!parent.children) return;

    parent.children.sort((a, b) => {
      // 首先按类型排序：目录在前，文件在后
      if (a.type === 'dir' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'dir') return 1;

      // 同类型按名称排序
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  /* ------------------------------------------------------------------ */
  /* UI actions                                                         */
  /* ------------------------------------------------------------------ */

  toggleExpand(node: FileNode): void {
    if (node.type === 'dir') {
      node.expanded = !node.expanded;

      this._roots.set([...this._roots()]);
    }
  }

  foldUp(level = 0): void {
    // 遍历所有根节点及其子节点，将指定层级及以下的目录节点设置为折叠状态
    const walkWithLevel = (nodes: FileNode[], currentLevel: number) => {
      for (const node of nodes) {
        // 如果当前层级大于等于指定层级且节点类型为目录，则折叠它
        if (node.type === 'dir' && currentLevel >= level) {
          node.expanded = false;
        }

        if (node.children) {
          walkWithLevel(node.children, currentLevel + 1);
        }
      }
    };

    walkWithLevel(this._roots(), 0);

    // 触发 _roots 信号更新以使计算信号重新计算
    this._roots.set([...this._roots()]);
  }

  select(node: FileNode): void {
    const prev = this._selectedPath();
    if (prev) {
      const prevNode = this.index.get(prev);
      if (prevNode) prevNode.selected = false;
    }

    node.selected = true;
    this._selectedPath.set(node.path);

    this._roots.set([...this._roots()]);
  }

  /* ------------------------------------------------------------------ */
  /* Projection (UI 专用视图)                                           */
  /* ------------------------------------------------------------------ */

  // 串行化的视图树，直接提供无循环引用的结构
  readonly viewTree = computed(() => {
    return this._roots().map((root) => this.projectNode(root));
  });

  private projectNode(node: FileNode): FileNode {
    if (node.type === 'dir' && node.expanded) {
      // 确保展开的目录中的子节点也是排序的
      const sortedNode = { ...node };
      if (sortedNode.children) {
        sortedNode.children = [...sortedNode.children]
          .sort((a, b) => {
            // 首先按类型排序：目录在前，文件在后
            if (a.type === 'dir' && b.type === 'file') return -1;
            if (a.type === 'file' && b.type === 'dir') return 1;

            // 同类型按名称排序
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
          })
          .map((c) => this.projectNode(c));
      }
      return sortedNode;
    }
    return node;
  }

  /* ------------------------------------------------------------------ */
  /* Utils                                                              */
  /* ------------------------------------------------------------------ */

  private walk(nodes: FileNode[], fn: (n: FileNode) => void): void {
    for (const node of nodes) {
      fn(node);
      if (node.children) {
        this.walk(node.children, fn);
      }
    }
  }

  /**
   * 根据路径查找节点
   */
  public getNodeByPath(path: string): FileNode | undefined {
    return this.index.get(normalizePath(path));
  }

  /**
   * 获取所有节点（用于搜索等操作）
   */
  public getAllNodes(): FileNode[] {
    return Array.from(this.index.values());
  }

  /**
   * 获取所有文件节点
   */
  public getAllFiles(): FileNode[] {
    return Array.from(this.index.values()).filter((node) => node.type === 'file');
  }

  /**
   * 获取所有目录节点
   */
  public getAllDirectories(): FileNode[] {
    return Array.from(this.index.values()).filter((node) => node.type === 'dir');
  }
}
