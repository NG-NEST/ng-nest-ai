import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { XDialogModule, XI18nPipe, XIconComponent, XSelectComponent, XSwitchComponent } from '@ng-nest/ui';
import { AppConfigService, AppLocaleService, AppThemeService } from '@ui/core';

@Component({
  selector: 'app-general',
  imports: [XDialogModule, XIconComponent, XSwitchComponent, XSelectComponent, XI18nPipe, FormField],
  templateUrl: './general.html',
  styleUrl: './general.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class General {
  theme = inject(AppThemeService);
  locale = inject(AppLocaleService);
  config = inject(AppConfigService);
  setDarking = signal(false);

  model = signal({ lang: this.locale.lang ?? 'zh_CN', switchDev: this.config.showDevTools() });
  formGroup = form(this.model);

  init = signal(true);

  constructor() {
    effect(async () => {
      if (this.init()) return;
      const switchDev = this.formGroup.switchDev().value();
      this.config.showDevTools.set(switchDev);
      await window.electronAPI.windowControls.switchDevTools(switchDev);
    });
    effect(async () => {
      const lang = this.formGroup.lang().value();
      this.locale.setLocale(lang).subscribe();
    });
  }

  ngOnInit() {
    this.init.set(false);
  }
}
