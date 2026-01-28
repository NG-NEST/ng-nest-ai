import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  X_DIALOG_DATA,
  XButtonComponent,
  XDialogModule,
  XDialogRef,
  XI18nPipe,
  XI18nService,
  XInputComponent,
  XLoadingComponent,
  XMessageBoxAction,
  XMessageBoxService,
  XMessageService,
  XTextareaComponent
} from '@ng-nest/ui';
import { EditorComponent } from '@ui/components';
import { Prompt, PromptService } from '@ui/core';
import { finalize, forkJoin, Observable, Subject, tap } from 'rxjs';

import { form, required, FormField } from '@angular/forms/signals';

@Component({
  selector: 'app-prompt',
  imports: [
    XInputComponent,
    XDialogModule,
    XButtonComponent,
    XLoadingComponent,
    XTextareaComponent,
    XI18nPipe,
    EditorComponent,
    FormField
  ],
  templateUrl: './prompt.html',
  styleUrl: './prompt.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PromptComponent {
  data = inject<{ id: number; saveSuccess: () => void }>(X_DIALOG_DATA);
  dialogRef = inject(XDialogRef<PromptComponent>);
  i18n = inject(XI18nService);
  message = inject(XMessageService);
  messageBox = inject(XMessageBoxService);
  service = inject(PromptService);
  id = signal<number | null>(null);

  formLoading = signal(false);
  saveLoading = signal(false);

  model = signal<Prompt>({
    name: '',
    content: '',
    description: ''
  });
  form = form(this.model, (schema) => {
    required(schema.name);
    required(schema.content);
  });

  $destroy = new Subject<void>();

  ngOnInit(): void {
    const { id } = this.data;
    this.id.set(id);

    const req: Observable<any>[] = [];

    if (this.id()) {
      req.push(
        this.service.getById(this.id()!).pipe(
          tap((x) => {
            this.model.set(x!);
          })
        )
      );
    }
    if (req.length > 0) {
      this.formLoading.set(true);
      forkJoin(req)
        .pipe(finalize(() => this.formLoading.set(false)))
        .subscribe();
    }
  }

  ngOnDestroy(): void {
    this.$destroy.next();
    this.$destroy.complete();
  }

  save(event?: Event) {
    event?.preventDefault();
    let rq!: Observable<number>;
    if (!this.id()) {
      rq = this.service.create(this.model());
    } else {
      rq = this.service.update(this.id()!, { ...this.model() });
    }
    this.saveLoading.set(true);
    rq.pipe(
      tap(() => {
        this.dialogRef.close();
        this.data.saveSuccess();
      }),
      finalize(() => {
        this.saveLoading.set(false);
      })
    ).subscribe();
  }

  delete() {
    this.messageBox.confirm({
      title: this.i18n.L('$prompt.deletePrompt'),
      content: `${this.i18n.L('$prompt.sureDeletePrompt')} [${this.form.name().value()}]`,
      type: 'warning',
      callback: (data: XMessageBoxAction) => {
        if (data !== 'confirm') return;
        this.service.delete(this.id()!).subscribe((x) => {
          this.dialogRef.close();
          this.data.saveSuccess();
        });
      }
    });
  }
}
