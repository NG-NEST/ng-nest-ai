import { inject, Injectable } from '@angular/core';
import { ChatDelta, ChatMessage, ChatSendParams } from './openai.service';
import { Message, MessageService, SessionService, Request } from '../indexedDB';
import { catchError, concatMap, finalize, from, last, map, mergeScan, Observable, of, reduce, switchMap } from 'rxjs';
import { XMessageService } from '@ng-nest/ui';

@Injectable({ providedIn: 'root' })
export class AppHttpService {
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

  send(params: ChatSendParams) {
    let { content, data, prompt, projectId, manufacturer, model, image, video } = params;
    if (!content || !manufacturer || !model) return of({});
    data = data ?? [];
    projectId = projectId ?? null;

    const newSession = data?.length === 0;
    let sessionId = newSession ? null : data[0].sessionId;

    const manufacturerId = manufacturer.id;
    const modelId = model.id;
    const modelCode = model.code;
    const requests = model.requests ?? [];

    let { url, bodyFunction, headersFunction, code, outputFunction, paramsFunction, method } = model!;
    let { apiKey } = manufacturer!;
    let bodyPromise: Promise<Record<string, string>>;
    let paramsPromise: Promise<Record<string, string>>;
    let headersPromise: Promise<Record<string, string>>;

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

    // if (prompt) {
    //   data.push({
    //     id: crypto.randomUUID(),
    //     role: 'system',
    //     content: prompt.content
    //   });
    // }

    if (image) {
      userMsg.image = image;
      userMsg.imageContent = content;
    }

    if (video) {
      userMsg.video = video;
      userMsg.videoContent = content;
    }

    data.push(userMsg, { id: crypto.randomUUID(), role: 'assistant', content: '' });

    const saveMessage = (saveId: number) => {
      const saveMsg: any = {
        sessionId: 0,
        content: '',
        manufacturerId: manufacturerId!,
        modelId: modelId!
      };

      // if (prompt) {
      //   saveMsg.sessionId = saveId;
      //   saveMsg.content = prompt.content!;
      //   this.saveSystemMessage(saveMsg);
      // }

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

    const vars = { apiKey, code, content, image };

    try {
      bodyPromise = window.electronAPI.windowControls.executeJavaScript(this.replaceVars(bodyFunction!, vars));
      paramsPromise = window.electronAPI.windowControls.executeJavaScript(this.replaceVars(paramsFunction!, vars));
      headersPromise = window.electronAPI.windowControls.executeJavaScript(this.replaceVars(headersFunction!, vars));
    } catch (error) {
      console.error('Error:', error);
    }

    let aiContent = '';
    let aiReasoningContent = '';
    let aiImage = '';
    let aiVideo = '';
    let aiVideoContent = '';
    let completed = false;

    return from(
      Promise.all([bodyPromise!, paramsPromise!, headersPromise!]).then(([body, params, headers]) => {
        if (method === 'POST') {
          return window.electronAPI.http.post(url!, body, { headers });
        } else if (method === 'GET') {
          return window.electronAPI.http.get(url!, params, { headers });
        }
        return Promise.resolve({ status: 500, statusText: 'Request method is not supported', data: {} });
      })
    ).pipe(
      switchMap((msg) => {
        if (msg.status === 200) {
          return from(
            window.electronAPI.windowControls.executeJavaScript(this.replaceVars(outputFunction!, vars), {
              output: msg.data
            })
          ).pipe(switchMap((data) => this.requests(requests, vars, data)));
        } else {
          return of(msg);
        }
      }),
      map((msg: any) => {
        if (msg.error) {
          // 完成回调 - 保存错误消息到数据库
          if (sessionId !== null) {
            const aiMessage: Omit<Message, 'id' | 'createdAt'> = {
              sessionId: sessionId!,
              manufacturerId: manufacturerId!,
              modelId: modelId!,
              role: 'error',
              content: msg.statusText
            };

            this.messageService.create(aiMessage).subscribe();
          }
          const lastItemIndex = data.length - 1;
          if (lastItemIndex >= 0 && data[lastItemIndex].role === 'assistant') {
            data[lastItemIndex].content = `${msg.statusText}`;
            data[lastItemIndex].role = 'error';
          }
          return msg;
        }
        // 接收流信息
        if (msg.choices && msg.choices.length > 0) {
          const delta = msg.choices[0].delta;

          if (delta) {
            const { content, reasoning_content, image, video, videoContent } = delta as ChatDelta;

            const lastItemIndex = data.length - 1;
            if (lastItemIndex >= 0 && data[lastItemIndex].role === 'assistant') {
              if (content) {
                aiContent += delta.content;
                data[lastItemIndex].content = aiContent;
              }
              if (reasoning_content) {
                aiReasoningContent += reasoning_content;
                data[lastItemIndex].reasoningContent = aiReasoningContent;
              }
              if (image) {
                aiImage = image;
                data[lastItemIndex].image = aiImage;
              }
              if (video) {
                aiVideo = video;
                data[lastItemIndex].video = aiVideo;
              }
              if (videoContent) {
                aiVideoContent = videoContent;
                data[lastItemIndex].videoContent = aiVideoContent;
              }
              data[lastItemIndex].typing = true;
            }
          }
        }
        // 完成回调 - 保存AI回复到数据库
        if (sessionId !== null) {
          const aiMessage: Omit<Message, 'id' | 'createdAt'> = {
            sessionId: sessionId!,
            manufacturerId: manufacturerId!,
            modelId: modelId!,
            role: 'assistant',
            content: aiContent,
            reasoningContent: aiReasoningContent,
            image: aiImage,
            video: aiVideo,
            videoContent: aiVideoContent
          };
          this.messageService.create(aiMessage).subscribe();
        }

        const lastItemIndex = data.length - 1;
        if (lastItemIndex >= 0 && data[lastItemIndex].role === 'assistant') {
          data[lastItemIndex] = {
            ...data[lastItemIndex]
          };
        }
        return {
          start: true,
          content: aiContent,
          reasoningContent: aiReasoningContent,
          image: aiImage,
          video: aiVideo,
          videoContent: aiVideoContent
        };
      }),
      finalize(() => {
        completed = true;
      })
    );
  }

  requests(requests: Request[], vars: Record<string, any>, defaultData: any) {
    if (!requests || requests.length === 0) {
      return of(defaultData);
    }

    // 使用 mergeScan 替代 reduce，确保每一步都执行
    return from(requests).pipe(
      mergeScan(
        (accValue, request) => {
          // 检查累积值是否包含错误
          if (accValue && accValue.error) {
            return of(accValue); // 如果已经有错误，直接返回，不执行后续请求
          }

          if (!request.url) {
            return of(accValue);
          }

          return this.executeSingleRequest(request, vars, accValue).pipe(
            switchMap((output) => {
              if (output && output.retry) {
                return this.retryRequest(request, vars, accValue, output.interval, output.maxRetries);
              } else {
                return of(output);
              }
            })
          );
        },
        defaultData,
        1
      ), // concurrency 设置为 1，确保顺序执行
      last() // 获取最后的累积值
    );
  }

  private retryRequest(request: Request, vars: Record<string, any>, accValue: any, interval = 10000, maxRetries = 100) {
    return new Observable((observer) => {
      let retryCount = 0;
      let timeoutId: any = null;
      let subscription: any = null;
      let isCancelled = false;

      const cleanup = () => {
        isCancelled = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (subscription) {
          subscription.unsubscribe();
          subscription = null;
        }
      };

      const retry = () => {
        // 检查是否已被取消
        if (isCancelled) {
          return;
        }

        // 检查是否超过最大重试次数
        if (retryCount >= maxRetries) {
          observer.next({
            error: true,
            statusText: `Maximum retry attempts (${maxRetries}) exceeded`,
            status: 429, // Too Many Requests
            data: accValue
          });
          observer.complete();
          return;
        }

        timeoutId = setTimeout(() => {
          // 检查是否已被取消
          if (isCancelled) {
            return;
          }

          subscription = this.executeSingleRequest(request, vars, accValue).subscribe({
            next: (result) => {
              // 检查是否已被取消
              if (isCancelled) {
                return;
              }

              // 检查结果是否仍然需要重试
              if (result && result.retry && retryCount < maxRetries) {
                retryCount++;
                retry(); // 递归重试
              } else {
                cleanup();
                observer.next(result);
                observer.complete();
              }
            },
            error: (error) => {
              // 检查是否已被取消
              if (isCancelled) {
                return;
              }

              cleanup();
              observer.error(error);
            }
          });
        }, interval);
      };

      // 开始第一次重试
      retry();

      // 返回清理函数，当 Observable 被取消订阅时会调用
      return cleanup;
    });
  }

  private executeSingleRequest(request: Request, vars: Record<string, any>, accValue: any) {
    if (!request.url) {
      return of(accValue);
    }

    const extendedVars = { ...vars, ...accValue };

    let { method, url, headersFunction, paramsFunction, bodyFunction, outputFunction } = request;
    const scripts: Promise<any>[] = [];

    url = this.replaceVars(url!, extendedVars);

    scripts.push(
      window.electronAPI.windowControls.executeJavaScript(this.replaceVars(bodyFunction!, extendedVars), {
        input: accValue
      })
    );
    scripts.push(
      window.electronAPI.windowControls.executeJavaScript(this.replaceVars(paramsFunction!, extendedVars), {
        input: accValue
      })
    );
    scripts.push(
      window.electronAPI.windowControls.executeJavaScript(this.replaceVars(headersFunction!, extendedVars), {
        input: accValue
      })
    );

    return from(
      Promise.all(scripts).then(([body, params, headers]) => {
        if (method === 'POST') {
          return window.electronAPI.http.post(url, body, { headers });
        } else if (method === 'GET') {
          return window.electronAPI.http.get(url, params, { headers });
        }
        return Promise.resolve({ status: 500, statusText: 'Request method is not supported', data: {} });
      })
    ).pipe(
      switchMap((msg) => {
        if (msg.status !== 200) {
          return of(msg);
        }
        if (outputFunction) {
          return from(
            window.electronAPI.windowControls.executeJavaScript(this.replaceVars(outputFunction!, extendedVars), {
              output: msg.data
            })
          );
        }
        return of(msg.data);
      }),
      catchError((error) => {
        return of({ status: 500, statusText: error.message ?? 'Request error', error, data: {} });
      })
    );
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
