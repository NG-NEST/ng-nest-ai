import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  XDialogModule,
  XI18nLanguage,
  XI18nPipe,
  XIconComponent,
  XSelectComponent,
  XSwitchComponent
} from '@ng-nest/ui';
import { AppLocaleService, AppThemeService } from '@ui/core';

@Component({
  selector: 'app-general',
  imports: [ReactiveFormsModule, XDialogModule, XIconComponent, XSwitchComponent, XSelectComponent, XI18nPipe],
  templateUrl: './general.html',
  styleUrl: './general.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class General {
  theme = inject(AppThemeService);
  locale = inject(AppLocaleService);
  cdr = inject(ChangeDetectorRef);
  formBuilder = inject(FormBuilder);
  setDarking = signal(false);

  formGroup = this.formBuilder.group({
    lang: [this.locale.lang ?? 'zh_CN'],
    switchDev: [false]
  });

  ngOnInit() {
    this.formGroup.controls.switchDev.valueChanges.subscribe(async () => {
      await window.electronAPI.windowControls.switchDevTools();
    });
    this.formGroup.controls.lang.valueChanges.subscribe((x) => {
      this.locale.setLocale(x as XI18nLanguage).subscribe(() => {
        this.cdr.detectChanges();
      });
    });
  }
}
