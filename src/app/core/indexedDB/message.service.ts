import { inject, Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { AppDataBaseService } from './database.service';
import { DexieDatabase } from './dexie.db';

export interface Message {
  id?: number;
  sessionId: number;
  manufacturerId: number;
  modelId: number;
  role: 'system' | 'user' | 'assistant' | 'error';
  content: string;
  reasoningContent?: string;
  image?: string;
  imageContent?: string;
  video?: string;
  videoContent?: string;
  createdAt?: Date;
}

export const MessageTable =
  '++id, sessionId, manufacturerId, modelId, role, content, image, imageContent, video, videoContent, reasoningContent, createdAt';

@Injectable({ providedIn: 'root' })
export class MessageService {
  init: AppDataBaseService = inject(AppDataBaseService);
  db: DexieDatabase = this.init.db;

  getAll(): Observable<Message[]> {
    return from(
      (async () => {
        return await this.db.messages.orderBy('createdAt').reverse().toArray();
      })()
    );
  }

  create(message: Omit<Message, 'id' | 'createdAt'>): Observable<number> {
    return from(
      (async () => {
        const now = new Date();

        return await this.db.messages.add({
          ...message,
          createdAt: now
        });
      })()
    );
  }

  getBySessionId(sessionId: number): Observable<Message[]> {
    return from(
      (async () => {
        return await this.db.messages.filter((x) => x.sessionId === sessionId).sortBy('createdAt');
      })()
    );
  }

  deleteBySessionId(sessionId: number): Observable<void> {
    return from(
      (async () => {
        await this.db.messages.filter((x) => x.sessionId === sessionId).delete();
      })()
    );
  }

  // 获取特定会话中使用的厂商和模型信息
  getSessionManufacturerAndModel(
    sessionId: number
  ): Observable<{ manufacturerId: number; modelId: number } | undefined> {
    return from(
      (async () => {
        const firstMessage = await this.db.messages.filter((x) => x.sessionId === sessionId).first();

        if (firstMessage) {
          return {
            manufacturerId: firstMessage.manufacturerId,
            modelId: firstMessage.modelId
          };
        }
        return undefined;
      })()
    );
  }

  clear(): Observable<void> {
    return from(
      (async () => {
        await this.db.messages.clear();
      })()
    );
  }
}
