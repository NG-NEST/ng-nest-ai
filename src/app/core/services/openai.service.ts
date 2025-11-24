import { inject, Injectable, signal } from '@angular/core';
import {
  Manufacturer,
  ManufacturerService,
  Message,
  MessageService,
  Model,
  ModelService,
  Prompt,
  SessionService
} from '../indexedDB';
import { XMessageService } from '@ng-nest/ui/message';
import { Observable } from 'rxjs';
import { v4 } from 'uuid';

export interface ChatMessage {
  id?: string | number;
  role: string;
  content: string;
  reasoningContent?: string;

  sessionId?: number;
  typing?: boolean;
}

export interface ChatCompletionOptions {
  model: string;
  messages: ChatMessage[];
}

export interface ChatSendParams {
  content: string;
  data?: ChatMessage[];
  projectId?: number | null;
  prompt?: Prompt;
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

  private saveSystemMessage(sessionId: number, content: string, manufacturerId: number, modelId: number) {
    const systemMessage: Omit<Message, 'id' | 'createdAt'> = {
      sessionId: sessionId,
      manufacturerId: manufacturerId,
      modelId: modelId,
      role: 'system',
      content: content
    };

    this.messageService.create(systemMessage).subscribe();
  }

  send(params: ChatSendParams) {
    return new Observable((sub) => {
      let { content, data, projectId, prompt } = params;
      if (!content) return;
      data = data ?? [];
      projectId = projectId ?? null;
      if (!this.verify()) return;

      const manufacturerId = this.activeManufacturer()?.id;
      const modelId = this.activeModel()?.id;
      const modelCode = this.activeModel()?.code;
      const newSession = data?.length === 0;
      let sessionId = newSession ? null : data[0].sessionId;

      if (sessionId) {
        data.map((item) => {
          item.typing = false;
          return item;
        });
      }

      if (prompt) {
        data.push({
          id: v4(),
          role: 'system',
          content: prompt.content
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
        this.sessionService
          .create({ title: content!.substring(0, 50), projectId: projectId!, promptId: prompt?.id })
          .subscribe((id) => {
            sessionId = id;
            data.map((item) => {
              item.sessionId = id;
            });
            if (prompt) {
              this.saveSystemMessage(id, prompt.content!, manufacturerId!, modelId!);
            }
            this.saveUserMessage(id, content!, manufacturerId!, modelId!);
          });
      } else {
        if (prompt) {
          this.saveSystemMessage(sessionId!, prompt.content!, manufacturerId!, modelId!);
        }
        this.saveUserMessage(sessionId!, content!, manufacturerId!, modelId!);
      }

      const messages = data
        .filter((x) => x.role !== 'error' && !(x.role === 'assistant' && x.content === ''))
        .map((item) => ({
          role: item.role,
          content: item.content
        }));

      console.log(messages);

      let aiContent = '';
      let aiReasoningContent = '';
      let completed = false;

      const cancelFunc = window.electronAPI.openAI.chatCompletionStream(
        { model: modelCode, messages },
        (msg: any) => {
          // 接收流信息
          if (msg.choices && msg.choices.length > 0) {
            const delta = msg.choices[0].delta;

            if (delta) {
              const { content, reasoning_content } = delta;
              if (content) {
                aiContent += delta.content;
                const lastItemIndex = data.length - 1;
                if (lastItemIndex >= 0 && data[lastItemIndex].role === 'assistant') {
                  data[lastItemIndex].content = aiContent;
                  data[lastItemIndex].typing = true;
                }
              }
              if (reasoning_content) {
                aiReasoningContent += reasoning_content;
                const lastItemIndex = data.length - 1;
                if (lastItemIndex >= 0 && data[lastItemIndex].role === 'assistant') {
                  data[lastItemIndex].reasoningContent = aiReasoningContent;
                  data[lastItemIndex].typing = true;
                }
              }
            }
          }
          sub.next({
            start: true,
            content: aiContent,
            reasoningContent: aiReasoningContent
          });
        },
        () => {
          // 完成回调 - 保存AI回复到数据库
          if (sessionId !== null) {
            const aiMessage: Omit<Message, 'id' | 'createdAt'> = {
              sessionId: sessionId!,
              manufacturerId: manufacturerId!,
              modelId: modelId!,
              role: 'assistant',
              content: aiContent,
              reasoningContent: aiReasoningContent
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

  private verify() {
    if (this.activeManufacturer() === null) {
      this.message.warning('请设置并激活一个服务商！');
      return false;
    }
    if (this.activeModel() === null) {
      this.message.warning('请设置并激活一个模型！');
      return false;
    }

    return true;
  }
}
