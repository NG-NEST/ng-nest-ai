# Built-in Skills

This directory contains all built-in skills for the OpenAI service. Each skill is defined in a separate `.skill.ts` file and follows a standardized structure.

## Structure

```
electron/skills/builtin/
├── types.ts                    # Type definitions
├── index.ts                    # Skill loader and exports
├── README.md                   # This file
├── get-time.skill.ts          # Time-related skill
├── query-indexeddb.skill.ts   # Database query skill
└── [other-skill].skill.ts     # Additional skills
```

## Creating a New Skill

1. Create a new file with the pattern `[skill-name].skill.ts`
2. Export a `skill` object that implements the `SkillDefinition` interface
3. The skill will be automatically loaded by the system

### Example Skill File

```typescript
// electron/skills/builtin/example.skill.ts
import { SkillDefinition } from './types';

export const skill: SkillDefinition = {
  name: 'example_skill',
  description: 'An example skill that demonstrates the structure',
  parameters: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'A message to process'
      }
    },
    required: ['message']
  },
  execute: async (args, context) => {
    return {
      result: `Processed: ${args.message}`,
      timestamp: new Date().toISOString()
    };
  }
};
```

## Skill Definition Interface

```typescript
interface SkillDefinition {
  name: string;                    // Unique skill identifier
  description: string;             // Human-readable description
  parameters: any;                 // JSON Schema for parameters
  execute: (args: any, context?: SkillContext) => Promise<any>;
}

interface SkillContext {
  mainWindow?: Electron.BrowserWindow;  // Main window reference
  ipcMain?: Electron.IpcMain;          // IPC Main reference
}
```

## Available Skills

### get_time
- **Description**: 获取当前服务器时间
- **Parameters**: 
  - `detailed` (optional): Whether to return detailed information including CPU details
- **Returns**: Time information including ISO string, timestamp, timezone, and locale

### query_indexeddb
- **Description**: 查询前端 IndexedDB 数据库中的数据
- **Parameters**: 
  - `table`: Table name to query
  - `operation`: Operation type (getAll, getById, query)
  - `id`: Record ID (for getById)
  - `filter`: Custom query conditions (for query)
  - `queries`: Array of query objects for batch operations
- **Returns**: Query results or error information

### get_system_info
- **Description**: 获取系统信息，包括操作系统、架构、内存使用情况和CPU信息
- **Parameters**:
  - `detailed` (optional): Whether to return detailed CPU information
- **Returns**: System information including platform, architecture, memory usage, and optionally CPU details

### file_operations
- **Description**: 文件系统操作：列出指定目录中的文件和文件夹，支持递归查询和文件过滤
- **Parameters**:
  - `directory` (required): Directory path to query
  - `operation`: Operation type (list, listFiles, listDirectories, listRecursive)
  - `recursive`: Whether to recursively query subdirectories
  - `maxDepth`: Maximum recursion depth (0 = unlimited)
  - `extensions`: File extension filters (e.g., [".ts", ".js"])
  - `includeHidden`: Whether to include hidden files
  - `includeStats`: Whether to include file statistics
- **Returns**: List of files/directories with optional statistics and summary information

## Best Practices

1. **Error Handling**: Always wrap your execute function in try-catch blocks
2. **Validation**: Validate input parameters before processing
3. **Logging**: Use console.log/error for debugging information
4. **Async/Await**: Use async/await for asynchronous operations
5. **Context Usage**: Use the context parameter when you need access to Electron APIs
6. **Return Format**: Return consistent object structures with clear success/error indicators

## Testing

To test a skill:

1. Add it to this directory following the naming convention
2. Restart the Electron application
3. The skill will be automatically loaded and available for use
4. Check the console for loading confirmation messages