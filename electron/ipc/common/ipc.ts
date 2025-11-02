export interface IChannel {
  call<T>(command: string, arg?: any): Promise<T>;
  listen<T>(event: string, arg?: any): Event;
}

export interface IServerChannel<TContext = string> {
  call<T>(ctx: TContext, command: string, arg?: any): Promise<T>;
  listen<T>(ctx: TContext, event: string, arg?: any): Event;
}

export interface IpcMessage {
  type: 'call' | 'reply' | 'replyErr' | 'event';
  id: string;
  ch: string; // channel name
  msg?: string; // command or event name
  err?: any;
  data?: any;
}
