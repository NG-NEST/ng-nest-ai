import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import {
  XButtonComponent,
  XDialogModule,
  XDialogService,
  XEmptyComponent,
  XI18nPipe,
  XInputComponent,
  XInputGroupComponent,
  XKeywordDirective,
  XOrderBy
} from '@ng-nest/ui';
import { Skill, SkillService } from '@ui/core';
import { MarkdownPipe } from '@ui/components';
import { debounceTime, distinctUntilChanged, fromEvent, Subject, Subscription, switchMap, takeUntil, tap } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { form, Field } from '@angular/forms/signals';
import { SkillComponent } from './skill';

@Component({
  selector: 'app-skill-list',
  imports: [
    XDialogModule,
    XButtonComponent,
    XEmptyComponent,
    MarkdownPipe,
    XInputGroupComponent,
    XInputComponent,
    XKeywordDirective,
    XI18nPipe,
    Field
  ],
  templateUrl: './skill-list.html',
  styleUrl: './skill-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SkillList {
  dialogService = inject(XDialogService);
  service = inject(SkillService);
  inputSearch = viewChild<XInputComponent>('inputSearch');
  inputSearchChange = toObservable(this.inputSearch);
  inputKeydown: Subscription | null = null;
  loading = signal(false);
  keywordText = signal('');

  model = signal({
    value: ''
  });
  form = form(this.model);

  skillList = signal<Skill[]>([]);
  allSkillList = signal<Skill[]>([]);

  $destroy = new Subject<void>();

  ngOnInit() {
    this.getData();

    this.inputSearchChange.pipe(takeUntil(this.$destroy)).subscribe((x) => {
      if (this.inputSearch()) {
        this.inputKeydown?.unsubscribe();
        this.setInputSearch();
      }
    });
  }

  setInputSearch() {
    if (!this.inputSearch()) return;
    const inputElement = this.inputSearch()!.inputRef().nativeElement;
    this.inputKeydown = fromEvent<KeyboardEvent>(inputElement, 'keydown')
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((_event: KeyboardEvent) => {
          let value = this.model().value;
          if (value && value.trim().length > 0) {
            value = value.trim();
            this.loading.set(true);
            this.keywordText.set(value);
            return this.service.getListByName(value).pipe(
              tap(() => {
                this.loading.set(false);
              })
            );
          } else {
            this.keywordText.set('');
            this.skillList.set(this.allSkillList());
          }

          return [];
        }),
        takeUntil(this.$destroy)
      )
      .subscribe((x) => {
        this.skillList.set(XOrderBy(x, ['createdAt'], ['desc']));
      });
  }

  getData() {
    this.service.getAll().subscribe((x) => {
      this.skillList.set(XOrderBy(x, ['createdAt'], ['desc']));
      this.allSkillList.set(this.skillList());
    });
  }

  addSkill() {
    this.dialogService.create(SkillComponent, {
      width: '30rem',
      data: {
        saveSuccess: () => this.getData()
      }
    });
  }

  updateSkill(item: Skill) {
    this.dialogService.create(SkillComponent, {
      width: '30rem',
      data: {
        saveSuccess: () => this.getData(),
        id: item.id
      }
    });
  }
}
