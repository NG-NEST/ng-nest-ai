import { Injectable, inject } from '@angular/core';
import { SkillService } from '../indexedDB/skill.service';
import { SessionService } from '../indexedDB/session.service';
import { MessageService } from '../indexedDB/message.service';
import { ProjectService } from '../indexedDB/project.service';
import { PromptService } from '../indexedDB/prompt.service';
import { ManufacturerService } from '../indexedDB/manufacturer.service';
import { ModelService } from '../indexedDB/model.service';

/**
 * IndexedDB 桥接服务
 * 用于处理 Electron 主进程通过 IPC 反向查询 IndexedDB 的请求
 */
@Injectable({ providedIn: 'root' })
export class IndexedDBBridgeService {
  private skillService = inject(SkillService);
  private sessionService = inject(SessionService);
  private messageService = inject(MessageService);
  private projectService = inject(ProjectService);
  private promptService = inject(PromptService);
  private manufacturerService = inject(ManufacturerService);
  private modelService = inject(ModelService);

  constructor() {
    this.initializeListener();
  }

  private initializeListener() {
    // 使用标准 IPC 机制注册处理器
    if ((window as any).electronAPI?.openAI?.registerIndexedDBHandler) {
      (window as any).electronAPI.openAI.registerIndexedDBHandler(
        async (args: any) => {
          return await this.handleQuery(args);
        }
      );
    }
  }

  private async handleQuery(args: any): Promise<any> {
    try {
      const { table, operation, id, filter } = args;

      if (!table || !operation) {
        return { error: 'Missing required parameters: table and operation' };
      }

      // 获取对应的服务
      const service = this.getService(table);
      if (!service) {
        return { error: `Unknown table: ${table}` };
      }

      // 执行操作
      switch (operation) {
        case 'getAll':
          return await this.executeObservable(service.getAll());

        case 'getById':
          if (id === undefined) {
            return { error: 'Missing required parameter: id' };
          }
          return await this.executeObservable(service.getById(id));

        case 'query':
          // 自定义查询逻辑
          return await this.handleCustomQuery(table, service, filter);

        default:
          return { error: `Unknown operation: ${operation}` };
      }
    } catch (error) {
      console.error('IndexedDB query error:', error);
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private getService(table: string): any {
    const serviceMap: { [key: string]: any } = {
      skills: this.skillService,
      sessions: this.sessionService,
      messages: this.messageService,
      projects: this.projectService,
      prompts: this.promptService,
      manufacturers: this.manufacturerService,
      models: this.modelService
    };

    return serviceMap[table];
  }

  private async handleCustomQuery(table: string, service: any, filter: any): Promise<any> {
    // 根据表和过滤条件执行自定义查询
    try {
      switch (table) {
        case 'skills':
          if (filter?.name) {
            return await this.executeObservable(service.getListByName(filter.name));
          }
          if (filter?.status) {
            const all = await this.executeObservable(service.getAll());
            return all.filter((item: any) => item.status === filter.status);
          }
          break;

        case 'sessions':
          if (filter?.projectId) {
            const all = await this.executeObservable(service.getAll());
            return all.filter((item: any) => item.projectId === filter.projectId);
          }
          if (filter?.title) {
            return await this.executeObservable(service.getListByTitle(filter.title));
          }
          break;

        case 'messages':
          if (filter?.sessionId) {
            return await this.executeObservable(service.getBySessionId(filter.sessionId));
          }
          break;

        case 'projects':
          if (filter?.name) {
            return await this.executeObservable(service.getListByName(filter.name));
          }
          break;

        case 'prompts':
          if (filter?.name) {
            return await this.executeObservable(service.getListByName(filter.name));
          }
          break;

        case 'manufacturers':
          if (filter?.isActive !== undefined) {
            const all = await this.executeObservable(service.getAll());
            return all.filter((item: any) => item.isActive === filter.isActive);
          }
          break;

        case 'models':
          if (filter?.manufacturerId) {
            return await this.executeObservable(service.getListByManufacturerId(filter.manufacturerId));
          }
          break;
      }

      // 如果没有匹配的查询，返回所有数据
      return await this.executeObservable(service.getAll());
    } catch (error) {
      throw new Error(`Custom query failed: ${error}`);
    }
  }

  // 将 Observable 转换为 Promise
  private async executeObservable(observable: any): Promise<any> {
    return new Promise((resolve, reject) => {
      observable.subscribe({
        next: (data: any) => resolve(data),
        error: (error: any) => reject(error)
      });
    });
  }
}
