import { inject, Injectable } from '@angular/core';
import { Manufacturer, Message, MessageService, Model, Prompt, SessionService } from '../indexedDB';
import { XMessageService } from '@ng-nest/ui/message';
import { Observable } from 'rxjs';
import { v4 } from 'uuid';
import { ChatCompletionChunk } from 'openai/resources';

export interface ChatMessage {
  id?: string | number;
  role: string;
  content: string;
  reasoningContent?: string;
  image?: string;

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

  manufacturer?: Manufacturer;
  model?: Model;
}

export type ChatDelta = ChatCompletionChunk.Choice.Delta & { reasoning_content?: string; image?: string };

@Injectable({ providedIn: 'root' })
export class AppOpenAIService {
  message = inject(XMessageService);
  sessionService = inject(SessionService);
  messageService = inject(MessageService);

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
      let { content, data, projectId, prompt, manufacturer, model } = params;
      if (!content || !manufacturer || !model) return;
      data = data ?? [];
      projectId = projectId ?? null;

      const newSession = data?.length === 0;
      let sessionId = newSession ? null : data[0].sessionId;

      const manufacturerId = manufacturer.id;
      const modelId = model.id;
      const modelCode = model.code;
      const { inputFunction, outputFunction } = model;

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

      let aiContent = '';
      let aiReasoningContent = '';
      let completed = false;

      const input = this.inputTranslation({ model: modelCode!, messages }, inputFunction);

      const cancelFunc = window.electronAPI.openAI.chatCompletionStream(
        input,
        (msg: ChatCompletionChunk) => {
          const output = this.outputTranslation(msg, outputFunction);

          // 接收流信息
          if (output.choices && output.choices.length > 0) {
            const delta = output.choices[0].delta;

            if (delta) {
              const { content, reasoning_content } = delta as ChatDelta;
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

  private inputTranslation(input: ChatCompletionOptions, inputFunction?: string) {
    if (inputFunction && inputFunction.trim() !== '') {
      try {
        const transformFunction = new Function('input', `${inputFunction}`);
        return transformFunction(input);
      } catch (error) {
        console.error('Input transformation function error:', error);
        return input;
      }
    } else {
      return input;
    }
  }

  private outputTranslation(output: ChatCompletionChunk, outputFunction?: string): ChatCompletionChunk {
    if (outputFunction && outputFunction.trim() !== '') {
      try {
        const transformFunction = new Function('output', `${outputFunction}`);
        return transformFunction(output);
      } catch (error) {
        console.error('Output transformation function error:', error);
        return output;
      }
    } else {
      return output;
    }
  }
}
