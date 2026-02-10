import { inject, Injectable } from '@angular/core';
import { Manufacturer, Message, MessageService, Model, Prompt, SessionService } from '../indexedDB';
import { XMessageService } from '@ng-nest/ui/message';
import { Observable } from 'rxjs';
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
  workspace?: string;
  prompt?: Prompt;
  image?: string;
  video?: string;

  manufacturer?: Manufacturer;
  model?: Model;
}

export type ChatDelta = ChatCompletionChunk.Choice.Delta & {
  reasoning_content?: string;
  image?: string;
  video?: string;
  videoContent?: string;
};

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
      let { content, data, projectId, workspace, prompt, manufacturer, model, image, video } = params;
      if (!content || !manufacturer || !model) return;
      data = data ?? [];
      projectId = projectId ?? null;

      const newSession = data?.length === 0;
      let sessionId = newSession ? null : data[0].sessionId;

      let { apiKey } = manufacturer!;
      const manufacturerId = manufacturer.id;
      const modelId = model.id;
      const modelCode = model.code;
      const { inputFunction, outputFunction } = model;

      let inputPromise: Promise<any>;
      let outputPromise: Promise<any>;

      if (sessionId) {
        data.map((item) => {
          item.typing = false;
          return item;
        });
      }

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: content!
      };

      if (prompt) {
        data.push({
          id: crypto.randomUUID(),
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

      data.push(userMsg, { id: crypto.randomUUID(), role: 'assistant', content: '' });

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

      const vars = { apiKey, code: modelCode, content, workspace };
      const inputParam = { model: modelCode!, messages, workspace };

      try {
        if (!inputFunction || inputFunction?.trim() === '') {
          inputPromise = Promise.resolve(inputParam);
        } else {
          inputPromise = window.electronAPI.windowControls.executeJavaScript(this.replaceVars(inputFunction!, vars), {
            input: { model: modelCode!, messages, workspace }
          }) as Promise<any>;
        }
        inputPromise.then((input) => {
          const cancelFunc = window.electronAPI.openAI.chatCompletionStream(
            input,
            (msg: ChatCompletionChunk) => {
              if (!outputFunction || outputFunction?.trim() === '') {
                outputPromise = Promise.resolve(msg);
              } else {
                outputPromise = window.electronAPI.windowControls.executeJavaScript(
                  this.replaceVars(outputFunction!, vars),
                  {
                    output: msg
                  }
                ) as Promise<any>;
              }

              outputPromise.then((output) => {
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
              });

              // 接收流信息
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
          sub.next({
            cancel: () => {
              if (!completed) {
                cancelFunc();
              }
            }
          });
        });
      } catch (error) {
        sub.next({ error: '解析异常', data });
        sub.error(error);
      }
    });
  }

  replaceVars(content: string, values: Record<string, any>) {
    if (!content) return '';

    // 创建映射关系
    const replacements: Record<string, string> = {};

    for (let key in values) {
      if (typeof values[key] !== 'undefined') {
        replacements[`\$\{${key}\}`] = values[key];
      }
    }

    // 逐一替换每个变量
    let result = content;
    Object.keys(replacements).forEach((key) => {
      const value = replacements[key];
      // 使用更安全的字符串替换方法
      result = result.split(key).join(value);
    });

    return result;
  }
}
