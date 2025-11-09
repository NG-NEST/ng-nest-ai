import { inject, Injectable, signal } from '@angular/core';
import {
  Manufacturer,
  ManufacturerService,
  Message,
  MessageService,
  Model,
  ModelService,
  SessionService
} from '../indexedDB';
import { XMessageService } from '@ng-nest/ui/message';
import { last, Observable } from 'rxjs';
import { v4 } from 'uuid';

export interface ChatMessage {
  id?: string | number;
  role: string;
  content: string;

  sessionId?: number;
  typing?: boolean;
}

export interface ChatCompletionOptions {
  model: string;
  messages: ChatMessage[];
}

@Injectable({ providedIn: 'root' })
export class AppOpenAIService {
  message = inject(XMessageService);
  manufacturerService = inject(ManufacturerService);
  sessionService = inject(SessionService);
  messageService = inject(MessageService);
  modelService = inject(ModelService);
  activeManufacturer = signal<Manufacturer | null>(null);
  activeModel = signal<Model | null>(null);

  constructor() {
    this.manufacturerService.getActive().subscribe((x) => {
      this.setActiveManufacturer(x!);
    });
    this.manufacturerService.activeChange.subscribe((x) => {
      this.setActiveManufacturer(x!);
    });
    this.modelService.activeChange.subscribe((x) => {
      if (!x) return;
      if (x?.manufacturerId === this.activeManufacturer()?.id) {
        this.activeModel.set(x);
      }
    });
  }

  private setActiveManufacturer(manufacturer: Manufacturer) {
    if (!manufacturer) return;
    this.activeManufacturer.set(manufacturer!);
    this.modelService.getActive(manufacturer!.id!).subscribe((model) => {
      if (!model) return;
      this.activeModel.set(model!);
    });

    const { baseURL, apiKey } = manufacturer;

    window.electronAPI.openAI.initialize({ baseURL, apiKey });
  }

  private saveUserMessage(sessionId: number, content: string, manufacturerId: number, modelId: number) {
    const userMessage: Omit<Message, 'id' | 'createdAt'> = {
      sessionId: sessionId,
      manufacturerId: manufacturerId,
      modelId: modelId,
      role: 'user',
      content: content
    };

    this.messageService.create(userMessage).subscribe();
  }

  send(content: string, data: ChatMessage[] = [], projectId: number | null = null) {
    return new Observable((sub) => {
      if (!content) return;
      if (this.activeManufacturer() === null) {
        this.message.warning('请设置并激活一个服务商！');
        return;
      }
      if (this.activeModel() === null) {
        this.message.warning('请设置并激活一个模型！');
        return;
      }
      const manufacturerId = this.activeManufacturer()?.id;
      const modelId = this.activeModel()?.id;
      const modelCode = this.activeModel()?.code;
      const newSession = data.length === 0;
      let sessionId = newSession ? null : data[0].sessionId;

      if (sessionId) {
        data.map((item) => {
          item.typing = false;
          return item;
        });
      }

      data.push(
        {
          id: v4(),
          role: 'user',
          content: content!
        },
        { id: v4(), role: 'assistant', content: '' }
      );

      if (newSession) {
        this.sessionService.create({ title: content!.substring(0, 50), projectId: projectId! }).subscribe((id) => {
          sessionId = id;
          data.map((item) => {
            item.sessionId = id;
          });
          this.saveUserMessage(id, content!, manufacturerId!, modelId!);
        });
      } else {
        this.saveUserMessage(sessionId!, content!, manufacturerId!, modelId!);
      }

      const messages = data
        .filter((x) => x.role !== 'error' && !(x.role === 'assistant' && x.content === '' && x.typing === true))
        .map((item) => ({
          role: item.role,
          content: item.content
        }));

      let aiContent = '';
      let completed = false;

      const cancelFunc = window.electronAPI.openAI.chatCompletionStream(
        { model: modelCode, messages },
        (msg: any) => {
          // 接收流信息
          if (msg.choices && msg.choices.length > 0) {
            const delta = msg.choices[0].delta;
            if (delta && delta.content) {
              aiContent += delta.content;
              const lastItemIndex = data.length - 1;
              if (lastItemIndex >= 0 && data[lastItemIndex].role === 'assistant') {
                data[lastItemIndex].content = aiContent;
                data[lastItemIndex].typing = true;
              }
            }
          }
          sub.next({ start: true, content: aiContent });
        },
        () => {
          // 完成回调 - 保存AI回复到数据库
          if (sessionId !== null) {
            const aiMessage: Omit<Message, 'id' | 'createdAt'> = {
              sessionId: sessionId!,
              manufacturerId: manufacturerId!,
              modelId: modelId!,
              role: 'assistant',
              content: aiContent
            };
            this.messageService.create(aiMessage).subscribe();
          }

          const lastItemIndex = data.length - 1;
          if (lastItemIndex >= 0 && data[lastItemIndex].role === 'assistant') {
            data[lastItemIndex] = {
              ...data[lastItemIndex]
            };
          }

          completed = true;
          sub.next({ done: true, data });
          sub.complete();
        },
        (error: any) => {
          // 完成回调 - 保存错误消息到数据库
          if (sessionId !== null) {
            const aiMessage: Omit<Message, 'id' | 'createdAt'> = {
              sessionId: sessionId!,
              manufacturerId: manufacturerId!,
              modelId: modelId!,
              role: 'error',
              content: error
            };

            this.messageService.create(aiMessage).subscribe();
          }
          const lastItemIndex = data.length - 1;
          if (lastItemIndex >= 0 && data[lastItemIndex].role === 'assistant') {
            data[lastItemIndex].content = `${error}`;
            data[lastItemIndex].role = 'error';
          }

          // 错误回调
          completed = true;
          sub.next({ error, data });
          sub.error(error);
        }
      );

      // 清理函数
      return () => {
        if (!completed) {
          cancelFunc();
        }
      };
    });
  }

  chatCompletionStream(options: ChatCompletionOptions): Observable<{
    data?: any;
    done?: boolean;
    error?: any;
    content?: string;
  }> {
    return new Observable((subscriber) => {
      let aiContent = '';
      let completed = false;

      const cancelFunc = window.electronAPI.openAI.chatCompletionStream(
        options,
        (data: any) => {
          // 接收流信息
          if (data.choices && data.choices.length > 0) {
            const delta = data.choices[0].delta;
            if (delta && delta.content) {
              aiContent += delta.content;
            }
          }
          subscriber.next({ data, content: aiContent });
        },
        () => {
          // 完成回调
          completed = true;
          subscriber.next({ done: true, content: aiContent });
          subscriber.complete();
        },
        (error: any) => {
          // 错误回调
          completed = true;
          subscriber.next({ error, content: aiContent });
          subscriber.error(error);
        }
      );

      // 清理函数
      return () => {
        if (!completed) {
          cancelFunc();
        }
      };
    });
  }
}
