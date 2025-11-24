import { Component, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  XButtonComponent,
  XDialogModule,
  XDialogService,
  XEmptyComponent,
  XIconComponent,
  XInputComponent,
  XInputGroupComponent,
  XKeywordDirective,
  XOrderBy
} from '@ng-nest/ui';
import { Prompt, PromptService } from '@ui/core';
import { PromptComponent } from './prompt';
import { MarkdownPipe } from '@ui/components';
import { debounceTime, distinctUntilChanged, fromEvent, Subject, Subscription, switchMap, takeUntil, tap } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-prompt-list',
  imports: [
    ReactiveFormsModule,
    XDialogModule,
    XButtonComponent,
    XIconComponent,
    XEmptyComponent,
    MarkdownPipe,
    XInputGroupComponent,
    XInputComponent,
    XKeywordDirective
  ],
  templateUrl: './prompt-list.html',
  styleUrl: './prompt-list.scss'
})
export class PromptList {
  formBuilder = inject(FormBuilder);
  dialogService = inject(XDialogService);
  service = inject(PromptService);
  inputSearch = viewChild<XInputComponent>('inputSearch');
  inputSearchChange = toObservable(this.inputSearch);
  inputKeydown: Subscription | null = null;
  loading = signal(false);
  keywordText = signal('');

  formGroup = this.formBuilder.group({
    value: ['']
  });

  promptList = signal<Prompt[]>([]);
  allPromptList = signal<Prompt[]>([]);

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
          let value = this.formGroup.controls.value.getRawValue();
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
            this.promptList.set(this.allPromptList());
          }

          return [];
        }),
        takeUntil(this.$destroy)
      )
      .subscribe((x) => {
        this.promptList.set(XOrderBy(x, ['createdAt'], ['desc']));
      });
  }

  getData() {
    this.service.getAll().subscribe((x) => {
      this.promptList.set(XOrderBy(x, ['createdAt'], ['desc']));
      this.allPromptList.set(this.promptList());
    });
  }

  addPrompt() {
    this.dialogService.create(PromptComponent, {
      width: '30rem',
      data: {
        saveSuccess: () => this.getData()
      }
    });
  }

  updatePrompt(item: Prompt) {
    this.dialogService.create(PromptComponent, {
      width: '30rem',
      data: {
        saveSuccess: () => this.getData(),
        id: item.id
      }
    });
  }
}
