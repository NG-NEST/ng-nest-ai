// electron/ipc/services/openai.service.ts
import { ipcMain, IpcMainInvokeEvent, net } from 'electron';
import OpenAI from 'openai';
import { Stream } from 'openai/core/streaming';

interface SkillDefinition {
  name: string;
  description: string;
  parameters: any;
  execute: (args: any) => Promise<any>;
}

interface SkillFromDB {
  id?: number;
  name: string;
  displayName: string;
  description: string;
  status: 'active' | 'disabled';
  schema: {
    parameters: any;
    returns: any;
  };
  runtime: {
    type: 'builtin' | 'http' | 'javascript';
    handler?: string;
    code?: string;
    endpoint?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
  };
}

// 自定义 fetch 函数，使用 Electron 的 net 模块
function electronFetch(input: string | URL | Request, options?: RequestInit): Promise<Response> {
  let url = (input instanceof Request ? input.url : input).toString();

  let method = options?.method ?? 'GET';
  let headers = (options?.headers as Headers) ?? '';
  let body = options?.body ?? '';

  return new Promise((resolve, reject) => {
    const request = net.request({ method, url });

    // 设置请求头
    if (headers) {
      headers.forEach((value, key) => {
        request.setHeader(key, value);
      });
    }

    // 如果有请求体，写入 body
    if (body) {
      request.write(body as string);
    }

    // 处理响应
    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        try {
          // 使用 new Response 来构造响应对象
          const responseBody = new TextEncoder().encode(data); // 编码为 Uint8Array
          // 将响应头转换为 Headers 对象
          const responseHeaders = new Headers();
          for (const [key, value] of Object.entries(response.headers)) {
            responseHeaders.append(key, value as string); // 对于每个头部字段，添加到 Headers 对象中
          }
          // 构造一个完整的 Response 对象
          const electronResponse = new Response(responseBody, {
            status: response.statusCode,
            statusText: response.statusMessage,
            headers: responseHeaders
          });
          resolve(electronResponse); // 返回模拟的 Response
        } catch (err) {
          reject(new Error('Failed to parse response JSON'));
        }
      });
    });

    // 处理请求错误
    request.on('error', (err) => {
      reject(err);
    });

    request.end();
  });
}

export class OpenAIService {
  private openai: OpenAI | null = null;
  private openaiInstances: Map<string, OpenAI> = new Map(); // 使用 Map 存储多个实例，以 baseURL 作为键
  private activeStreams: Map<string, { cancel: boolean; abortController: AbortController }> = new Map();
  private skills: { [key: string]: SkillDefinition } = {};
  private tools: any[] = [];
  private mainWindow: Electron.BrowserWindow | null = null;

  constructor() {
    this.initMainWindow();
    this.initBuiltinSkills();
    this.registerIpcHandlers();
  }

