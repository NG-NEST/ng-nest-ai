import Dexie, { Table } from 'dexie';
import { Manufacturer, ManufacturerTable } from './manufacturer.service';
import { Model, ModelTable } from './model.service';
import { Session, SessionTable } from './session.service';
import { Message, MessageTable } from './message.service';

export class DexieDatabase extends Dexie {
  manufacturers!: Table<Manufacturer, number>;
  models!: Table<Model, number>;
  sessions!: Table<Session, number>;
  messages!: Table<Message, number>;

  constructor() {
    super('ng-nest-ai');
    this.version(1).stores({
      manufacturers: ManufacturerTable,
      models: ModelTable,
      sessions: SessionTable,
      messages: MessageTable
    });
  }
}
