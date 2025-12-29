import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { AppDataBaseService } from './database.service';
import { DexieDatabase } from './dexie.db';

export interface Manufacturer {
  id?: number;
  name: string;
  apiKey: string;
  baseURL: string;
  createdAt?: Date;
  updatedAt?: Date;
  isActive: boolean;
}

export const ManufacturerTable = '++id, name, apiKey, baseURL, createdAt, updatedAt, isActive';

@Injectable({ providedIn: 'root' })
export class ManufacturerService {
  init: AppDataBaseService = inject(AppDataBaseService);
  db: DexieDatabase = this.init.db;

  activeChange = new BehaviorSubject<Manufacturer | null>(null);

  create(config: Omit<Manufacturer, 'id' | 'createdAt' | 'updatedAt'>): Observable<number> {
    return from(
      (async () => {
        const now = new Date();

        if (config.isActive) {
          await this.db.manufacturers.filter((x) => x.isActive === true).modify({ isActive: false });
        }

        const result = await this.db.manufacturers.add({
          ...config,
          createdAt: now,
          updatedAt: now
        });

        if (config.isActive) {
          this.activeChange.next((await this.db.manufacturers.get(result))!);
        }

        return result;
      })()
    );
  }

  getAll(): Observable<Manufacturer[]> {
    return from(
      (async () => {
        return await this.db.manufacturers.orderBy('createdAt').reverse().toArray();
      })()
    );
  }

  getById(id: number): Observable<Manufacturer | undefined> {
    return from(
      (async () => {
        return await this.db.manufacturers.get(id);
      })()
    );
  }

  getByIds(ids: number[]): Observable<Manufacturer[]> {
    return from(
      (async () => {
        return await this.db.manufacturers.where('id').anyOf(ids).toArray();
      })()
    );
  }

  getActive(): Observable<Manufacturer | undefined> {
    return from(
      (async () => {
        return await this.db.manufacturers.filter((x) => x.isActive === true).first();
      })()
    );
  }

  update(id: number, updates: Partial<Omit<Manufacturer, 'id' | 'createdAt'>>): Observable<number> {
    return from(
      (async () => {
        const now = new Date();

        if (updates.isActive) {
          await this.db.manufacturers.filter((x) => x.isActive === true).modify({ isActive: false });
        }

        const result = await this.db.manufacturers.update(id, {
          ...updates,
          updatedAt: now
        });

        if (updates.isActive) {
          this.activeChange.next((await this.db.manufacturers.get(id))!);
        }

        return result;
      })()
    );
  }

  delete(id: number): Observable<void> {
    return from(
      (async () => {
        const config = await this.getById(id).toPromise(); // 需要将 Observable 转回 Promise
        if (config && config.isActive) {
          throw new Error('不能删除激活的厂商');
        }

        await this.db.manufacturers.delete(id);
      })()
    );
  }

  setActive(id: number): Observable<number> {
    return from(
      (async () => {
        await this.db.manufacturers.filter((x) => x.isActive === true).modify({ isActive: false });

        const result = await this.db.manufacturers.update(id, {
          isActive: true,
          updatedAt: new Date()
        });

        this.activeChange.next((await this.db.manufacturers.get(id))!);

        return result;
      })()
    );
  }

  clear(): Observable<void> {
    return from(
      (async () => {
        await this.db.manufacturers.clear();
      })()
    );
  }
}
