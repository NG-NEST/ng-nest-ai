import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { XDialogModule, XIconComponent, XSwitchComponent } from '@ng-nest/ui';
import { AppThemeService } from '@ui/core';

@Component({
  selector: 'app-about',
  imports: [ReactiveFormsModule, XDialogModule, XIconComponent, XSwitchComponent],
  templateUrl: './about.html',
  styleUrl: './about.scss'
})
export class About {
  theme = inject(AppThemeService);
  formBuilder = inject(FormBuilder);
  setDarking = signal(false);

  formGroup = this.formBuilder.group({
    switchDev: [false]
  });

  ngOnInit() {
    this.formGroup.controls.switchDev.valueChanges.subscribe(async () => {
      await window.electronAPI.windowControls.switchDevTools();
    });
  }
}
