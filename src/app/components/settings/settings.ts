import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { XButtonComponent, XDialogModule, XI18nPipe, XIconComponent } from '@ng-nest/ui';
import { ManufacturerList } from './manufacturer/manufacturer-list';
import { ModelList } from './model/model-list';
import { Theme } from './theme/theme';
import { PromptList } from './prompt/prompt-list';
import { SkillList } from './skill/skill-list';
import { General } from './general/general';

@Component({
  selector: 'app-settings',
  imports: [
    ReactiveFormsModule,
    XDialogModule,
    XIconComponent,
    XButtonComponent,
    XI18nPipe,
    ManufacturerList,
    ModelList,
    Theme,
    General,
    PromptList,
    SkillList
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Settings {
  selectedMenuId = signal('manufacturer');

  menus = [];

  selectMenu(menu: { id: string }) {
    this.selectedMenuId.set(menu.id);
  }
}
