import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import {
  X_DIALOG_DATA,
  XButtonComponent,
  XDialogModule,
  XDialogRef,
  XEmptyComponent,
  XIconComponent,
  XInputComponent,
  XKeywordDirective,
  XListComponent,
  XLoadingComponent,
  XI18nPipe
} from '@ng-nest/ui';
import { Prompt, PromptService } from '@ui/core';
import { debounceTime, distinctUntilChanged, finalize, fromEvent, of, Subject, switchMap, takeUntil, tap } from 'rxjs';
import { MarkdownPipe } from '../markdown/markdown.pipe';
import { form, required, FormField } from '@angular/forms/signals';

@Component({
  selector: 'app-rule',
  imports: [
    XDialogModule,
    XButtonComponent,
    XIconComponent,
    XInputComponent,
    XLoadingComponent,
    XEmptyComponent,
    XListComponent,
    XKeywordDirective,
    XI18nPipe,
    MarkdownPipe,
    FormField
  ],
  templateUrl: './rule.html',
  styleUrl: './rule.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RuleComponent {
  dialogRef = inject(XDialogRef<RuleComponent>);
  data = inject<{ promptId?: number; disabled?: boolean; save: (prompt: Prompt) => void }>(X_DIALOG_DATA);
  promptService = inject(PromptService);
  iconCopy = signal('fto-copy');

  input = viewChild.required(XInputComponent);
  router = inject(Router);
  model = signal({
    title: '',
    promptId: 0
  });
  form = form(this.model, (schema) => {
    required(schema.promptId);
  });
  loading = signal(false);
  saveLoading = signal(false);
  keywordText = signal('');
  selectedPrompt = signal<Prompt | null>(null);
  promptList = signal<Prompt[]>([]);
  allPromptList = signal<Prompt[]>([]);

  disabled = signal(false);

  $destroy = new Subject<void>();

  ngOnInit() {
    if (this.data.promptId) {
      this.form.promptId().value.set(this.data.promptId);
    }
    this.disabled.set(this.data.disabled!);
    this.getPromptList();
  }

  ngAfterViewInit() {
    this.input().inputFocus();

    const inputElement = this.input().inputRef().nativeElement;
    fromEvent<KeyboardEvent>(inputElement, 'keydown')
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((_event: KeyboardEvent) => {
          let value = this.form.title().value();
          if (value && value.trim().length > 0) {
            value = value.trim();
            this.loading.set(true);
            this.keywordText.set(value);
            return this.promptService.getListByNameOrContent(value).pipe(
              tap((prompts: Prompt[]) => {
                this.promptList.set(prompts);
              }),
              finalize(() => {
                this.loading.set(false);
              })
            );
          } else {
            this.keywordText.set('');
            this.promptList.set(this.allPromptList());
          }
          return of([]);
        }),
        takeUntil(this.$destroy)
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.$destroy.next();
    this.$destroy.complete();
  }

  getPromptList() {
    if (this.disabled()) {
      this.promptService.getById(this.form.promptId().value()).subscribe((x) => {
        this.selectedPrompt.set(x!);
      });
    } else {
      this.promptService.getAll().subscribe((x) => {
        this.promptList.set(x);
        this.allPromptList.set(x);

        if (this.form.promptId().value() > 0) {
          this.selectedPrompt.set(this.promptList().find((y: any) => y.id === this.form.promptId().value())!);
        }
      });
    }
  }

  promptClick(prompt: Prompt) {
    this.selectedPrompt.set(prompt);
    this.form.promptId().value.set(prompt.id!);
  }

  save() {
    !this.selectedPrompt();
    this.data.save(this.selectedPrompt()!);
    this.dialogRef.close();
  }
}
