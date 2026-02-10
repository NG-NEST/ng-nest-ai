// electron/skills/builtin/file-operations.skill.ts
import { SkillDefinition } from './types';
import { readdirSync, statSync, existsSync } from 'fs';
import { join, extname, basename, dirname, resolve } from 'path';

export const skill: SkillDefinition = {
  name: 'file_operations',
  description: '文件系统操作：列出指定目录中的文件和文件夹，支持递归查询和文件过滤',
  parameters: {
    type: 'object',
    properties: {
      directory: {
        type: 'string',
        description: '要查询的目录路径，支持绝对路径和相对路径'
      },
      operation: {
        type: 'string',
        description: '操作类型',
        enum: ['list', 'listFiles', 'listDirectories', 'listRecursive'],
        default: 'list'
      },
      recursive: {
        type: 'boolean',
        description: '是否递归查询子目录',
        default: false
      },
      maxDepth: {
        type: 'number',
        description: '递归查询的最大深度，0表示无限制',
        default: 0
      },
      extensions: {
        type: 'array',
        description: '文件扩展名过滤器，例如 [".ts", ".js", ".json"]',
        items: {
          type: 'string'
        }
      },
      includeHidden: {
        type: 'boolean',
        description: '是否包含隐藏文件（以.开头的文件）',
        default: false
      },
      includeStats: {
        type: 'boolean',
        description: '是否包含文件统计信息（大小、修改时间等）',
        default: false
      }
    },
    required: []
  },
  execute: async (args, context) => {
    try {
      let {
        directory,
        operation = 'list',
        recursive = false,
        maxDepth = 0,
        extensions = [],
        includeHidden = false,
        includeStats = false
      } = args;

      // 如果未提供目录，尝试从上下文获取工作区路径
      if (!directory && context?.workspace) {
        directory = context.workspace;
      }

      if (!directory) {
        return {
          error: 'Directory is required. Please provide a directory path or ensure a workspace is active.'
        };
      }

      // 安全检查：解析绝对路径
      const resolvedPath = resolve(directory);

      // 如果有工作区上下文，强制只能访问工作区内的文件
      if (context?.workspace) {
        const resolvedWorkspace = resolve(context.workspace);
        // 简单的安全检查：确保请求的路径以工作区路径开头
        // 注意：在生产环境中可能需要更严谨的检查（如处理大小写敏感性、软链接等）
        if (!resolvedPath.toLowerCase().startsWith(resolvedWorkspace.toLowerCase())) {
          return {
            error: `Access denied: Cannot access files outside the workspace. Path: ${directory}`
          };
        }
      }

      // 验证目录是否存在
      if (!existsSync(resolvedPath)) {
        return {
          error: `Directory does not exist: ${directory}`
        };
      }

      // 验证是否为目录
      const dirStat = statSync(resolvedPath);
      if (!dirStat.isDirectory()) {
        return {
          error: `Path is not a directory: ${directory}`
        };
      }

      const result = {
        directory: resolvedPath,
        operation: operation,
        timestamp: new Date().toISOString(),
        items: [] as any[],
        summary: {
          totalFiles: 0,
          totalDirectories: 0,
          totalSize: 0
        }
      };

      // 执行相应的操作
      switch (operation) {
        case 'list':
          result.items = await listDirectory(resolvedPath, {
            recursive,
            maxDepth,
            extensions,
            includeHidden,
            includeStats,
            includeFiles: true,
            includeDirectories: true
          });
          break;
        
        case 'listFiles':
          result.items = await listDirectory(resolvedPath, {
            recursive,
            maxDepth,
            extensions,
            includeHidden,
            includeStats,
            includeFiles: true,
            includeDirectories: false
          });
          break;
        
        case 'listDirectories':
          result.items = await listDirectory(resolvedPath, {
            recursive,
            maxDepth,
            extensions,
            includeHidden,
            includeStats,
            includeFiles: false,
            includeDirectories: true
          });
          break;
        
        case 'listRecursive':
          result.items = await listDirectory(resolvedPath, {
            recursive: true,
            maxDepth,
            extensions,
            includeHidden,
            includeStats,
            includeFiles: true,
            includeDirectories: true
          });
          break;
        
        default:
          return {
            error: `Unknown operation: ${operation}`
          };
      }

      // 计算统计信息
      result.summary = calculateSummary(result.items);

      return result;
    } catch (error) {
      console.error('File operations error:', error);
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
};

interface ListOptions {
  recursive: boolean;
  maxDepth: number;
  extensions: string[];
  includeHidden: boolean;
  includeStats: boolean;
  includeFiles: boolean;
  includeDirectories: boolean;
}

async function listDirectory(
  directory: string, 
  options: ListOptions, 
  currentDepth: number = 0
): Promise<any[]> {
  const items: any[] = [];
  
  try {
    const entries = readdirSync(directory);
    
    for (const entry of entries) {
      const fullPath = join(directory, entry);
      
      // 跳过隐藏文件（如果不包含隐藏文件）
      if (!options.includeHidden && entry.startsWith('.')) {
        continue;
      }
      
      try {
        const stats = statSync(fullPath);
        const isDirectory = stats.isDirectory();
        const isFile = stats.isFile();
        
        // 创建基本项目信息
        const item: any = {
          name: entry,
          path: fullPath,
          relativePath: fullPath.replace(directory, '').replace(/^[\\\/]/, ''),
          type: isDirectory ? 'directory' : 'file'
        };
        
        // 添加文件扩展名信息
        if (isFile) {
          item.extension = extname(entry);
          item.basename = basename(entry, item.extension);
        }
        
        // 添加统计信息
        if (options.includeStats) {
          item.stats = {
            size: stats.size,
            sizeFormatted: formatFileSize(stats.size),
            created: stats.birthtime.toISOString(),
            modified: stats.mtime.toISOString(),
            accessed: stats.atime.toISOString()
          };
        }
        
        // 文件扩展名过滤
        if (isFile && options.extensions.length > 0) {
          const fileExt = extname(entry).toLowerCase();
          if (!options.extensions.some(ext => ext.toLowerCase() === fileExt)) {
            continue;
          }
        }
        
        // 根据类型过滤
        if (isFile && !options.includeFiles) {
          continue;
        }
        if (isDirectory && !options.includeDirectories) {
          continue;
        }
        
        items.push(item);
        
        // 递归处理子目录
        if (isDirectory && options.recursive) {
          // 检查深度限制
          if (options.maxDepth === 0 || currentDepth < options.maxDepth) {
            const subItems = await listDirectory(fullPath, options, currentDepth + 1);
            items.push(...subItems);
          }
        }
      } catch (statError) {
        console.warn(`Failed to get stats for ${fullPath}:`, statError);
        // 添加错误项目
        items.push({
          name: entry,
          path: fullPath,
          type: 'error',
          error: statError instanceof Error ? statError.message : String(statError)
        });
      }
    }
  } catch (error) {
    console.error(`Failed to read directory ${directory}:`, error);
    throw error;
  }
  
  return items;
}

function calculateSummary(items: any[]): any {
  const summary = {
    totalFiles: 0,
    totalDirectories: 0,
    totalSize: 0,
    fileTypes: {} as Record<string, number>
  };
  
  for (const item of items) {
    if (item.type === 'file') {
      summary.totalFiles++;
      if (item.stats?.size) {
        summary.totalSize += item.stats.size;
      }
      
      // 统计文件类型
      const ext = item.extension || 'no-extension';
      summary.fileTypes[ext] = (summary.fileTypes[ext] || 0) + 1;
    } else if (item.type === 'directory') {
      summary.totalDirectories++;
    }
  }
  
  return {
    ...summary,
    totalSizeFormatted: formatFileSize(summary.totalSize)
  };
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
