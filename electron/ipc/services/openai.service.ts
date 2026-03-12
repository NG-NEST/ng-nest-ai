// electron/ipc/services/openai.service.ts
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import OpenAI from 'openai';
import { Stream } from 'openai/core/streaming';
import { loadBuiltinSkills, SkillDefinition, SkillContext } from '../../skills/builtin';
import { MarkdownSkillLoader } from '../../skills/markdown/loader';
import { executeSandboxedJavaScript } from '../../skills/vm-executor';
import * as path from 'path';
import * as fs from 'fs';
import * as chokidar from 'chokidar';
import { HttpClient, HttpRequestOptions, HttpResponse, httpClient } from '../../utils/http-client';

// 定义 SkillFromDB 接口
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
    type: 'builtin' | 'http' | 'javascript' | 'markdown';
    handler?: string;
    code?: string;
    endpoint?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: string; // JSON string for headers
    content?: string; // Markdown content
    instructions?: string; // Usage instructions
  };
}

// 批量大小常量，用于背压控制
const BATCH_SIZE = 10;

// 将 HttpClient 适配为 OpenAI SDK 所需的 fetch 函数格式
async function electronFetch(input: string | URL | Request, options?: RequestInit): Promise<Response> {
  const url = (input instanceof Request ? input.url : input).toString();
  const method = options?.method ?? 'GET';
  const headers = options?.headers
    ? options.headers instanceof Headers
      ? Object.fromEntries(options.headers.entries())
      : (options.headers as Record<string, string>)
    : {};
  const body = options?.body;

  // 将 RequestInit 转换为 HttpRequestOptions
  const httpRequestOptions: HttpRequestOptions = {
    method: method as any,
    headers,
    body: body ? (typeof body === 'string' ? body : body.toString()) : undefined
  };

  try {
    const response: HttpResponse = await httpClient.request(url, httpRequestOptions);

    // 将 HttpResponse 转换为标准的 Response 对象
    const responseHeaders = new Headers();
    for (const [key, value] of Object.entries(response.headers)) {
      responseHeaders.append(key, value);
    }

    return new Response(response.rawText, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    throw new Error(`Network request failed: ${error}`);
  }
}

export class OpenAIService {
  private openai: OpenAI | null = null;
  private openaiInstances: Map<string, OpenAI> = new Map(); // 使用 Map 存储多个实例，以 baseURL 作为键
  private activeStreams: Map<string, { cancel: boolean; abortController: AbortController }> = new Map();
  private skills: { [key: string]: SkillDefinition } = {};
  private builtinSkillsCache: Map<string, SkillDefinition> = new Map();
  private customMarkdownSkillsCache: Map<string, SkillDefinition> = new Map();
  private dbSkillNamesCache: Set<string> = new Set();
  private dbSkillDisplayName: Map<string, string> = new Map();
  private tools: any[] = [];
  private mainWindow: Electron.BrowserWindow | null = null;
  private skillContext: SkillContext = {};
  private skillWatcher: chokidar.FSWatcher | null = null;
  private encryptedApiKey: string | null = null; // 存储加密的 API Key

  constructor() {
    this.initMainWindow();
    this.initSkillContext();
    this.initBuiltinSkills();
    this.registerIpcHandlers();
  }

  /**
   * 使用加密存储存储 API Key
   */
  private async storeEncryptedKey(apiKey: string): Promise<void> {
    try {
      // 使用 safeStorage 加密 API Key
      const { safeStorage } = require('electron');
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('Encryption is not available on this system');
      }

      const encryptedBuffer = safeStorage.encryptString(apiKey);
      this.encryptedApiKey = encryptedBuffer.toString('base64');
    } catch (error) {
      console.error('Failed to encrypt API key:', error);
      throw new Error('Encryption failed: ' + (error as Error).message);
    }
  }

  /**
   * 从加密存储中获取 API Key
   */
  private async getDecryptedApiKey(): Promise<string | null> {
    if (!this.encryptedApiKey) {
      return null;
    }

    try {
      const { safeStorage } = require('electron');
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('Encryption is not available on this system');
      }

      const buffer = Buffer.from(this.encryptedApiKey, 'base64');
      const decrypted = safeStorage.decryptString(buffer);
      return decrypted;
    } catch (error) {
      console.error('Failed to decrypt API key:', error);
      throw new Error('Decryption failed: ' + (error as Error).message);
    }
  }

  private initMainWindow() {
    // 获取主窗口引用
    const { BrowserWindow } = require('electron');
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      this.mainWindow = windows[0];
    }
  }

  private initSkillContext() {
    this.skillContext = {
      mainWindow: this.mainWindow || undefined,
      ipcMain: ipcMain
    };
  }

  private async initBuiltinSkills() {
    try {
      // 1. 加载 TypeScript 内置技能
      const builtinSkills = await loadBuiltinSkills();
      for (const skill of builtinSkills) {
        this.skills[skill.name] = skill;
        this.builtinSkillsCache.set(skill.name, skill);
      }

      // 2. 加载 Markdown 自定义技能 (OpenClaw style)
      // 尝试在几个可能的位置查找
      const possibleDirs = [
        path.join(process.cwd(), 'electron/skills/custom'), // 开发环境/根目录
        path.join(__dirname, '../../skills/custom'), // 相对路径
        path.join(process.resourcesPath, 'skills/custom') // 打包后的资源路径
      ];

      let customSkillsDir = '';
      for (const dir of possibleDirs) {
        if (fs.existsSync(dir)) {
          customSkillsDir = dir;
          console.log(`Loading custom skills from: ${dir}`);
          this.loadCustomSkills(dir);
          break;
        }
      }

      // 3. 启动热重载监听
      if (customSkillsDir) {
        this.watchCustomSkills(customSkillsDir);
      }

      this.updateTools();
      console.log(`Initialized skills. Total: ${Object.keys(this.skills).length}`);
    } catch (error) {
      console.error('Failed to initialize skills:', error);
    }
  }

  private loadCustomSkills(dir: string) {
    const customSkills = MarkdownSkillLoader.loadSkillsFromDir(dir);
    let loadedCount = 0;
    this.customMarkdownSkillsCache.clear();
    for (const skill of customSkills) {
      this.customMarkdownSkillsCache.set(skill.name, skill);
      // 避免覆盖已有的内置技能
      if (!this.builtinSkillsCache.has(skill.name) && !this.dbSkillNamesCache.has(skill.name)) {
        this.skills[skill.name] = skill;
        loadedCount++;
      }
    }
    if (loadedCount > 0) {
      console.log(`Loaded ${loadedCount} custom markdown skills from ${dir}`);
    }
  }

  private watchCustomSkills(dir: string) {
    console.log(`Starting hot-reload watcher for skills in: ${dir}`);

    // 关闭已存在的 watcher
    if (this.skillWatcher) {
      this.skillWatcher.close();
    }

    this.skillWatcher = chokidar.watch(path.join(dir, '*.md'), {
      ignoreInitial: true,
      depth: 0
    });

    const reloadSkill = (filePath: string) => {
      console.log(`Skill file changed: ${filePath}`);
      const skill = MarkdownSkillLoader.loadSkill(filePath);
      if (skill) {
        // 如果不是内置技能，则更新
        this.customMarkdownSkillsCache.set(skill.name, skill);
        if (!this.builtinSkillsCache.has(skill.name) && !this.dbSkillNamesCache.has(skill.name)) {
          this.skills[skill.name] = skill;
          this.updateTools();
          console.log(`Hot-reloaded skill: ${skill.name}`);

          // 通知前端（可选，如果需要实时更新 UI）
          if (this.mainWindow) {
            this.mainWindow.webContents.send('ipc:skills:updated', {
              name: skill.name,
              action: 'update'
            });
          }
        } else {
          console.warn(`Skipping reload for builtin skill conflict: ${skill.name}`);
        }
      }
    };

    const removeSkill = (filePath: string) => {
      // 由于我们不知道文件名对应的 skill name，这里比较麻烦
      // 简单的做法是重新加载整个目录，或者在加载时建立 file -> skill name 的映射
      // 为了简单起见，这里重新加载所有自定义技能
      console.log(`Skill file removed: ${filePath}`);
      const customNames = Array.from(this.customMarkdownSkillsCache.keys());
      customNames.forEach((name) => {
        if (!this.dbSkillNamesCache.has(name)) {
          delete this.skills[name];
        }
      });
      // 重新加载
      this.loadCustomSkills(dir);
      this.updateTools();
    };

    this.skillWatcher.on('add', reloadSkill).on('change', reloadSkill).on('unlink', removeSkill);
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
    // 获取内置技能名称列表 (从缓存获取)
    const builtinSkillNames = Array.from(this.builtinSkillsCache.keys());

    // 清除之前从数据库加载的 skills（保留内置 skills）
    Object.keys(this.skills).forEach((key) => {
      if (!builtinSkillNames.includes(key)) {
        delete this.skills[key];
      }
    });

    // 加载新的 skills
    this.dbSkillNamesCache = new Set();
    this.dbSkillDisplayName.clear();
    for (const dbSkill of dbSkills) {
      if (dbSkill.status !== 'active') continue;
      this.dbSkillNamesCache.add(dbSkill.name);
      if (dbSkill.displayName) {
        this.dbSkillDisplayName.set(dbSkill.name, dbSkill.displayName);
      }

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

      // 确定执行函数
      let executeFunc: (args: any, context?: SkillContext) => Promise<any>;

      // 如果是内置技能，优先使用本地缓存的执行逻辑
      if (dbSkill.runtime.type === 'builtin' && this.builtinSkillsCache.has(dbSkill.name)) {
        const cachedSkill = this.builtinSkillsCache.get(dbSkill.name)!;
        executeFunc = cachedSkill.execute;
        console.log(`Using native execution logic for builtin skill: ${dbSkill.name}`);
      } else {
        executeFunc = this.createExecuteFunction(dbSkill);
      }

      const skill: SkillDefinition = {
        name: dbSkill.name,
        displayName: dbSkill.displayName,
        description: dbSkill.description,
        parameters: parameters,
        execute: executeFunc
      };

      this.skills[skill.name] = skill;
    }

    for (const [name, skill] of this.customMarkdownSkillsCache.entries()) {
      if (!this.builtinSkillsCache.has(name) && !this.dbSkillNamesCache.has(name)) {
        this.skills[name] = skill;
      }
    }

    this.updateTools();
  }

  // 创建执行函数
  private createExecuteFunction(dbSkill: SkillFromDB): (args: any) => Promise<any> {
    return async (args: any, context?: SkillContext) => {
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
        } else if (dbSkill.runtime.type === 'markdown') {
          // Markdown 文档技能
          return await this.executeMarkdown(dbSkill, args);
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
    // 使用统一的沙箱执行器
    return await executeSandboxedJavaScript(code, args);
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

        // 解析 headers，支持字符串和对象格式
        let parsedHeaders: Record<string, string> = {
          'Content-Type': 'application/json'
        };

        if (headers) {
          if (typeof headers === 'string') {
            try {
              const headerObj = JSON.parse(headers);
              parsedHeaders = { ...parsedHeaders, ...headerObj };
            } catch (error) {
              console.warn('Failed to parse headers JSON, using default headers:', error);
            }
          } else if (typeof headers === 'object') {
            parsedHeaders = { ...parsedHeaders, ...headers };
          }
        }

        const requestOptions = {
          hostname: urlObj.hostname,
          port: urlObj.port,
          path: urlObj.pathname + urlObj.search,
          method,
          headers: parsedHeaders,
          timeout: 30000 // 30 seconds timeout
        };

        console.log(`Making HTTP request to ${endpoint}:`, {
          method,
          headers: parsedHeaders,
          args
        });

        const req = protocol.request(requestOptions, (res: any) => {
          let data = '';
          res.on('data', (chunk: any) => (data += chunk));
          res.on('end', () => {
            console.log(`HTTP response from ${endpoint}:`, {
              statusCode: res.statusCode,
              headers: res.headers,
              dataLength: data.length
            });

            // 检查响应状态码
            if (res.statusCode >= 400) {
              reject(new Error(`HTTP ${res.statusCode}: ${data || res.statusMessage}`));
              return;
            }

            try {
              // 尝试解析 JSON 响应
              const jsonData = JSON.parse(data);
              resolve(jsonData);
            } catch (error) {
              // 如果不是 JSON，返回原始文本
              resolve({
                success: true,
                data: data,
                contentType: res.headers['content-type'] || 'text/plain'
              });
            }
          });
        });

        req.on('error', (error: any) => {
          console.error(`HTTP request error for ${endpoint}:`, error);
          reject(new Error(`HTTP request failed: ${error.message}`));
        });

        req.on('timeout', () => {
          req.destroy();
          reject(new Error('HTTP request timeout'));
        });

        // 发送请求体（对于 GET 请求，不发送 body）
        if (method !== 'GET') {
          const requestBody = JSON.stringify({ args });
          req.write(requestBody);
        }

        req.end();
      } catch (error) {
        console.error(`HTTP request setup error for ${endpoint}:`, error);
        reject(new Error(`HTTP request setup failed: ${error instanceof Error ? error.message : String(error)}`));
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

  // 执行 Markdown 文档技能
  private async executeMarkdown(dbSkill: SkillFromDB, args: any): Promise<any> {
    try {
      const content = dbSkill.runtime.content || '';
      const instructions = dbSkill.runtime.instructions || '';

      // Markdown 技能不执行代码，而是返回文档内容和使用说明
      // 这些信息将被添加到 AI 的上下文中，用于指导响应
      return {
        type: 'markdown_knowledge',
        skill_name: dbSkill.name,
        display_name: dbSkill.displayName,
        description: dbSkill.description,
        content: content,
        instructions: instructions,
        parameters: args,
        message: `Applied knowledge from ${dbSkill.displayName}`,
        // 返回格式化的知识内容，供 AI 参考
        knowledge: {
          title: dbSkill.displayName,
          description: dbSkill.description,
          content: content,
          usage_instructions: instructions,
          applied_with_parameters: args
        }
      };
    } catch (error) {
      console.error(`Error processing markdown skill ${dbSkill.name}:`, error);
      return {
        error: `Failed to process markdown skill: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  // 格式化结果为 Markdown
  private formatResultToMarkdown(result: any): string {
    if (result === null || result === undefined) {
      return 'null';
    }

    if (typeof result === 'string') {
      return result;
    }

    if (Array.isArray(result)) {
      if (result.length === 0) {
        return '[](Empty List)';
      }

      // 检查是否为对象数组（且不包含 null 或数组）
      const isArrayOfObjects = result.every(
        (item) => typeof item === 'object' && item !== null && !Array.isArray(item)
      );

      if (isArrayOfObjects) {
        // 收集所有对象的键，以处理可选字段
        const allKeys = new Set<string>();
        result.forEach((item) => Object.keys(item).forEach((k) => allKeys.add(k)));
        const keys = Array.from(allKeys);

        if (keys.length > 0) {
          // 构建 Markdown 表格
          const header = `| ${keys.join(' | ')} |`;
          const separator = `| ${keys.map(() => '---').join(' | ')} |`;
          const rows = result.map((item) => {
            return `| ${keys
              .map((key) => {
                const val = (item as any)[key];
                if (val === undefined || val === null) return '';
                if (typeof val === 'object') return JSON.stringify(val);
                // 转义换行符和管道符，防止破坏表格格式
                return String(val).replace(/\n/g, '<br>').replace(/\|/g, '\\|');
              })
              .join(' | ')} |`;
          });

          return `\n${header}\n${separator}\n${rows.join('\n')}\n`;
        }
      }

      // 简单数组或混合类型
      return result.map((item) => `- ${typeof item === 'object' ? JSON.stringify(item) : String(item)}`).join('\n');
    }

    // 默认对象格式化
    try {
      return JSON.stringify(result, null, 2);
    } catch {
      return String(result);
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

          // 加密存储 API Key
          await this.storeEncryptedKey(apiKey);

          // 使用解密后的 API Key 创建实例
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
      async (event: IpcMainInvokeEvent, { model, messages, streamId, workspace, ...options }) => {
        const abortController = new AbortController();
        const streamControl = { cancel: false, abortController };
        this.activeStreams.set(streamId, streamControl);

        if (!this.openai) {
          event.sender.send('ipc:openai:chatCompletionStream:error', { streamId, error: 'OpenAI not initialized' });
          return;
        }

        try {
          let currentMessages = [...messages];

          // 如果提供了工作区路径，将其作为系统消息添加到对话中
          if (workspace) {
            currentMessages.unshift({
              role: 'system',
              content: `Current working directory (cwd): ${workspace}. When performing file operations, assume this is the root context.`
            });
          }

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

                const skill = this.skills[toolCallData.name];
                const displayName =
                  skill?.displayName || this.dbSkillDisplayName.get(toolCallData.name) || toolCallData.name;
                let skillDisplayName = `正在执行技能: ${displayName}`;

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

                const argsText = (() => {
                  try {
                    return JSON.stringify(args ?? {}, null, 2);
                  } catch {
                    return String(args);
                  }
                })();
                const argsSection = `\n<details><summary>参数</summary>\n\n\`\`\`json\n${argsText}\n\`\`\`\n\n</details>\n`;
                event.sender.send('ipc:openai:chatCompletionStream:stream', {
                  streamId,
                  data: {
                    choices: [
                      {
                        delta: {
                          content: `\n\n🔧 ${skillDisplayName}...\n${argsSection}\n`
                        },
                        index: 0,
                        finish_reason: null
                      }
                    ]
                  }
                });

                const requestContext = { ...this.skillContext, workspace };
                const result = await skill.execute(args, requestContext);

                // 发送执行完成的提示
                let resultPreview = '';
                if (toolCallData.name === 'query_indexeddb') {
                  if (Array.isArray(result)) {
                    if (result.length > 0 && result[0].table) {
                      // 批量查询结果
                      const summary = result
                        .map((r: any) => {
                          const count = Array.isArray(r.result) ? r.result.length : 1;
                          return `${r.table}: ${count} 条`;
                        })
                        .join(', ');
                      resultPreview = `(${summary})`;
                    } else {
                      // 单次查询结果
                      resultPreview = `(${result.length} 条记录)`;
                    }
                  }
                } else if (typeof result === 'object') {
                  resultPreview = Array.isArray(result) ? `(${result.length} 条记录)` : '(完成)';
                }

                const resultText = this.formatResultToMarkdown(result);
                const resultSection = `\n<details><summary>返回值</summary>\n\n\`\`\`json\n${resultText}\n\`\`\`\n\n</details>\n`;
                event.sender.send('ipc:openai:chatCompletionStream:stream', {
                  streamId,
                  data: {
                    choices: [
                      {
                        delta: { content: `✅ 执行完成 ${resultPreview}\n${resultSection}\n` },
                        index: 0,
                        finish_reason: null
                      }
                    ]
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
    // 清理活动流
    this.activeStreams.forEach((stream) => {
      stream.cancel = true;
    });
    this.activeStreams.clear();

    // 关闭文件监视器
    if (this.skillWatcher) {
      this.skillWatcher.close();
      this.skillWatcher = null;
    }

    // 清理加密的 API Key
    this.encryptedApiKey = null;
  }
}
