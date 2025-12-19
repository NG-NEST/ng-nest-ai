import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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

@Component({
  selector: 'app-rule',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    XDialogModule,
    XButtonComponent,
    XIconComponent,
    XInputComponent,
    XLoadingComponent,
    XEmptyComponent,
    XListComponent,
    XKeywordDirective,
    XI18nPipe,
    MarkdownPipe
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
  formBuilder = inject(FormBuilder);
  router = inject(Router);
  form = this.formBuilder.group({
    title: [''],
    promptId: [0, [Validators.required]]
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
      this.form.patchValue({
        promptId: this.data.promptId
      });
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
          let value = this.form.controls.title.value;
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
      this.promptService.getById(this.form.value.promptId!).subscribe((x) => {
        this.selectedPrompt.set(x!);
      });
    } else {
      this.promptService.getAll().subscribe((x) => {
        this.promptList.set(x);
        this.allPromptList.set(x);

        if (this.form.value.promptId! > 0) {
          this.selectedPrompt.set(this.promptList().find((y: any) => y.id === this.form.value.promptId)!);
        }
      });
    }
  }

  promptClick(prompt: Prompt) {
    this.selectedPrompt.set(prompt);
    this.form.patchValue({ promptId: prompt.id });
  }

  save() {
    !this.selectedPrompt();
    this.data.save(this.selectedPrompt()!);
    this.dialogRef.close();
  }
}