  private initMainWindow() {
    // 获取主窗口引用
    const { BrowserWindow } = require('electron');
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      this.mainWindow = windows[0];
    }
  }

  private getOrCreateOpenAIInstance(apiKey: string, baseURL?: string): OpenAI {
    // 如果没有提供 baseURL，默认使用 OpenAI 官方地址
    const instanceKey = baseURL || 'default';

    // 如果实例已存在，直接返回
    if (this.openaiInstances.has(instanceKey)) {
      return this.openaiInstances.get(instanceKey)!;
    }

    // 创建新实例并存储
    const openai = new OpenAI({
      apiKey: apiKey.trim(),
      baseURL: baseURL?.trim(),
      fetch: electronFetch
    });

    this.openaiInstances.set(instanceKey, openai);
    return openai;
  }

  private initBuiltinSkills() {
    // 内置技能：获取时间
    const getTimeSkill: SkillDefinition = {
      name: 'get_time',
      description: '获取当前服务器时间',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      },
      execute: async () => {
        return {
          time: new Date().toISOString()
        };
      }
    };

    // 内置技能：查询 IndexedDB
    const queryIndexedDBSkill: SkillDefinition = {
      name: 'query_indexeddb',
      description: '查询前端 IndexedDB 数据库中的数据。支持查询 skills、sessions、messages、projects、prompts、manufacturers、models 等表。支持批量查询：传入 queries 数组可一次查询多个表。',
      parameters: {
        type: 'object',
        properties: {
          table: {
            type: 'string',
            description: '要查询的表名（单次查询时使用）',
            enum: ['skills', 'sessions', 'messages', 'projects', 'prompts', 'manufacturers', 'models']
          },
          operation: {
            type: 'string',
            description: '操作类型（单次查询时使用）：getAll-获取所有记录, getById-根据ID获取, query-自定义查询',
            enum: ['getAll', 'getById', 'query']
          },
          id: {
            type: 'number',
            description: '当 operation 为 getById 时，指定要查询的记录 ID'
          },
          filter: {
            type: 'object',
            description: '当 operation 为 query 时，自定义查询条件'
          },
          queries: {
            type: 'array',
            description: '批量查询：多个查询对象的数组，每个对象包含 table、operation、id（可选）、filter（可选）',
            items: {
              type: 'object',
              properties: {
                table: { type: 'string' },
                operation: { type: 'string' },
                id: { type: 'number' },
                filter: { type: 'object' }
              },
              required: ['table', 'operation']
            }
          }
        }
      },
      execute: async (args) => {
        // 支持批量查询
        if (args.queries && Array.isArray(args.queries)) {
          const results = [];
          for (const query of args.queries) {
            const result = await this.queryIndexedDB(query);
            results.push({
              table: query.table,
              operation: query.operation,
              result
            });
          }
          return results;
        }
        // 单次查询
        return await this.queryIndexedDB(args);
      }
    };

    this.skills[getTimeSkill.name] = getTimeSkill;
    this.skills[queryIndexedDBSkill.name] = queryIndexedDBSkill;
    this.updateTools();
  }

  // 查询 IndexedDB
  private async queryIndexedDB(args: any): Promise<any> {
    if (!this.mainWindow) {
      this.initMainWindow();
    }

    if (!this.mainWindow) {
      return {
        error: 'Main window not available'
      };
    }

    try {
      // 使用标准 IPC 通信机制
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          ipcMain.removeListener('ipc:openai:query-indexeddb-result', resultHandler);
          resolve({ error: 'Query timeout (5s)' });
        }, 5000);

        const resultHandler = (_event: any, response: any) => {
          clearTimeout(timeout);
          ipcMain.removeListener('ipc:openai:query-indexeddb-result', resultHandler);
          
          if (response.success) {
            resolve(response.data);
          } else {
            resolve({ error: response.error || 'Unknown error' });
          }
        };

        ipcMain.once('ipc:openai:query-indexeddb-result', resultHandler);
        
        // 发送查询请求到渲染进程
        this.mainWindow!.webContents.send('ipc:openai:query-indexeddb', args);
      });
    } catch (error) {
      console.error('Query IndexedDB error:', error);
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private updateTools() {
    this.tools = Object.values(this.skills).map((skill) => ({
      type: 'function',
      function: {
        name: skill.name,
        description: skill.description,
        parameters: skill.parameters
      }
    }));
  }

  // 检测字符串是否包含多个 JSON 对象
  private hasMultipleJsonObjects(str: string): boolean {
    try {
      // 尝试正常解析
      JSON.parse(str);
      return false;
    } catch (e) {
      // 如果解析失败，检查是否是多个 JSON 对象连在一起
      // 通过检查 '}' 后是否还有 '{' 来判断
      return /\}\s*\{/.test(str);
    }
  }

  // 解析第一个 JSON 对象
  private parseFirstJsonObject(str: string): any {
    let depth = 0;
    let inString = false;
    let escapeNext = false;
    
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }
      
      if (inString) {
        continue;
      }
      
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          // 找到第一个完整的 JSON 对象
          const firstJson = str.substring(0, i + 1);
          return JSON.parse(firstJson);
        }
      }
    }
    
    // 如果没找到完整的对象，抛出错误
    throw new Error('No complete JSON object found');
  }

  // 从数据库加载 skills
  async loadSkillsFromDB(dbSkills: SkillFromDB[]) {
    // 清除之前从数据库加载的 skills（保留内置 skills）
    const builtinSkills = ['get_time', 'query_indexeddb'];
    Object.keys(this.skills).forEach(key => {
      if (!builtinSkills.includes(key)) {
        delete this.skills[key];
      }
    });

    // 加载新的 skills
    for (const dbSkill of dbSkills) {
      if (dbSkill.status !== 'active') continue;

      let parameters = dbSkill.schema.parameters;
      
      // 如果 parameters 是字符串，解析为对象
      if (typeof parameters === 'string') {
        try {
          parameters = JSON.parse(parameters);
        } catch (error) {
          console.error(`Failed to parse parameters for skill ${dbSkill.name}:`, error);
          continue;
        }
      }

      const skill: SkillDefinition = {
        name: dbSkill.name,
        description: dbSkill.description,
        parameters: parameters,
        execute: this.createExecuteFunction(dbSkill)
      };

      this.skills[skill.name] = skill;
    }

    this.updateTools();
  }

  // 创建执行函数
  private createExecuteFunction(dbSkill: SkillFromDB): (args: any) => Promise<any> {
    return async (args: any) => {
      try {
        if (dbSkill.runtime.type === 'javascript' && dbSkill.runtime.code) {
          // 执行用户定义的 JavaScript 代码
          return await this.executeJavaScript(dbSkill.runtime.code, args);
        } else if (dbSkill.runtime.type === 'http') {
          // HTTP 调用
          return await this.executeHttp(dbSkill, args);
        } else if (dbSkill.runtime.type === 'builtin') {
          // 内置函数
          return await this.executeBuiltin(dbSkill, args);
        }
        
        return {
          error: `Unknown runtime type: ${dbSkill.runtime.type}`
        };
      } catch (error) {
        console.error(`Error executing skill ${dbSkill.name}:`, error);
        return {
          error: error instanceof Error ? error.message : String(error)
        };
      }
    };
  }

  // 执行 JavaScript 代码
  private async executeJavaScript(code: string, args: any): Promise<any> {
    try {
      // 使用 vm 模块创建安全的沙箱环境
      const vm = require('vm');
      const https = require('https');
      const http = require('http');
      
      // 简单的 fetch 实现
      const simpleFetch = (url: string, options: any = {}) => {
        return new Promise((resolve, reject) => {
          const urlObj = new URL(url);
          const protocol = urlObj.protocol === 'https:' ? https : http;
          
          const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {}
          };

          const req = protocol.request(requestOptions, (res: any) => {
            let data = '';
            res.on('data', (chunk: any) => data += chunk);
            res.on('end', () => {
              try {
                resolve({
                  ok: res.statusCode >= 200 && res.statusCode < 300,
                  status: res.statusCode,
                  json: async () => JSON.parse(data),
                  text: async () => data
                });
              } catch (error) {
                reject(error);
              }
            });
          });

          req.on('error', reject);
          
          if (options.body) {
            req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
          }
          
          req.end();
        });
      };
      
      // 创建上下文，提供必要的全局对象
      const context = {
        args,
        console: {
          log: (...args: any[]) => console.log('[Skill]', ...args),
          error: (...args: any[]) => console.error('[Skill]', ...args),
          warn: (...args: any[]) => console.warn('[Skill]', ...args)
        },
        // 提供一些常用的全局函数
        JSON,
        Date,
        Math,
        setTimeout,
        setInterval,
        clearTimeout,
        clearInterval,
        Promise,
        // 提供 fetch 用于 HTTP 请求
        fetch: simpleFetch
      };

      vm.createContext(context);

      // 包装代码，确保返回结果
      const wrappedCode = `
        (async () => {
          const execute = ${code};
          if (typeof execute === 'function') {
            return await execute(args);
          } else {
            return execute;
          }
        })();
      `;

      // 执行代码
      const result = await vm.runInContext(wrappedCode, context, {
        timeout: 30000, // 30秒超时
        displayErrors: true
      });

      return result;
    } catch (error) {
      console.error('JavaScript execution error:', error);
      throw error;
    }
  }

  // 执行 HTTP 调用
  private async executeHttp(dbSkill: SkillFromDB, args: any): Promise<any> {
    const https = require('https');
    const http = require('http');
    const { endpoint, method = 'POST', headers = {} } = dbSkill.runtime;

    if (!endpoint) {
      throw new Error('HTTP endpoint is required');
    }

    return new Promise((resolve, reject) => {
      try {
        const urlObj = new URL(endpoint);
        const protocol = urlObj.protocol === 'https:' ? https : http;
        
        const requestOptions = {
          hostname: urlObj.hostname,
          port: urlObj.port,
          path: urlObj.pathname + urlObj.search,
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers
          }
        };

        const req = protocol.request(requestOptions, (res: any) => {
          let data = '';
          res.on('data', (chunk: any) => data += chunk);
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (error) {
              resolve(data);
            }
          });
        });

        req.on('error', reject);
        
        if (method !== 'GET') {
          req.write(JSON.stringify(args));
        }
        
        req.end();
      } catch (error) {
        reject(new Error(`HTTP request failed: ${error}`));
      }
    });
  }

  // 执行内置函数
  private async executeBuiltin(dbSkill: SkillFromDB, args: any): Promise<any> {
    // 可以在这里实现一些内置的常用函数
    switch (dbSkill.name) {
      case 'get_time':
        return {
          time: new Date().toISOString(),
          timestamp: Date.now()
        };
      
      default:
        return {
          message: `Built-in skill ${dbSkill.name} executed with args: ${JSON.stringify(args)}`
        };
    }
  }

  private registerIpcHandlers() {
    // 加载 skills
    ipcMain.handle('ipc:openai:loadSkills', async (_event, skills: SkillFromDB[]) => {
      try {
        await this.loadSkillsFromDB(skills);
        return {
          success: true,
          count: Object.keys(this.skills).length
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message ?? String(error)
        };
      }
    });

    // 初始化 OpenAI 实例
    ipcMain.handle(
      'ipc:openai:initialize',
      async (_event, { apiKey, baseURL }: { apiKey: string; baseURL?: string }) => {
        try {
          if (!apiKey || typeof apiKey !== 'string') {
            return { success: false, error: 'Invalid API key' };
          }

          this.openai = this.getOrCreateOpenAIInstance(apiKey, baseURL);

          return {
            success: true
          };
        } catch (error: any) {
          this.openai = null;
          return {
            success: false,
            error: error.message ?? String(error)
          };
        }
      }
    );
    // 注册流式聊天完成处理程序
    ipcMain.handle(
      'ipc:openai:chatCompletionStream',
      async (event: IpcMainInvokeEvent, { model, messages, streamId, ...options }) => {
        const abortController = new AbortController();
        const streamControl = { cancel: false, abortController };
        this.activeStreams.set(streamId, streamControl);

        if (!this.openai) {
          event.sender.send('ipc:openai:chatCompletionStream:error', { streamId, error: 'OpenAI not initialized' });
          return;
        }

        try {
          let currentMessages = [...messages];
          const maxIterations = 10; // 最大函数调用次数，防止无限循环
          let iteration = 0;

          while (iteration < maxIterations) {
            if (streamControl.cancel) {
              break;
            }

            const stream = (await this.openai.chat.completions.create(
              {
                model,
                messages: currentMessages,
                tools: this.tools,
                tool_choice: 'auto',
                stream: true,
                ...options
              } as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
              { signal: abortController.signal }
            )) as Stream<OpenAI.Chat.Completions.ChatCompletionChunk> & {
              _request_id?: string | null;
            };

            let toolCallData: { id?: string; name?: string; arguments?: string } = {};
            let hasContent = false;

            for await (const chunk of stream) {
              // 检查是否需要取消
              if (streamControl.cancel) {
                break;
              }

              const delta = chunk.choices[0]?.delta;

              // 收集 tool_calls 数据
              if (delta?.tool_calls?.[0]) {
                const toolCall = delta.tool_calls[0];
                if (toolCall.id) {
                  toolCallData.id = toolCall.id;
                }
                if (toolCall.function?.name) {
                  toolCallData.name = toolCall.function.name;
                }
                if (toolCall.function?.arguments) {
                  toolCallData.arguments = (toolCallData.arguments || '') + toolCall.function.arguments;
                }
              }

              // 检查是否有内容输出
              if (delta?.content) {
                hasContent = true;
              }

              // 如果没有 tool_calls，正常发送数据到渲染进程
              if (!delta?.tool_calls) {
                event.sender.send('ipc:openai:chatCompletionStream:stream', {
                  streamId,
                  data: chunk
                });
              }
            }

            // 如果有完整的 tool call，执行对应的 skill
            if (toolCallData.name && this.skills[toolCallData.name]) {
              try {
                // 输出调试信息
                console.log('Tool call received:', {
                  name: toolCallData.name,
                  id: toolCallData.id,
                  argumentsLength: toolCallData.arguments?.length || 0,
                  argumentsPreview: toolCallData.arguments?.substring(0, 100)
                });
                
                // 安全解析 arguments
                let args = {};
                if (toolCallData.arguments) {
                  try {
                    // 验证 JSON 字符串的完整性
                    const trimmed = toolCallData.arguments.trim();
                    if (!trimmed) {
                      console.warn('Empty tool call arguments, using default {}');
                      args = {};
                    } else {
                      // 检测是否有多个 JSON 对象（AI 错误返回多个查询）
                      if (this.hasMultipleJsonObjects(trimmed)) {
                        console.warn('Detected multiple JSON objects, parsing first one only');
                        // 解析第一个完整的 JSON 对象
                        args = this.parseFirstJsonObject(trimmed);
                        console.log('Parsed first JSON object:', args);
                      } else {
                        args = JSON.parse(trimmed);
                        console.log('Successfully parsed arguments:', args);
                      }
                    }
                  } catch (parseError) {
                    console.error('Failed to parse tool call arguments:', {
                      name: toolCallData.name,
                      rawArguments: toolCallData.arguments,
                      argumentsLength: toolCallData.arguments.length,
                      error: parseError
                    });
                    // 如果解析失败，发送错误信息
                    event.sender.send('ipc:openai:chatCompletionStream:error', {
                      streamId,
                      error: `Invalid tool call arguments for ${toolCallData.name}: ${parseError instanceof Error ? parseError.message : String(parseError)}\nReceived: ${toolCallData.arguments}`
                    });
                    this.activeStreams.delete(streamId);
                    return;
                  }
                }
                
                // 发送"正在执行技能"的提示到前端
                let skillDisplayName = `正在执行技能: ${toolCallData.name}`;
                
                // 特殊处理 query_indexeddb
                if (toolCallData.name === 'query_indexeddb') {
                  if ((args as any).queries && Array.isArray((args as any).queries)) {
                    skillDisplayName = `正在查询 ${(args as any).queries.length} 个表: ${(args as any).queries.map((q: any) => q.table).join(', ')}`;
                  } else if ((args as any).table) {
                    skillDisplayName = `正在查询表: ${(args as any).table}`;
                  } else {
                    skillDisplayName = '正在查询数据库';
                  }
                }
                
                event.sender.send('ipc:openai:chatCompletionStream:stream', {
                  streamId,
                  data: {
                    choices: [{
                      delta: { content: `\n\n🔧 ${skillDisplayName}...\n\n` },
                      index: 0,
                      finish_reason: null
                    }]
                  }
                });
                
                const skill = this.skills[toolCallData.name];
                const result = await skill.execute(args);
                
                // 发送执行完成的提示
                let resultPreview = '';
                if (toolCallData.name === 'query_indexeddb') {
                  if (Array.isArray(result)) {
                    if (result.length > 0 && result[0].table) {
                      // 批量查询结果
                      const summary = result.map((r: any) => {
                        const count = Array.isArray(r.result) ? r.result.length : 1;
                        return `${r.table}: ${count} 条`;
                      }).join(', ');
                      resultPreview = `(${summary})`;
                    } else {
                      // 单次查询结果
                      resultPreview = `(${result.length} 条记录)`;
                    }
                  }
                } else if (typeof result === 'object') {
                  resultPreview = Array.isArray(result) ? `(${result.length} 条记录)` : '(完成)';
                }
                
                event.sender.send('ipc:openai:chatCompletionStream:stream', {
                  streamId,
                  data: {
                    choices: [{
                      delta: { content: `✅ 执行完成 ${resultPreview}\n\n` },
                      index: 0,
                      finish_reason: null
                    }]
                  }
                });

                // 将 tool call 和结果添加到消息历史
                currentMessages = [
                  ...currentMessages,
                  {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                      {
                        id: toolCallData.id || 'call_' + Date.now(),
                        type: 'function',
                        function: {
                          name: toolCallData.name,
                          arguments: toolCallData.arguments || '{}'
                        }
                      }
                    ]
                  },
                  {
                    role: 'tool',
                    tool_call_id: toolCallData.id || 'call_' + Date.now(),
                    content: JSON.stringify(result)
                  }
                ];

                // 继续下一轮循环，让 AI 处理函数结果
                iteration++;
                continue;
              } catch (error) {
                event.sender.send('ipc:openai:chatCompletionStream:error', {
                  streamId,
                  error: error instanceof Error ? error.message : String(error)
                });
                this.activeStreams.delete(streamId);
                return;
              }
            }

            // 如果没有 tool call 或有内容输出，说明对话已完成
            if (!toolCallData.name || hasContent) {
              break;
            }

            iteration++;
          }

          // 发送结束信号
          event.sender.send('ipc:openai:chatCompletionStream:stream', {
            streamId,
            done: true
          });

          this.activeStreams.delete(streamId);
        } catch (error) {
          event.sender.send('ipc:openai:chatCompletionStream:error', {
            streamId,
            error: error instanceof Error ? error.message : String(error)
          });
          this.activeStreams.delete(streamId);
        }
      }
    );

    // 注册取消流式请求处理程序
    ipcMain.handle('ipc:openai:chatCompletionStream:cancel', (_event: IpcMainInvokeEvent, streamId: string) => {
      const stream = this.activeStreams.get(streamId);
      if (stream) {
        stream.cancel = true;
        // 强制终止请求
        if (stream.abortController) {
          stream.abortController.abort();
        }
      }
    });
  }

  // 销毁服务时清理资源
  destroy() {
    this.activeStreams.forEach((stream) => {
      stream.cancel = true;
    });
    this.activeStreams.clear();
  }
}
