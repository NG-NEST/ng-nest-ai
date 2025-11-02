import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  XButtonComponent,
  XColorPickerComponent,
  XColorsTheme,
  XDialogModule,
  XIconComponent,
  XSwitchComponent
} from '@ng-nest/ui';
import { AppThemeService } from '@ui/core';

@Component({
  selector: 'app-settings',
  imports: [
    ReactiveFormsModule,
    XDialogModule,
    XIconComponent,
    XButtonComponent,
    XSwitchComponent,
    XColorPickerComponent
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class Settings {
  theme = inject(AppThemeService);
  formBuilder = inject(FormBuilder);
  selectedIndex = signal(0);
  setDarking = signal(false);
  menus = [
    { label: '外观', icon: 'icon:theme' },
    { label: '通用', icon: 'icon:settings' },
    { label: '关于', icon: 'icon:about' }
  ];
  formGroup = this.formBuilder.group({
    theme: this.formBuilder.group({
      dark: false,
      primary: '',
      success: '',
      warning: '',
      danger: '',
      info: '',
      background: '',
      border: '',
      text: ''
    })
  });

  ngOnInit() {
    let colors = this.theme.colors();
    let dark = this.theme.dark();

    this.formGroup.controls.theme.controls.dark.patchValue(dark);
    this.formGroup.controls.theme.patchValue(colors);

    this.formGroup.controls.theme.controls.primary.valueChanges.subscribe((x) => {
      const { success, warning, danger, info, background, border, text } = this.formGroup.controls.theme.value!;
      !this.setDarking() &&
        this.theme.setColors({
          primary: x!,
          success: success!,
          warning: warning!,
          danger: danger!,
          info: info!,
          background: background!,
          border: border!,
          text: text!
        });
    });

    this.formGroup.controls.theme.controls.dark.valueChanges.subscribe((value) => {
      this.setDarking.set(true);
      let colors = this.theme.setDark(value!);
      this.formGroup.controls.theme.patchValue(colors);
      this.setDarking.set(false);
    });
  }

  selectMenu(index: number) {
    this.selectedIndex.set(index);
  }
}
