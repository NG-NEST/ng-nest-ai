import { inject, Injectable } from '@angular/core';
import { Observable, Subject, from } from 'rxjs';
import { AppDataBaseService } from './database.service';
import { DexieDatabase } from './dexie.db';
import { PaginationResult } from './type.interface';

export interface Session {
  id?: number;
  title: string;
  projectId?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export const SessionTable = '++id, title, projectId,  createdAt, updatedAt';

@Injectable({ providedIn: 'root' })
export class SessionService {
  init: AppDataBaseService = inject(AppDataBaseService);
  db: DexieDatabase = this.init.db;

  added = new Subject<Session>();
  deleted = new Subject<Session>();

  create(session: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>): Observable<number> {
    return from(
      (async () => {
        const now = new Date();

        const id = await this.db.sessions.add({
          ...session,
          createdAt: now,
          updatedAt: now
        });

        this.added.next((await this.db.sessions.get(id))!);

        return id;
      })()
    );
  }

  getListByTitle(title: string) {
    return from(
      (async () => {
        return await this.db.sessions
          .filter((item) => item.title.toLowerCase().includes(title.toLowerCase()))
          .sortBy('createdAt')
          .then((result) => result.reverse());
      })()
    );
  }

  getByPage(page: number, size: number): Observable<PaginationResult<Session>> {
    return from(
      (async () => {
        const offset = (page - 1) * size;
        const data = await this.db.sessions
          .filter((x) => !x.projectId)
          .reverse()
          .offset(offset)
          .limit(size)
          .toArray();
        const count = await this.db.sessions.filter((x) => !x.projectId).count();

        return {
          data,
          count
        };
      })()
    );
  }

  getProjectByPage(page: number, size: number, projectId: number): Observable<PaginationResult<Session>> {
    return from(
      (async () => {
        const offset = (page - 1) * size;
        const data = await this.db.sessions
          .filter((x) => x.projectId === projectId)
          .reverse()
          .offset(offset)
          .limit(size)
          .toArray();
        const count = await this.db.sessions.filter((x) => x.projectId === projectId).count();

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

  delete(id: number): Observable<number> {
    return from(
      (async () => {
        const session = await this.db.sessions.get(id);
        await this.db.sessions.delete(id);
        this.deleted.next(session!);
        return id;
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

  count(projectId = null): Observable<number> {
    return from(
      (async () => {
        if (projectId === null) {
          return await this.db.sessions.filter((x) => !x.projectId).count();
        } else {
          return await this.db.sessions.filter((x) => x.projectId === projectId).count();
        }
      })()
    );
  }

  removeToProject(id: number, projectId: number) {
    return from(
      (async () => {
        await this.db.sessions.update(id, { projectId });
      })()
    );
  }
}
