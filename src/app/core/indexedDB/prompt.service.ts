import { inject, Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { AppDataBaseService } from './database.service';
import { DexieDatabase } from './dexie.db';

export interface Prompt {
  id?: number;
  name: string;
  content: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const PromptTable = '++id, name, content, description, createdAt, updatedAt';

@Injectable({ providedIn: 'root' })
export class PromptService {
  init: AppDataBaseService = inject(AppDataBaseService);
  db: DexieDatabase = this.init.db;

  create(config: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>): Observable<number> {
    return from(
      (async () => {
        const now = new Date();

        const result = await this.db.prompts.add({
          ...config,
          createdAt: now,
          updatedAt: now
        });

        return result;
      })()
    );
  }

  getAll(): Observable<Prompt[]> {
    return from(
      (async () => {
        return await this.db.prompts.orderBy('createdAt').reverse().toArray();
      })()
    );
  }

  getListByName(name: string): Observable<Prompt[]> {
    return from(
      (async () => {
        return await this.db.prompts.filter((x) => x.name.includes(name)).sortBy('createdAt');
      })()
    );
  }

  getListByNameOrContent(value: string): Observable<Prompt[]> {
    return from(
      (async () => {
        return await this.db.prompts
          .filter((x) => x.name.includes(value) || x.content.includes(value))
          .sortBy('createdAt');
      })()
    );
  }

  getById(id: number): Observable<Prompt | undefined> {
    return from(
      (async () => {
        return await this.db.prompts.get(id);
      })()
    );
  }

  getByIds(ids: number[]): Observable<Prompt[]> {
    return from(
      (async () => {
        return await this.db.prompts.where('id').anyOf(ids).toArray();
      })()
    );
  }

  update(id: number, updates: Partial<Omit<Prompt, 'id' | 'createdAt'>>): Observable<number> {
    return from(
      (async () => {
        const now = new Date();

        const result = await this.db.prompts.update(id, {
          ...updates,
          updatedAt: now
        });

        return result;
      })()
    );
  }

  delete(id: number): Observable<void> {
    return from(
      (async () => {
        await this.db.prompts.delete(id);
      })()
    );
  }

  clear(): Observable<void> {
    return from(
      (async () => {
        await this.db.prompts.clear();
      })()
    );
  }
}
