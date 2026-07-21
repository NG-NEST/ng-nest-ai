import type { IElectronAPI } from '../../electron/ipc/contracts';

declare global {
  interface Window {
    electronAPI: IElectronAPI;
    Prism?: typeof import('prismjs');
    monaco?: typeof import('monaco-editor');
    require?: (modules: string[], callback: (...args: any[]) => void) => void;
  }
}

export {};
