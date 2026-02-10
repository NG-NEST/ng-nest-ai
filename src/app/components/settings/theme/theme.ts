import { Component, effect, inject, signal } from '@angular/core';
import { form, FormField, pattern } from '@angular/forms/signals';
import { XColorPickerComponent, XDialogModule, XI18nPipe, XIconComponent, XSwitchComponent } from '@ng-nest/ui';
import { AppThemeService } from '@ui/core';

@Component({
  selector: 'app-theme',
  imports: [XDialogModule, XIconComponent, XSwitchComponent, XColorPickerComponent, XI18nPipe, FormField],
  templateUrl: './theme.html',
  styleUrl: './theme.scss'
})
export class Theme {
  theme = inject(AppThemeService);
  setDarking = signal(false);

  model = signal({
    dark: false,
    theme: {
      primary: '',
      success: '',
      warning: '',
      danger: '',
      info: '',
      background: '',
      border: '',
      text: ''
    }
  });

  formGroup = form(this.model, (schema) => {
    pattern(schema.theme.primary, /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/);
  });

  init = true;

  constructor() {
    effect(() => {
      if (this.init) return;
      const primary = this.formGroup.theme.primary().value();
      const { success, warning, danger, info, background, border, text } = this.formGroup.theme().value();
      !this.setDarking() &&
        this.theme.setColors({
          primary: primary!,
          success: success!,
          warning: warning!,
          danger: danger!,
          info: info!,
          background: background!,
          border: border!,
          text: text!
        });
    });
    effect(() => {
      if (this.init) return;
      const dark = this.formGroup.dark().value();
      this.setDarking.set(true);
      let colors = this.theme.setDark(dark!);
      this.formGroup.theme().value.set({
        primary: colors.primary!,
        success: colors.success!,
        warning: colors.warning!,
        danger: colors.danger!,
        info: colors.info!,
        background: colors.background!,
        border: colors.border!,
        text: colors.text!
      });
      this.setDarking.set(false);
    });
  }

  ngOnInit() {
    let colors = this.theme.colors();
    let dark = this.theme.dark();

    this.formGroup.dark().value.set(dark);
    this.formGroup.theme().value.set({
      primary: colors.primary!,
      success: colors.success!,
      warning: colors.warning!,
      danger: colors.danger!,
      info: colors.info!,
      background: colors.background!,
      border: colors.border!,
      text: colors.text!
    });

    this.init = false;
  }
}
