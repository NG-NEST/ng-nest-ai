import { ipcRenderer, IpcRendererEvent } from 'electron';

type FunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];

export class IpcClient {
  proxy<T extends Record<string, any>>(name: string) {
    return new Proxy({} as {
      [K in FunctionPropertyNames<T>]: T[K] extends (...args: infer A) => infer R
        ? (...args: A) => Promise<R>
        : never;
    }, {
      get: (_target, method: string) => {
        return (...args: any[]) =>
          ipcRenderer.invoke(`ipc:${name}:${method}`, ...args);
      }
    });
  }

  stream<T = any>(
    name: string,
    method: string,
    arg: any,
    onData: (data: T) => void,
    onDone: () => void,
    onError: (error: any) => void
  ): () => void {
    const streamId = `${Date.now()}-${Math.random()}`;
    const channel = `ipc:${name}:${method}`;

    const handleStream = (_event: IpcRendererEvent, args: any) => {
      if (args.streamId && args.streamId !== streamId) return;
      if (args.done) { cleanup(); onDone(); }
      else onData(args.data);
    };

    const handleError = (_event: IpcRendererEvent, args: any) => {
      if (args.streamId && args.streamId !== streamId) return;
      cleanup();
      onError(args.error);
    };

    const cleanup = () => {
      ipcRenderer.removeListener(`${channel}:stream`, handleStream);
      ipcRenderer.removeListener(`${channel}:error`, handleError);
    };

    ipcRenderer.on(`${channel}:stream`, handleStream);
    ipcRenderer.on(`${channel}:error`, handleError);

    ipcRenderer.invoke(channel, { ...arg, streamId }).catch((err) => {
      cleanup();
      onError(err);
    });

    return () => {
      ipcRenderer.invoke(`${channel}:cancel`, streamId);
      cleanup();
    };
  }

  on<T = any>(event: string, listener: (data: T) => void): () => void {
    const handler = (_event: IpcRendererEvent, data: T) => listener(data);
    ipcRenderer.on(event, handler);
    return () => ipcRenderer.removeListener(event, handler);
  }
}
