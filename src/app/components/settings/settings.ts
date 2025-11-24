import { Component, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { XButtonComponent, XDialogModule, XIconComponent } from '@ng-nest/ui';
import { ManufacturerList } from './manufacturer/manufacturer-list';
import { ModelList } from './model/model-list';
import { Theme } from './theme/theme';
import { PromptList } from './prompt/prompt-list';
import { About } from './about/about';

@Component({
  selector: 'app-settings',
  imports: [
    ReactiveFormsModule,
    XDialogModule,
    XIconComponent,
    XButtonComponent,
    ManufacturerList,
    ModelList,
    Theme,
    About,
    PromptList
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class Settings {
  selectedMenuId = signal('manufacturer');

  menus = [
    { id: 'manufacturer', label: '服务商', icon: 'icon:manufacturer' },
    { id: 'model', label: '模型', icon: 'icon:model' },
    { id: 'prompt', label: '系统提示词', icon: 'icon:prompt' },
    { id: 'theme', label: '外观', icon: 'icon:theme' },
    // { id: 'settings', label: '通用', icon: 'icon:settings' },
    { id: 'about', label: '关于', icon: 'icon:about' }
  ];

  selectMenu(menu: { id: string }) {
    this.selectedMenuId.set(menu.id);
  }
}
