import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { XDialogModule, XI18nPipe, XIconComponent, XSelectComponent, XSwitchComponent } from '@ng-nest/ui';
import { AppLocaleService, AppThemeService } from '@ui/core';

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
  setDarking = signal(false);

  model = signal({ lang: this.locale.lang ?? 'zh_CN', switchDev: false });
  formGroup = form(this.model);

  constructor() {
    effect(async () => {
      const switchDev = this.formGroup.switchDev().value();
      await window.electronAPI.windowControls.switchDevTools();
    });
    effect(async () => {
      const lang = this.formGroup.lang().value();
      this.locale.setLocale(lang).subscribe();
    });
  }
}
