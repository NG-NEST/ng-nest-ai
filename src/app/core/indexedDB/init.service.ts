import { Injectable } from '@angular/core';
import { DexieDatabase } from './dexie.db';

@Injectable({ providedIn: 'root' })
export class InitService {
  db: DexieDatabase;

  constructor() {
    this.db = new DexieDatabase();
  }
}
