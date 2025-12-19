import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  readonly menuActivatedId = signal('');
  readonly collapsed = signal(false);

  constructor() {}
}
