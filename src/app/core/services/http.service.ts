import { inject, Injectable } from '@angular/core';
import { ChatDelta, ChatSendParams } from './openai.service';
import { ChatCompletionChunk } from 'openai/resources';
import { Message, MessageService, SessionService } from '../indexedDB';
import { finalize, from, map, of } from 'rxjs';
import { XMessageService } from '@ng-nest/ui';

@Injectable({ providedIn: 'root' })
export class AppHttpService {
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
    let { content, data, prompt, projectId, manufacturer, model } = params;
    if (!content || !manufacturer || !model) return of({});
    data = data ?? [];
    projectId = projectId ?? null;

    const newSession = data?.length === 0;
    let sessionId = newSession ? null : data[0].sessionId;

    const manufacturerId = manufacturer.id;
    const modelId = model.id;
    const modelCode = model.code;

    let { url, bodyFunction, headersFunction, code, inputFunction, outputFunction } = model!;
    let { apiKey } = manufacturer!;
    let bodyPromise: Promise<Record<string, string>>;
    let headersPromise: Promise<Record<string, string>>;

    if (sessionId) {
      data.map((item) => {
        item.typing = false;
        return item;
      });
    }

    // if (prompt) {
    //   data.push({
    //     id: crypto.randomUUID(),
    //     role: 'system',
    //     content: prompt.content
    //   });
    // }

    data.push(
      {
        id: crypto.randomUUID(),
        role: 'user',
        content: content!
      },
      { id: crypto.randomUUID(), role: 'assistant', content: '' }
    );

    if (newSession) {
      this.sessionService
        .create({ title: content!.substring(0, 50), projectId: projectId!, promptId: prompt?.id })
        .subscribe((id) => {
          sessionId = id;
          data.map((item) => {
            item.sessionId = id;
          });
          // if (prompt) {
          //   this.saveSystemMessage(id, prompt.content!, manufacturerId!, modelId!);
          // }
          this.saveUserMessage(id, content!, manufacturerId!, modelId!);
        });
    } else {
      // if (prompt) {
      //   this.saveSystemMessage(sessionId!, prompt.content!, manufacturerId!, modelId!);
      // }
      this.saveUserMessage(sessionId!, content!, manufacturerId!, modelId!);
    }

    try {
      const vars = { apiKey, code, content };
      bodyPromise = window.electronAPI.windowControls.executeJavaScript(this.replaceVars(bodyFunction!, vars));
      headersPromise = window.electronAPI.windowControls.executeJavaScript(this.replaceVars(headersFunction!, vars));
    } catch (error) {
      console.error('Error:', error);
    }

    let aiContent = '';
    let aiReasoningContent = '';
    let aiImage = '';
    let completed = false;

    return from(
      Promise.all([bodyPromise!, headersPromise!]).then(([body, headers]) =>
        window.electronAPI.http.post(url, body, { headers })
      )
    ).pipe(
      map((msg) => {
        if (msg.status === 200) {
          const output = this.outputTranslation(msg.data, outputFunction);
          // 接收流信息
          if (output.choices && output.choices.length > 0) {
            const delta = output.choices[0].delta;

            if (delta) {
              const { content, reasoning_content, image } = delta as ChatDelta;
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
              if (image) {
                aiImage = image;
                const lastItemIndex = data.length - 1;
                if (lastItemIndex >= 0 && data[lastItemIndex].role === 'assistant') {
                  data[lastItemIndex].image = aiImage;
                  data[lastItemIndex].typing = true;
                }
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
              image: aiImage
            };
            this.messageService.create(aiMessage).subscribe();
          }

          const lastItemIndex = data.length - 1;
          if (lastItemIndex >= 0 && data[lastItemIndex].role === 'assistant') {
            data[lastItemIndex] = {
              ...data[lastItemIndex]
            };
          }
          return { start: true, content: aiContent, reasoningContent: aiReasoningContent, image: aiImage };
        } else {
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

          return { error: msg.statusText, data };
        }
      }),
      finalize(() => {
        completed = true;
      })
    );
  }

  replaceVars(content: string, values: { apiKey: string; code: string; content: string }) {
    // 创建映射关系
    const replacements: Record<string, string> = {
      '${apiKey}': values.apiKey,
      '${code}': values.code,
      '${content}': values.content
    };

    // 逐一替换每个变量
    let result = content;
    Object.keys(replacements).forEach((key) => {
      const value = replacements[key];
      // 使用更安全的字符串替换方法
      result = result.split(key).join(value);
    });

    return result;
  }

  private outputTranslation(output: any, outputFunction?: string): ChatCompletionChunk {
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
