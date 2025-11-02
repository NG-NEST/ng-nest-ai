import { Component, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { XButtonComponent, XDialogModule, XIconComponent } from '@ng-nest/ui';
import { ManufacturerList } from './manufacturer/manufacturer-list';
import { ModelList } from './model/model-list';
import { Theme } from './theme/theme';

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule, XDialogModule, XIconComponent, XButtonComponent, ManufacturerList, ModelList, Theme],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class Settings {
  selectedIndex = signal(0);

  menus = [
    { label: '服务商', icon: 'icon:manufacturer' },
    { label: '模型', icon: 'icon:model' },
    { label: '外观', icon: 'icon:theme' },
    { label: '通用', icon: 'icon:settings' },
    { label: '关于', icon: 'icon:about' }
  ];

  selectMenu(index: number) {
    this.selectedIndex.set(index);
  }
}
