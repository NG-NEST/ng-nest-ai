import { inject, Injectable } from '@angular/core';
import { Observable, Subject, from } from 'rxjs';
import { AppDataBaseService } from './database.service';
import { DexieDatabase } from './dexie.db';
import { PaginationResult } from './type.interface';

export interface Session {
  id?: number;
  title: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const SessionTable = '++id, title, createdAt, updatedAt';

@Injectable({ providedIn: 'root' })
export class SessionService {
  init: AppDataBaseService = inject(AppDataBaseService);
  db: DexieDatabase = this.init.db;

  added = new Subject<number>();

  create(session: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>): Observable<number> {
    return from(
      (async () => {
        const now = new Date();

        const id = await this.db.sessions.add({
          ...session,
          createdAt: now,
          updatedAt: now
        });

        this.added.next(id);

        return id;
      })()
    );
  }

  // 新增分页查询方法
  getByPage(page: number, size: number): Observable<PaginationResult<Session>> {
    return from(
      (async () => {
        const offset = (page - 1) * size;
        const data = await this.db.sessions.orderBy('createdAt').reverse().offset(offset).limit(size).toArray();
        const count = await this.db.sessions.count();

        return {
          data,
          count
        };
      })()
    );
  }

  getAll(): Observable<Session[]> {
    return from(
      (async () => {
        return await this.db.sessions.orderBy('createdAt').reverse().toArray();
      })()
    );
  }

  getById(id: number): Observable<Session | undefined> {
    return from(
      (async () => {
        return await this.db.sessions.get(id);
      })()
    );
  }

  update(id: number, updates: Partial<Omit<Session, 'id' | 'createdAt'>>): Observable<number> {
    return from(
      (async () => {
        const now = new Date();

        return await this.db.sessions.update(id, {
          ...updates,
          updatedAt: now
        });
      })()
    );
  }

  delete(id: number): Observable<void> {
    return from(
      (async () => {
        await this.db.sessions.delete(id);
      })()
    );
  }

  clear(): Observable<void> {
    return from(
      (async () => {
        await this.db.sessions.clear();
      })()
    );
  }
}
