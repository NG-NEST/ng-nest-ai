import { Injectable, signal } from '@angular/core';
import type { XScrollableComponent } from '@ng-nest/ui/scrollable';

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  readonly menuActivatedId = signal('');
  readonly collapsed = signal(false);
  readonly showTopShadow = signal(false);
  readonly showBottomShadow = signal(false);
  readonly mainScrollable = signal<XScrollableComponent | null>(null);
  readonly showDevTools = signal(false);

  constructor() {}
}
