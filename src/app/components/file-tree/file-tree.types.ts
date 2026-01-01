export type FileNodeType = 'file' | 'dir';

export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: FileNodeType;

  parent?: FileNode;
  children?: FileNode[];

  // ---- UI / 状态 ----
  expanded: boolean;
  selected: boolean;
  deleted: boolean;
  dirty: boolean;
}

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
};
