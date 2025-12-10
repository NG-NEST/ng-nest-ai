import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { AppDataBaseService } from './database.service';
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
  usePrompt?: boolean;
  useUploadImage?: boolean;
  useUploadVideo?: boolean;
  inputTranslation?: boolean;
  inputFunction?: string;
  outputTranslation?: boolean;
  outputFunction?: string;
  requestType?: 'OpenAI' | 'Http';
  method?: 'POST';
  url?: string;
  headersFunction?: string;
  bodyFunction?: string;
  tags?: string[];
}

export const ModelTable = `++id, manufacturerId, name, code, description, createdAt, updatedAt, 
isActive, usePrompt, useUploadImage, useUploadVideo, requestType, inputTranslation, inputFunction, 
outputTranslation, outputFunction, method, url, headersFunction, bodyFunction`;

@Injectable({ providedIn: 'root' })
export class ModelService {
  init: AppDataBaseService = inject(AppDataBaseService);
  db: DexieDatabase = this.init.db;

  activeChange = new BehaviorSubject<Model | null>(null);

  create(config: Omit<Model, 'id' | 'createdAt' | 'updatedAt'>): Observable<number> {
    return from(
      (async () => {
        const now = new Date();

        if (config.isActive) {
          await this.db.models
            .filter((x) => x.isActive === true && x.manufacturerId === config.manufacturerId)
            .modify({ isActive: false });
        }

        const result = await this.db.models.add({
          ...config,
          createdAt: now,
          updatedAt: now
        });

        if (config.isActive) {
          this.activeChange.next((await this.db.models.get(result))!);
        }

        return result;
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

  getListByNameOrCode(nameOrCode: string): Observable<Model[]> {
    return from(
      (async () => {
        return await this.db.models
          .filter((x) => x.name.includes(nameOrCode) || x.code.includes(nameOrCode))
          .sortBy('createdAt');
      })()
    );
  }

  getListByManufacturerAndNameOrCode(manufacturerId: number, nameOrCode: string): Observable<Model[]> {
    return from(
      (async () => {
        return await this.db.models
          .filter(
            (x) => x.manufacturerId === manufacturerId && (x.name.includes(nameOrCode) || x.code.includes(nameOrCode))
          )
          .sortBy('createdAt');
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

  getActive(manufacturerId: number): Observable<Model | undefined> {
    return from(
      (async () => {
        return await this.db.models.filter((x) => x.isActive === true && x.manufacturerId === manufacturerId).first();
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

        const result = await this.db.models.update(id, {
          ...updates,
          updatedAt: now
        });

        if (updates.isActive) {
          this.activeChange.next((await this.db.models.get(id))!);
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
          throw new Error('不能删除激活的模型');
        }

        await this.db.models.delete(id);
      })()
    );
  }

  setActive(id: number, manufacturerId: number): Observable<number> {
    return from(
      (async () => {
        await this.db.models
          .filter((x) => x.isActive === true && x.manufacturerId === manufacturerId)
          .modify({ isActive: false });

        const result = await this.db.models.update(id, {
          isActive: true,
          updatedAt: new Date()
        });

        this.activeChange.next((await this.db.models.get(id))!);

        return result;
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
