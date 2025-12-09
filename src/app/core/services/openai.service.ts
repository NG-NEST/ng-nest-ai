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
  imageContent?: string;
  video?: string;
  videoContent?: string;

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
  image?: string;
  video?: string;

  manufacturer?: Manufacturer;
  model?: Model;
}

export type ChatDelta = ChatCompletionChunk.Choice.Delta & { reasoning_content?: string; image?: string };

@Injectable({ providedIn: 'root' })
export class AppOpenAIService {
  message = inject(XMessageService);
  sessionService = inject(SessionService);
  messageService = inject(MessageService);

  private saveUserMessage(message: {
    sessionId: number;
    content: string;
    image?: string;
    imageContent?: string;
    video?: string;
    videoContent?: string;
    manufacturerId: number;
    modelId: number;
  }) {
    const userMessage: Omit<Message, 'id' | 'createdAt'> = {
      sessionId: message.sessionId,
      manufacturerId: message.manufacturerId,
      modelId: message.modelId,
      role: 'user',
      content: message.content,
      image: message.image,
      imageContent: message.imageContent,
      video: message.video,
      videoContent: message.videoContent
    };

    this.messageService.create(userMessage).subscribe();
  }

  private saveSystemMessage(message: { sessionId: number; content: string; manufacturerId: number; modelId: number }) {
    const systemMessage: Omit<Message, 'id' | 'createdAt'> = {
      sessionId: message.sessionId,
      manufacturerId: message.manufacturerId,
      modelId: message.modelId,
      role: 'system',
      content: message.content
    };

    this.messageService.create(systemMessage).subscribe();
  }

  send(params: ChatSendParams) {
    return new Observable((sub) => {
      let { content, data, projectId, prompt, manufacturer, model, image, video } = params;
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

      const userMsg: ChatMessage = {
        id: v4(),
        role: 'user',
        content: content!
      };

      if (prompt) {
        data.push({
          id: v4(),
          role: 'system',
          content: prompt.content
        });
      }

      if (image) {
        userMsg.image = image;
        userMsg.imageContent = content;
        userMsg.content = [
          {
            type: 'image_url',
            image_url: {
              url: image
            }
          },
          { type: 'text', text: content }
        ] as any;
      }

      if (video) {
        userMsg.video = video;
        userMsg.videoContent = content;
        userMsg.content = [
          {
            type: 'video_url',
            video_url: {
              url: video
            }
          },
          { type: 'text', text: content }
        ] as any;
      }

      data.push(userMsg, { id: v4(), role: 'assistant', content: '' });

      const saveMessage = (saveId: number) => {
        const saveMsg: any = {
          sessionId: 0,
          content: '',
          manufacturerId: manufacturerId!,
          modelId: modelId!
        };
        if (prompt) {
          saveMsg.sessionId = saveId;
          saveMsg.content = prompt.content!;
          this.saveSystemMessage(saveMsg);
        }
        saveMsg.sessionId = saveId;
        saveMsg.content = content!;
        if (image) {
          saveMsg.image = userMsg.image;
          saveMsg.imageContent = userMsg.imageContent;
        }
        if (video) {
          saveMsg.video = userMsg.video;
          saveMsg.videoContent = userMsg.videoContent;
        }
        this.saveUserMessage(saveMsg);
      };

      if (newSession) {
        this.sessionService
          .create({ title: content!.substring(0, 50), projectId: projectId!, promptId: prompt?.id })
          .subscribe((id) => {
            sessionId = id;
            data.map((item) => {
              item.sessionId = id;
            });
            saveMessage(id!);
          });
      } else {
        saveMessage(sessionId!);
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
