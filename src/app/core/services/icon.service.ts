import { Injectable, inject } from '@angular/core';
import { XIconService } from '@ng-nest/ui/icon';
import { of } from 'rxjs';

const IconConfig: { [key: string]: string } = {
  'win-recovery': './assets/icons/win-recovery.svg',
  'win-close': './assets/icons/win-close.svg',
  'win-maximize': './assets/icons/win-maximize.svg',
  'win-minimize': './assets/icons/win-minimize.svg',
  'collasped-left': './assets/icons/collasped-left.svg',
  'collasped-right': './assets/icons/collasped-right.svg',
  manufacturer: './assets/icons/manufacturer.svg',
  model: './assets/icons/model.svg',
  about: './assets/icons/about.svg',
  settings: './assets/icons/settings.svg',
  theme: './assets/icons/theme.svg',
  prompt: './assets/icons/prompt.svg',
  devtools: './assets/icons/devtools.svg'
};

@Injectable({ providedIn: 'root' })
export class AppIconService {
  icon = inject(XIconService);

  init() {
    for (let ext in IconConfig) {
      this.icon.register(`icon:${ext}`, IconConfig[ext]);
    }
    return of(true);
  }
}
