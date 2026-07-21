import { IpcMainInvokeEvent } from 'electron';
import OpenAI from 'openai';
import { Stream } from 'openai/core/streaming';
import { loadBuiltinSkills, SkillDefinition, SkillContext } from '../../skills/builtin';
import { MarkdownSkillLoader } from '../../skills/markdown/loader';
import { executeSandboxedJavaScript } from '../../skills/vm-executor';
import * as path from 'path';
import * as fs from 'fs';
import * as chokidar from 'chokidar';
import { httpClient, HttpResponse } from '../../utils/http-client';

interface SkillFromDB {
  id?: number;
  name: string;
  displayName: string;
  description: string;
  status: 'active' | 'disabled';
  schema: { parameters: any; returns: any };
  runtime: {
    type: 'builtin' | 'http' | 'javascript' | 'markdown';
    handler?: string;
    code?: string;
    endpoint?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: string;
    content?: string;
    instructions?: string;
  };
}

async function electronFetch(input: string | URL | Request, options?: RequestInit): Promise<Response> {
  const url = (input instanceof Request ? input.url : input).toString();
  const method = options?.method ?? 'GET';
  const headers = options?.headers instanceof Headers
    ? Object.fromEntries(options.headers.entries())
    : (options?.headers as Record<string, string>) ?? {};
  const body = options?.body;
  try {
    const response: HttpResponse = await httpClient.request(url, { method: method as any, headers, body: body ? (typeof body === 'string' ? body : body.toString()) : undefined });
    const rh = new Headers();
    for (const [k, v] of Object.entries(response.headers)) rh.append(k, v);
    return new Response(response.rawText, { status: response.status, statusText: response.statusText, headers: rh });
  } catch (error) {
    throw new Error(`Network request failed: ${error}`);
  }
}

export class OpenAIService {
  private openaiInstances: Map<string, OpenAI> = new Map();
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
  private encryptedApiKey: string | null = null;

  constructor() {
    this._initMainWindow();
    this._initSkillContext();
    this._initBuiltinSkills();
  }

  /* ── Public IPC methods ── */

