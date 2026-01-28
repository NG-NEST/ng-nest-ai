// electron/skills/builtin/query-indexeddb.skill.ts
import { SkillDefinition, SkillContext } from './types';

export const skill: SkillDefinition = {
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
  execute: async (args, context) => {
    // 支持批量查询
    if (args.queries && Array.isArray(args.queries)) {
      const results = [];
      for (const query of args.queries) {
        const result = await queryIndexedDB(query, context);
        results.push({
          table: query.table,
          operation: query.operation,
          result
        });
      }
      return results;
    }
    // 单次查询
    return await queryIndexedDB(args, context);
  }
};

// 查询 IndexedDB 的辅助函数
async function queryIndexedDB(args: any, context?: SkillContext): Promise<any> {
  if (!context?.mainWindow) {
    return {
      error: 'Main window not available'
    };
  }

  if (!context?.ipcMain) {
    return {
      error: 'IPC Main not available'
    };
  }

  try {
    // 使用标准 IPC 通信机制
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        context.ipcMain!.removeListener('ipc:openai:query-indexeddb-result', resultHandler);
        resolve({ error: 'Query timeout (5s)' });
      }, 5000);

      const resultHandler = (_event: any, response: any) => {
        clearTimeout(timeout);
        context.ipcMain!.removeListener('ipc:openai:query-indexeddb-result', resultHandler);
        
        if (response.success) {
          resolve(response.data);
        } else {
          resolve({ error: response.error || 'Unknown error' });
        }
      };

      context.ipcMain!.once('ipc:openai:query-indexeddb-result', resultHandler);
      
      // 发送查询请求到渲染进程
      context.mainWindow!.webContents.send('ipc:openai:query-indexeddb', args);
    });
  } catch (error) {
    console.error('Query IndexedDB error:', error);
    return {
      error: error instanceof Error ? error.message : String(error)
    };
  }
}