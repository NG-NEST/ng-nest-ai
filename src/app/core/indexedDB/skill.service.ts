import { inject, Injectable } from '@angular/core';
import { Observable, from, Subject } from 'rxjs';
import { AppDataBaseService } from './database.service';
import { DexieDatabase } from './dexie.db';

export interface Skill {
  id?: number;
  name: string;
  displayName: string;
  description: string;
  category?: string;
  status: 'active' | 'disabled';
  schema: Schema;
  runtime: Runtime;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Schema {
  parameters: any;
  returns: any;
}

export interface Runtime {
  type: 'builtin' | 'http' | 'javascript' | 'markdown';

  // builtin
  handler?: string;

  // javascript
  code?: string; // JavaScript 执行代码

  // http
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: string; // JSON string for headers

  // markdown
  content?: string; // Markdown 内容
  instructions?: string; // 使用说明
}

export const SkillTable =
  '++id, name, displayName, description, category, status, schema, runtime, createdAt, updatedAt';

@Injectable({ providedIn: 'root' })
export class SkillService {
  init: AppDataBaseService = inject(AppDataBaseService);
  db: DexieDatabase = this.init.db;

  // 技能变更通知
  skillChange = new Subject<void>();

  constructor() {
    // 初始加载 skill
    this.loadSkills();

    // 监听 skill 变更，重新加载
    this.skillChange.subscribe(() => {
      this.loadSkills();
    });
  }

  private async loadSkills() {
    this.getAll().subscribe(async (skills) => {
      const activeSkills = skills.filter((x) => x.status === 'active');
      const result = await window.electronAPI.openAI.loadSkills(activeSkills);
      if (result.success) {
        console.log(`Loaded ${result.count} skills`);
      } else {
        console.error('Failed to load skills:', result.error);
      }
    });
  }

  create(config: Omit<Skill, 'id' | 'createdAt' | 'updatedAt'>): Observable<number> {
    return from(
      (async () => {
        const now = new Date();

        const result = await this.db.skills.add({
          ...config,
          createdAt: now,
          updatedAt: now
        });

        this.skillChange.next(); // 通知变更
        return result;
      })()
    );
  }

  getAll(): Observable<Skill[]> {
    return from(
      (async () => {
        return await this.db.skills.orderBy('createdAt').reverse().toArray();
      })()
    );
  }

  getListByName(name: string): Observable<Skill[]> {
    return from(
      (async () => {
        return await this.db.skills.filter((x) => x.name.includes(name)).sortBy('createdAt');
      })()
    );
  }

  getListByNameOrDisplayName(value: string): Observable<Skill[]> {
    return from(
      (async () => {
        return await this.db.skills
          .filter((x) => x.name.includes(value) || x.displayName.includes(value))
          .sortBy('createdAt');
      })()
    );
  }

  getById(id: number): Observable<Skill | undefined> {
    return from(
      (async () => {
        return await this.db.skills.get(id);
      })()
    );
  }

  getByIds(ids: number[]): Observable<Skill[]> {
    return from(
      (async () => {
        return await this.db.skills.where('id').anyOf(ids).toArray();
      })()
    );
  }

  update(id: number, updates: Partial<Omit<Skill, 'id' | 'createdAt'>>): Observable<number> {
    return from(
      (async () => {
        const now = new Date();

        const result = await this.db.skills.update(id, {
          ...updates,
          updatedAt: now
        });

        this.skillChange.next(); // 通知变更
        return result;
      })()
    );
  }

  delete(id: number): Observable<void> {
    return from(
      (async () => {
        await this.db.skills.delete(id);
        this.skillChange.next(); // 通知变更
      })()
    );
  }

  clear(): Observable<void> {
    return from(
      (async () => {
        await this.db.skills.clear();
      })()
    );
  }
}