  async initialize(params: { apiKey: string; baseURL?: string }) {
    try {
      if (!params.apiKey || typeof params.apiKey !== 'string') return { success: false, error: 'Invalid API key' };
      await this._storeEncryptedKey(params.apiKey);
      this._getOrCreateOpenAIInstance(params.apiKey, params.baseURL);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message ?? String(error) };
    }
  }

  async loadSkills(skills: SkillFromDB[]) {
    try {
      await this._loadSkillsFromDB(skills);
      return { success: true, count: Object.keys(this.skills).length };
    } catch (error: any) {
      return { success: false, error: error.message ?? String(error) };
    }
  }

  async chatCompletionStream(event: IpcMainInvokeEvent, options: any) {
    const { model, messages, streamId, workspace, ...rest } = options;
    const abortController = new AbortController();
    const streamControl = { cancel: false, abortController };
    this.activeStreams.set(streamId, streamControl);

    if (!this.openaiInstances.size) {
      event.sender.send('ipc:openai:chatCompletionStream:error', { streamId, error: 'OpenAI not initialized' });
      return;
    }

    try {
      let currentMessages = [...messages];
      if (workspace) currentMessages.unshift({ role: 'system', content: `Current working directory (cwd): ${workspace}. When performing file operations, assume this is the root context.` });

      const maxIterations = 10;
      let iteration = 0;

      while (iteration < maxIterations) {
        if (streamControl.cancel) break;

        const firstInstance = this.openaiInstances.values().next().value;
        if (!firstInstance) break;

        const stream = await firstInstance.chat.completions.create(
          { model, messages: currentMessages, tools: this.tools, tool_choice: 'auto', stream: true, ...rest } as any,
          { signal: abortController.signal }
        ) as unknown as Stream<any>;

        let toolCallData: { id?: string; name?: string; arguments?: string } = {};
        let hasContent = false;

        for await (const chunk of stream) {
          if (streamControl.cancel) break;
          const delta = chunk.choices[0]?.delta;
          if (delta?.tool_calls?.[0]) {
            const tc = delta.tool_calls[0];
            if (tc.id) toolCallData.id = tc.id;
            if (tc.function?.name) toolCallData.name = tc.function.name;
            if (tc.function?.arguments) toolCallData.arguments = (toolCallData.arguments || '') + tc.function.arguments;
          }
          if (delta?.content) hasContent = true;
          if (!delta?.tool_calls) event.sender.send('ipc:openai:chatCompletionStream:stream', { streamId, data: chunk });
        }

        if (toolCallData.name && this.skills[toolCallData.name]) {
          try {
            let args: any = {};
            if (toolCallData.arguments) {
              const trimmed = toolCallData.arguments.trim();
              if (trimmed) args = this._hasMultipleJsonObjects(trimmed) ? this._parseFirstJsonObject(trimmed) : JSON.parse(trimmed);
            }

            const skill = this.skills[toolCallData.name];
            const displayName = skill?.displayName || this.dbSkillDisplayName.get(toolCallData.name) || toolCallData.name;
            let skillDisplayName = `正在执行技能: ${displayName}`;
            if (toolCallData.name === 'query_indexeddb') {
              if (args.queries && Array.isArray(args.queries)) skillDisplayName = `正在查询 ${args.queries.length} 个表: ${args.queries.map((q: any) => q.table).join(', ')}`;
              else if (args.table) skillDisplayName = `正在查询表: ${args.table}`;
              else skillDisplayName = '正在查询数据库';
            }

            event.sender.send('ipc:openai:chatCompletionStream:stream', {
              streamId, data: { choices: [{ delta: { content: `\n\n🔧 ${skillDisplayName}...\n\n<details><summary>参数</summary>\n\n\`\`\`json\n${(() => { try { return JSON.stringify(args ?? {}, null, 2); } catch { return String(args); } })()}\n\`\`\`\n\n</details>\n` }, index: 0, finish_reason: null }] }
            });

            const requestContext = { ...this.skillContext, workspace };
            const result = await skill.execute(args, requestContext);

            let resultPreview = '';
            if (toolCallData.name === 'query_indexeddb') {
              if (Array.isArray(result)) resultPreview = result.length > 0 && result[0].table ? `(${result.map((r: any) => `${r.table}: ${Array.isArray(r.result) ? r.result.length : 1} 条`).join(', ')})` : `(${result.length} 条记录)`;
            } else if (typeof result === 'object') resultPreview = Array.isArray(result) ? `(${result.length} 条记录)` : '(完成)';

            const resultText = this._formatResultToMarkdown(result);
            event.sender.send('ipc:openai:chatCompletionStream:stream', {
              streamId, data: { choices: [{ delta: { content: `✅ 执行完成 ${resultPreview}\n\n<details><summary>返回值</summary>\n\n\`\`\`json\n${resultText}\n\`\`\`\n\n</details>\n` }, index: 0, finish_reason: null }] }
            });

            currentMessages = [...currentMessages,
              { role: 'assistant', content: null, tool_calls: [{ id: toolCallData.id || 'call_' + Date.now(), type: 'function', function: { name: toolCallData.name, arguments: toolCallData.arguments || '{}' } }] },
              { role: 'tool', tool_call_id: toolCallData.id || 'call_' + Date.now(), content: JSON.stringify(result) }
            ];
            iteration++;
            continue;
          } catch (error) {
            event.sender.send('ipc:openai:chatCompletionStream:error', { streamId, error: error instanceof Error ? error.message : String(error) });
            this.activeStreams.delete(streamId);
            return;
          }
        }

        if (!toolCallData.name || hasContent) break;
        iteration++;
      }

      event.sender.send('ipc:openai:chatCompletionStream:stream', { streamId, done: true });
      this.activeStreams.delete(streamId);
    } catch (error) {
      event.sender.send('ipc:openai:chatCompletionStream:error', { streamId, error: error instanceof Error ? error.message : String(error) });
      this.activeStreams.delete(streamId);
    }
  }

  chatCompletionStreamCancel(streamId: string) {
    const stream = this.activeStreams.get(streamId);
    if (stream) {
      stream.cancel = true;
      stream.abortController.abort();
    }
  }

  destroy() {
    this.activeStreams.forEach((s) => s.cancel = true);
    this.activeStreams.clear();
    if (this.skillWatcher) { this.skillWatcher.close(); this.skillWatcher = null; }
    this.encryptedApiKey = null;
  }

  /* ── Internal methods ── */

  private async _storeEncryptedKey(apiKey: string): Promise<void> {
    const { safeStorage } = require('electron');
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Encryption is not available on this system');
    this.encryptedApiKey = safeStorage.encryptString(apiKey).toString('base64');
  }

  private _initMainWindow() {
    const { BrowserWindow } = require('electron');
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) this.mainWindow = windows[0];
  }

  private _initSkillContext() {
    this.skillContext = { mainWindow: this.mainWindow || undefined };
  }

  private async _initBuiltinSkills() {
    try {
      const builtinSkills = await loadBuiltinSkills();
      for (const skill of builtinSkills) { this.skills[skill.name] = skill; this.builtinSkillsCache.set(skill.name, skill); }

      const dirs = [path.join(process.cwd(), 'electron/skills/custom'), path.join(__dirname, '../../skills/custom'), path.join(process.resourcesPath, 'skills/custom')];
      for (const dir of dirs) {
        if (fs.existsSync(dir)) { this._loadCustomSkills(dir); this._watchCustomSkills(dir); break; }
      }

      this._updateTools();
      console.log(`Initialized skills. Total: ${Object.keys(this.skills).length}`);
    } catch (error) { console.error('Failed to initialize skills:', error); }
  }

  private _loadCustomSkills(dir: string) {
    const customSkills = MarkdownSkillLoader.loadSkillsFromDir(dir);
    let loadedCount = 0;
    this.customMarkdownSkillsCache.clear();
    for (const skill of customSkills) {
      this.customMarkdownSkillsCache.set(skill.name, skill);
      if (!this.builtinSkillsCache.has(skill.name) && !this.dbSkillNamesCache.has(skill.name)) { this.skills[skill.name] = skill; loadedCount++; }
    }
    if (loadedCount > 0) console.log(`Loaded ${loadedCount} custom markdown skills from ${dir}`);
  }

  private _watchCustomSkills(dir: string) {
    if (this.skillWatcher) this.skillWatcher.close();
    this.skillWatcher = chokidar.watch(path.join(dir, '*.md'), { ignoreInitial: true, depth: 0 });
    this.skillWatcher
      .on('add', (filePath) => this._reloadSkill(filePath))
      .on('change', (filePath) => this._reloadSkill(filePath))
      .on('unlink', () => { Array.from(this.customMarkdownSkillsCache.keys()).forEach(n => { if (!this.dbSkillNamesCache.has(n)) delete this.skills[n]; }); this._loadCustomSkills(dir); this._updateTools(); });
  }

  private _reloadSkill(filePath: string) {
    const skill = MarkdownSkillLoader.loadSkill(filePath);
    if (skill) {
      this.customMarkdownSkillsCache.set(skill.name, skill);
      if (!this.builtinSkillsCache.has(skill.name) && !this.dbSkillNamesCache.has(skill.name)) {
        this.skills[skill.name] = skill;
        this._updateTools();
        if (this.mainWindow) this.mainWindow.webContents.send('ipc:skills:updated', { name: skill.name, action: 'update' });
      }
    }
  }

  private _getOrCreateOpenAIInstance(apiKey: string, baseURL?: string): OpenAI {
    const key = baseURL || 'default';
    if (this.openaiInstances.has(key)) return this.openaiInstances.get(key)!;
    const instance = new OpenAI({ apiKey: apiKey.trim(), baseURL: baseURL?.trim(), fetch: electronFetch });
    this.openaiInstances.set(key, instance);
    return instance;
  }

  private _updateTools() {
    this.tools = Object.values(this.skills).map((s) => ({ type: 'function', function: { name: s.name, description: s.description, parameters: s.parameters } }));
  }

  private _hasMultipleJsonObjects(str: string): boolean {
    try { JSON.parse(str); return false; } catch { return /\}\s*\{/.test(str); }
  }

  private _parseFirstJsonObject(str: string): any {
    let depth = 0, inString = false, escapeNext = false;
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (escapeNext) { escapeNext = false; continue; }
      if (c === '\\') { escapeNext = true; continue; }
      if (c === '"' && !escapeNext) { inString = !inString; continue; }
      if (inString) continue;
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) return JSON.parse(str.substring(0, i + 1)); }
    }
    throw new Error('No complete JSON object found');
  }

  private async _loadSkillsFromDB(dbSkills: SkillFromDB[]) {
    const builtinNames = Array.from(this.builtinSkillsCache.keys());
    Object.keys(this.skills).forEach(k => { if (!builtinNames.includes(k)) delete this.skills[k]; });

    this.dbSkillNamesCache = new Set();
    this.dbSkillDisplayName.clear();

    for (const dbSkill of dbSkills) {
      if (dbSkill.status !== 'active') continue;
      this.dbSkillNamesCache.add(dbSkill.name);
      if (dbSkill.displayName) this.dbSkillDisplayName.set(dbSkill.name, dbSkill.displayName);

      let params = dbSkill.schema.parameters;
      if (typeof params === 'string') { try { params = JSON.parse(params); } catch { continue; } }

      const execute = dbSkill.runtime.type === 'builtin' && this.builtinSkillsCache.has(dbSkill.name)
        ? this.builtinSkillsCache.get(dbSkill.name)!.execute
        : this._createExecuteFunction(dbSkill);

      this.skills[dbSkill.name] = { name: dbSkill.name, displayName: dbSkill.displayName, description: dbSkill.description, parameters: params, execute };
    }

    for (const [name, skill] of this.customMarkdownSkillsCache.entries()) {
      if (!this.builtinSkillsCache.has(name) && !this.dbSkillNamesCache.has(name)) this.skills[name] = skill;
    }
    this._updateTools();
  }

  private _createExecuteFunction(dbSkill: SkillFromDB): (args: any, ctx?: SkillContext) => Promise<any> {
    return async (args: any, ctx?: SkillContext) => {
      try {
        switch (dbSkill.runtime.type) {
          case 'javascript': return await executeSandboxedJavaScript(dbSkill.runtime.code!, args);
          case 'http': return await this._executeHttp(dbSkill, args);
          case 'builtin': return dbSkill.name === 'get_time' ? { time: new Date().toISOString(), timestamp: Date.now() } : { message: `Built-in skill ${dbSkill.name} executed` };
          case 'markdown': return { type: 'markdown_knowledge', skill_name: dbSkill.name, display_name: dbSkill.displayName, description: dbSkill.description, content: dbSkill.runtime.content || '', instructions: dbSkill.runtime.instructions || '', parameters: args, message: `Applied knowledge from ${dbSkill.displayName}` };
          default: return { error: `Unknown runtime type: ${dbSkill.runtime.type}` };
        }
      } catch (error) { return { error: error instanceof Error ? error.message : String(error) }; }
    };
  }

  private async _executeHttp(dbSkill: SkillFromDB, args: any): Promise<any> {
    const { endpoint, method = 'POST', headers = {} } = dbSkill.runtime;
    if (!endpoint) throw new Error('HTTP endpoint is required');
    return new Promise((resolve, reject) => {
      const https = require('https');
      const http = require('http');
      const urlObj = new URL(endpoint);
      const proto = urlObj.protocol === 'https:' ? https : http;
      let hdrs: Record<string, string> = { 'Content-Type': 'application/json' };
      if (headers) { if (typeof headers === 'string') { try { Object.assign(hdrs, JSON.parse(headers)); } catch {} } else Object.assign(hdrs, headers); }
      const req = proto.request({ hostname: urlObj.hostname, port: urlObj.port, path: urlObj.pathname + urlObj.search, method, headers: hdrs, timeout: 30000 }, (res: any) => {
        let data = '';
        res.on('data', (c: any) => data += c);
        res.on('end', () => { if (res.statusCode >= 400) { reject(new Error(`HTTP ${res.statusCode}: ${data || res.statusMessage}`)); return; } try { resolve(JSON.parse(data)); } catch { resolve({ success: true, data, contentType: res.headers['content-type'] || 'text/plain' }); } });
      });
      req.on('error', (e: any) => reject(new Error(`HTTP request failed: ${e.message}`)));
      req.on('timeout', () => { req.destroy(); reject(new Error('HTTP request timeout')); });
      if (method !== 'GET') req.write(JSON.stringify({ args }));
      req.end();
    });
  }

  private _formatResultToMarkdown(result: any): string {
    if (result === null || result === undefined) return 'null';
    if (typeof result === 'string') return result;
    if (Array.isArray(result)) {
      if (result.length === 0) return '[](Empty List)';
      const isObjArr = result.every(i => typeof i === 'object' && i !== null && !Array.isArray(i));
      if (isObjArr) {
        const keys = Array.from(new Set(result.flatMap(Object.keys)));
        if (keys.length > 0) return `\n| ${keys.join(' | ')} |\n| ${keys.map(() => '---').join(' | ')} |\n${result.map(i => `| ${keys.map(k => { const v = (i as any)[k]; return v === undefined || v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v).replace(/\n/g, '<br>').replace(/\|/g, '\\|'); }).join(' | ')} |`).join('\n')}\n`;
      }
      return result.map(i => `- ${typeof i === 'object' ? JSON.stringify(i) : String(i)}`).join('\n');
    }
    try { return JSON.stringify(result, null, 2); } catch { return String(result); }
  }
}
