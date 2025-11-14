import { Injectable, inject } from '@angular/core';
import { XIconService } from '@ng-nest/ui/icon';
import { of } from 'rxjs';

const IconConfig: { [key: string]: string } = {
  'win-recovery': '/icons/win-recovery.svg',
  'win-close': '/icons/win-close.svg',
  'win-maximize': '/icons/win-maximize.svg',
  'win-minimize': '/icons/win-minimize.svg',
  'collasped-left': '/icons/collasped-left.svg',
  'collasped-right': '/icons/collasped-right.svg',
  'deep-thinking': '/icons/deep-thinking.svg',
  manufacturer: '/icons/manufacturer.svg',
  model: '/icons/model.svg',
  about: '/icons/about.svg',
  settings: '/icons/settings.svg',
  theme: '/icons/theme.svg'
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
