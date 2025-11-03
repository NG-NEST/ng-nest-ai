import { Injectable } from '@angular/core';
import { DexieDatabase } from './dexie.db';
import { from, of, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AppDataBaseService {
  db!: DexieDatabase;

  init() {
    this.db = new DexieDatabase();

    this.db.on('populate', async () => {
      return this.initDefaultData().toPromise();
    });

    return from(this.db.open());
  }

  initDefaultData() {
    return from(
      (async () => {
        const now = new Date();

        const id = await this.db.manufacturers.add({
          name: '阿里云',
          apiKey: 'sk-xxxxx',
          baseURL: 'https://api.openai.com/v1',
          createdAt: now,
          updatedAt: now,
          isActive: true
        });

        return await this.db.models.add({
          manufacturerId: id,
          name: 'GPT-3.5-Turbo',
          code: 'gpt-3.5-turbo',
          description: 'GPT-3.5-Turbo',
          createdAt: now,
          updatedAt: now,
          isActive: true
        });
      })()
    );
  }
}
