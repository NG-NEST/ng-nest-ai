import { inject, Injectable, signal } from '@angular/core';
import { AppOpenAIService, ChatSendParams } from './openai.service';
import { Manufacturer, ManufacturerService, Model, ModelService, SkillService } from '../indexedDB';
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
  skillService = inject(SkillService);
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
    
    // 监听 skill 变更，重新加载
    this.skillService.skillChange.subscribe(() => {
      this.loadSkills();
    });
  }

  private async loadSkills() {
    this.skillService.getAll().subscribe(async (skills) => {
      const activeSkills = skills.filter(x => x.status === 'active');
      const result = await window.electronAPI.openAI.loadSkills(activeSkills);
      if (result.success) {
        console.log(`Loaded ${result.count} skills`);
      } else {
        console.error('Failed to load skills:', result.error);
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

    const { baseURL, apiKey } = manufacturer;

    // 初始化 OpenAI
    await window.electronAPI.openAI.initialize({ baseURL, apiKey });

    // 加载 skills
    this.loadSkills();
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
