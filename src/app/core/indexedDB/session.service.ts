import { inject, Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { InitService } from './init.service';
import { DexieDatabase } from './dexie.db';

export interface Session {
  id?: number;
  title: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const SessionTable = '++id, title, createdAt, updatedAt';

@Injectable({ providedIn: 'root' })
export class SessionService {
  init: InitService = inject(InitService);
  db: DexieDatabase = this.init.db;

  create(session: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>): Observable<number> {
    return from(
      (async () => {
        const now = new Date();

        return await this.db.sessions.add({
          ...session,
          createdAt: now,
          updatedAt: now
        });
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
