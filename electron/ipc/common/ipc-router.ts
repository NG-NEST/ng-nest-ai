import { ipcMain, IpcMainInvokeEvent } from 'electron';

type AnyService = Record<string, any>;

export class IpcRouter {
  private channels = new Set<string>();
  private instances = new Map<string, AnyService>();

  add<T extends AnyService>(
    name: string,
    instance: T,
    options?: {
      expose?: (keyof T)[];     // if set, only these methods are exposed
      useEventSender?: (keyof T)[]; // methods that need IpcMainInvokeEvent
    }
  ): this {
    const useEventSet = new Set(options?.useEventSender ?? []);
    const exposeList = options?.expose;

    // Collect methods: either from explicit list, or auto-discover (skip special names)
    const methods: string[] = exposeList
      ? (exposeList as string[])
      : this.discoverMethods(instance);

    for (const key of methods) {
      const channel = `ipc:${name}:${key}`;
      const useEvent = useEventSet.has(key);

      ipcMain.handle(channel, useEvent
        ? async (event: IpcMainInvokeEvent, ...args: any[]) => instance[key](event, ...args)
        : async (_event: IpcMainInvokeEvent, ...args: any[]) => instance[key](...args)
      );

      this.channels.add(channel);
    }

    this.instances.set(name, instance);
    return this;
  }

  destroy() {
    this.instances.forEach((instance) => {
      const svc = instance as { destroy?: () => void };
      svc.destroy?.();
    });
    this.instances.clear();

    // Remove all IPC handlers
    for (const ch of this.channels) {
      ipcMain.removeHandler(ch);
    }
    this.channels.clear();
  }

  private discoverMethods(instance: AnyService): string[] {
    const skip = new Set(['constructor', 'destroy']);
    const methods: string[] = [];

    for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(instance))) {
      if (skip.has(key)) continue;
      const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(instance), key);
      if (!desc || typeof desc.value !== 'function') continue;
      methods.push(key);
    }

    return methods;
  }
}
