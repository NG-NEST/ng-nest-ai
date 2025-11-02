import { ipcRenderer, IpcRendererEvent } from 'electron';
import { IServerChannel } from './ipc';

// 客户端代理 - 渲染进程使用
export class ElectronIpcChannelClient {
  channelName: string;

  constructor(channelName: string) {
    this.channelName = channelName;
  }

  call(command: string, arg?: any) {
    // 实际调用 Electron 的 ipcRenderer
    return ipcRenderer.invoke(`ipc:${this.channelName}:${command}`, arg);
  }

  // 添加流式数据监听方法
  stream(command: string, arg: any, callback: (data: any) => void) {
    const eventName = `ipc:${this.channelName}:${command}:stream`;
    const errorHandlerName = `ipc:${this.channelName}:${command}:error`;

    const dataHandler = (_event: IpcRendererEvent, data: any) => callback(data);
    const errorHandler = (_event: IpcRendererEvent, error: any) => {
      ipcRenderer.removeListener(eventName, dataHandler);
      ipcRenderer.removeListener(errorHandlerName, errorHandler);
      callback({ error });
    };

    ipcRenderer.on(eventName, dataHandler);
    ipcRenderer.on(errorHandlerName, errorHandler);

    // 发起流式请求
    ipcRenderer.invoke(`ipc:${this.channelName}:${command}`, arg);

    // 返回取消订阅函数
    return () => {
      ipcRenderer.removeListener(eventName, dataHandler);
      ipcRenderer.removeListener(errorHandlerName, errorHandler);
      ipcRenderer.invoke(`ipc:${this.channelName}:${command}:cancel`);
    };
  }

  listen(event: string, arg?: any) {
    // 监听事件实现
    return (listener: (data: any) => void) => {
      const handler = (_event: IpcRendererEvent, data: any) => listener(data);
      ipcRenderer.on(`ipc:${this.channelName}:event:${event}`, handler);
      return () => {
        ipcRenderer.removeListener(`ipc:${this.channelName}:event:${event}`, handler);
      };
    };
  }
}

// 服务端通道 - 主进程使用
export class ElectronIpcServerChannel<T> implements IServerChannel<string> {
  constructor(
    private readonly channelName: string,
    private readonly service: T
  ) {}

  call<U>(ctx: string, command: string, arg?: any): Promise<U> {
    const method = (this.service as any)[command];
    if (typeof method === 'function') {
      return Promise.resolve(method.call(this.service, arg));
    }
    return Promise.reject(new Error(`Method ${command} not found`));
  }

  listen<U>(ctx: string, event: string, arg?: any): any {
    // 事件监听实现
    throw new Error(`Event ${event} not implemented`);
  }
}
