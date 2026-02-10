import { inject, Injectable, signal } from '@angular/core';
import { AppOpenAIService, ChatSendParams } from './openai.service';
import { Manufacturer, ManufacturerService, Model, ModelService } from '../indexedDB';
import { XMessageService } from '@ng-nest/ui';
import { of } from 'rxjs';
import { AppHttpService } from './http.service';

@Injectable({ providedIn: 'root' })
export class AppSendService {
  message = inject(XMessageService);
  openAIService = inject(AppOpenAIService);
  httpService = inject(AppHttpService);
  manufacturerService = inject(ManufacturerService);
  modelService = inject(ModelService);
  activeManufacturer = signal<Manufacturer | null>(null);
  activeModel = signal<Model | null>(null);

  constructor() {
    this.manufacturerService.getActive().subscribe((x) => {
      this.setActiveManufacturer(x!);
    });
    this.manufacturerService.activeChange.subscribe((x) => {
      this.setActiveManufacturer(x!);
    });
    this.modelService.activeChange.subscribe((x) => {
      if (!x) return;
      if (x?.manufacturerId === this.activeManufacturer()?.id) {
        this.activeModel.set(x);
      }
    });
  }

  private async setActiveManufacturer(manufacturer: Manufacturer) {
    if (!manufacturer) return;
    this.activeManufacturer.set(manufacturer!);
    this.modelService.getActive(manufacturer!.id!).subscribe((model) => {
      if (!model) return;
      this.activeModel.set(model!);
    });

    let { baseURL, apiKey } = manufacturer;

    // 解密 API Key
    if (apiKey && window.electronAPI && await window.electronAPI.safeStorage.isEncryptionAvailable()) {
      try {
        apiKey = await window.electronAPI.safeStorage.decryptString(apiKey);
      } catch (error) {
        console.error('Failed to decrypt API Key:', error);
      }
    }

    // 初始化 OpenAI
    await window.electronAPI.openAI.initialize({ baseURL, apiKey });
  }

  send(params: ChatSendParams) {
    if (!this.verify()) return of({});
    const model = this.activeModel()!;
    const manufacturer = this.activeManufacturer()!;
    if (model.requestType === 'OpenAI') {
      return this.openAIService.send({
        manufacturer,
        model,
        ...params
      });
    } else if (model.requestType === 'Http') {
      return this.httpService.send({
        manufacturer,
        model,
        ...params
      });
    }
    return of({});
  }

  private verify() {
    if (this.activeManufacturer() === null) {
      this.message.warning('请设置并激活一个厂商！');
      return false;
    }
    if (this.activeModel() === null) {
      this.message.warning('请设置并激活一个模型！');
      return false;
    }

    return true;
  }
}
