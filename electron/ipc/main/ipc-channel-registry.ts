import { ipcMain } from 'electron';
import { IServerChannel } from '../common/ipc';

export class IpcChannelRegistry {
  private channels = new Map<string, IServerChannel>();
  private handlers = new Map<string, (event: Electron.IpcMainInvokeEvent, ...args: any[]) => Promise<any>>();

  registerChannel(channelName: string, channel: IServerChannel): void {
    if (this.channels.has(channelName)) {
      throw new Error(`Channel ${channelName} already registered`);
    }

    this.channels.set(channelName, channel);
  }

  registerCommand(channelName: string, command: string, handler: (arg?: any) => Promise<any>): void {
    const eventName = `ipc:${channelName}:${command}`;

    if (this.handlers.has(eventName)) {
      throw new Error(`Command ${eventName} already registered`);
    }

    const ipcHandler = async (event: Electron.IpcMainInvokeEvent, arg?: any) => {
      return await handler(arg);
    };

    ipcMain.handle(eventName, ipcHandler);
    this.handlers.set(eventName, ipcHandler);
  }

  registerChannelCommands(channelName: string, commands: Record<string, (arg?: any) => Promise<any>>): void {
    Object.entries(commands).forEach(([command, handler]) => {
      this.registerCommand(channelName, command, handler);
    });
  }

  unregisterChannel(channelName: string): void {
    // 移除与该频道相关的所有命令
    for (const [eventName, handler] of this.handlers) {
      if (eventName.startsWith(`ipc:${channelName}:`)) {
        ipcMain.removeHandler(eventName);
        this.handlers.delete(eventName);
      }
    }

    this.channels.delete(channelName);
  }

  getChannel(channelName: string): IServerChannel | undefined {
    return this.channels.get(channelName);
  }

  dispose(): void {
    this.handlers.forEach((_, eventName) => {
      ipcMain.removeHandler(eventName);
    });
    this.handlers.clear();
    this.channels.clear();
  }
}
