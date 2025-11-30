import { inject, Injectable } from '@angular/core';
import { ChatDelta, ChatSendParams } from './openai.service';
import { ChatCompletionChunk } from 'openai/resources';
import { Header, Message, MessageService, SessionService } from '../indexedDB';
import { from, map, of, tap } from 'rxjs';
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

    let { url, body, code, inputFunction, outputFunction } = model!;
    let { apiKey } = manufacturer!;
    let headers: Record<string, string> = {};

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
          //   if (prompt) {
          //     this.saveSystemMessage(id, prompt.content!, manufacturerId!, modelId!);
          //   }
          this.saveUserMessage(id, content!, manufacturerId!, modelId!);
        });
    } else {
      //   if (prompt) {
      //     this.saveSystemMessage(sessionId!, prompt.content!, manufacturerId!, modelId!);
      //   }
      this.saveUserMessage(sessionId!, content!, manufacturerId!, modelId!);
    }

    try {
      body = this.inputTranslation(JSON.parse(this.replaceVars(body!, { apiKey, code, content })), inputFunction);
      headers = this.setHeaders(model.headers!, { apiKey, code, content }) as { [key: string]: string };
    } catch (error) {
      console.error('Error:', error);
    }

    let aiContent = '';
    let aiReasoningContent = '';
    let completed = false;

    return from(window.electronAPI.http.post(url, body, { headers }) as Promise<any>).pipe(
      tap((data) => {
        console.log('before', data);
      }),
      map((data) => {
        if (data.status === 200) {
          const output = this.outputTranslation(data.data, outputFunction);
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
          return output;
        } else {
          const error = data.error;
          this.message.error(data.data ?? data.error?.message ?? '请求失败');

          return { error };
        }
      }),
      tap((data) => {
        console.log('after', data);
      })
    );
  }

  setHeaders(headers: Header[], values: { apiKey: string; code: string; content: string }) {
    const header: { [key: string]: string } = {};
    for (let h of headers) {
      if (h.enabled) header[h.key!] = this.replaceVars(h.value!, values);
    }
    return header;
  }

  replaceVars(body: string, values: { apiKey: string; code: string; content: string }) {
    // 创建映射关系
    const replacements: Record<string, string> = {
      '${apiKey}': values.apiKey,
      '${code}': values.code,
      '${content}': values.content
    };

    // 逐一替换每个变量
    let result = body;
    Object.keys(replacements).forEach((key) => {
      const value = replacements[key];
      // 使用更安全的字符串替换方法
      result = result.split(key).join(value);
    });

    return result;
  }

  private inputTranslation(body: any, inputFunction?: string) {
    if (inputFunction && inputFunction.trim() !== '') {
      try {
        const transformFunction = new Function('input', `${inputFunction}`);
        return transformFunction(body);
      } catch (error) {
        console.error('Input transformation function error:', error);
        return body;
      }
    } else {
      return body;
    }
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
