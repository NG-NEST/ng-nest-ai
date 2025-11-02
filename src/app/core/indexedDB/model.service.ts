import { inject, Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { InitService } from './init.service';
import { DexieDatabase } from './dexie.db';

export interface Model {
  id?: number;
  manufacturerId: number;
  name: string;
  code: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
  isActive: boolean;
}

export const ModelTable = '++id, manufacturerId, name, code, description, createdAt, updatedAt, isActive';

@Injectable({ providedIn: 'root' })
export class ModelService {
  init: InitService = inject(InitService);
  db: DexieDatabase = this.init.db;

  create(config: Omit<Model, 'id' | 'createdAt' | 'updatedAt'>): Observable<number> {
    return from(
      (async () => {
        const now = new Date();

        if (config.isActive) {
          await this.db.models
            .filter((x) => x.isActive === true && x.manufacturerId === config.manufacturerId)
            .modify({ isActive: false });
        }

        return await this.db.models.add({
          ...config,
          createdAt: now,
          updatedAt: now
        });
      })()
    );
  }

  getAll(): Observable<Model[]> {
    return from(
      (async () => {
        return await this.db.models.orderBy('createdAt').reverse().toArray();
      })()
    );
  }

  getListByManufacturerId(manufacturerId: number): Observable<Model[]> {
    return from(
      (async () => {
        return await this.db.models.filter((x) => x.manufacturerId === manufacturerId).sortBy('createdAt');
      })()
    );
  }

  getById(id: number): Observable<Model | undefined> {
    return from(
      (async () => {
        return await this.db.models.get(id);
      })()
    );
  }

  getActive(): Observable<Model | undefined> {
    return from(
      (async () => {
        return await this.db.models.filter((x) => x.isActive === true).first();
      })()
    );
  }

  update(id: number, updates: Partial<Omit<Model, 'id' | 'createdAt'>>): Observable<number> {
    return from(
      (async () => {
        const now = new Date();

        if (updates.isActive) {
          await this.db.models
            .filter((x) => x.isActive === true && x.manufacturerId === updates.manufacturerId)
            .modify({ isActive: false });
        }

        return await this.db.models.update(id, {
          ...updates,
          updatedAt: now
        });
      })()
    );
  }

  delete(id: number): Observable<void> {
    return from(
      (async () => {
        const config = await this.getById(id).toPromise(); // 需要将 Observable 转回 Promise
        if (config && config.isActive) {
          throw new Error('不能删除激活的模型');
        }

        await this.db.models.delete(id);
      })()
    );
  }

  clear(): Observable<void> {
    return from(
      (async () => {
        await this.db.models.clear();
      })()
    );
  }
}
