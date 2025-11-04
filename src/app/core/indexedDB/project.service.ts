import { inject, Injectable } from '@angular/core';
import { Observable, Subject, from } from 'rxjs';
import { AppDataBaseService } from './database.service';
import { DexieDatabase } from './dexie.db';
import { PaginationResult } from './type.interface';

export interface Project {
  id?: number;
  name: string;
  icon?: string;
  iconColor?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const ProjectTable = '++id, name, icon, iconColor, createdAt, updatedAt';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  init: AppDataBaseService = inject(AppDataBaseService);
  db: DexieDatabase = this.init.db;

  added = new Subject<number>();
  deleted = new Subject<number>();

  create(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Observable<number> {
    return from(
      (async () => {
        const now = new Date();

        const id = await this.db.projects.add({
          ...project,
          createdAt: now,
          updatedAt: now
        });

        this.added.next(id);

        return id;
      })()
    );
  }

  getListByName(name: string) {
    return from(
      (async () => {
        return await this.db.projects
          .filter((item) => item.name.toLowerCase().includes(name.toLowerCase()))
          .sortBy('createdAt')
          .then((result) => result.reverse());
      })()
    );
  }

  getByPage(page: number, size: number): Observable<PaginationResult<Project>> {
    return from(
      (async () => {
        const offset = (page - 1) * size;
        const data = await this.db.projects.orderBy('createdAt').reverse().offset(offset).limit(size).toArray();
        const count = await this.db.projects.count();

        return {
          data,
          count
        };
      })()
    );
  }

  getAll(): Observable<Project[]> {
    return from(
      (async () => {
        return await this.db.projects.orderBy('createdAt').reverse().toArray();
      })()
    );
  }

  getById(id: number): Observable<Project | undefined> {
    return from(
      (async () => {
        return await this.db.projects.get(id);
      })()
    );
  }

  update(id: number, updates: Partial<Omit<Project, 'id' | 'createdAt'>>): Observable<number> {
    return from(
      (async () => {
        const now = new Date();

        return await this.db.projects.update(id, {
          ...updates,
          updatedAt: now
        });
      })()
    );
  }

  delete(id: number): Observable<number> {
    return from(
      (async () => {
        await this.db.projects.delete(id);
        this.deleted.next(id);
        return id;
      })()
    );
  }

  clear(): Observable<void> {
    return from(
      (async () => {
        await this.db.projects.clear();
      })()
    );
  }

  count(): Observable<number> {
    return from(
      (async () => {
        return await this.db.projects.count();
      })()
    );
  }
}
