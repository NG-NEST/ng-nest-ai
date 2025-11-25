import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  X_DIALOG_DATA,
  XButtonComponent,
  XDialogModule,
  XDialogRef,
  XInputComponent,
  XLoadingComponent,
  XMessageBoxAction,
  XMessageBoxService,
  XMessageService,
  XRadioComponent,
  XSwitchComponent,
  XTabComponent,
  XTabsComponent,
  XTextareaComponent,
  XTableNoDataRow,
  XCheckboxComponent
} from '@ng-nest/ui';
import { EditorComponent } from '@ui/components';
import { ModelService } from '@ui/core';
import { finalize, forkJoin, Observable, Subject, tap } from 'rxjs';
@Component({
  selector: 'app-model',
  imports: [
    ReactiveFormsModule,
    XTextareaComponent,
    XInputComponent,
    XDialogModule,
    XButtonComponent,
    XLoadingComponent,
    XSwitchComponent,
    XRadioComponent,
    EditorComponent
  ],
  templateUrl: './model.html',
  styleUrl: './model.scss'
})
export class ModelComponent {
  data = inject<{ id: number; manufacturerId: number; saveSuccess: () => void }>(X_DIALOG_DATA);
  dialogRef = inject(XDialogRef<ModelComponent>);
  message = inject(XMessageService);
  messageBox = inject(XMessageBoxService);
  service = inject(ModelService);
  fb = inject(FormBuilder);
  id = signal<number | null>(null);

  formLoading = signal(false);
  saveLoading = signal(false);

  form: FormGroup<any> = this.fb.group({
    manufacturerId: [0, [Validators.required]],
    name: ['', [Validators.required]],
    code: ['', [Validators.required]],
    description: [''],
    isActive: [false, [Validators.required]],
    requestType: ['OpenAI', [Validators.required]],
    inputFunction: [''],
    outputFunction: ['']
  });

  $destroy = new Subject<void>();

  ngOnInit(): void {
    const { id, manufacturerId } = this.data;
    this.id.set(id);
    this.form.patchValue({ manufacturerId: manufacturerId });

    const req: Observable<any>[] = [];

    if (this.id()) {
      req.push(
        this.service.getById(this.id()!).pipe(
          tap((x) => {
            this.form.patchValue(x!);
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

  save() {
    let rq!: Observable<number>;
    if (!this.id()) {
      rq = this.service.create(this.form.value);
    } else {
      rq = this.service.update(this.id()!, { ...this.form.value });
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
      title: '删除模型',
      content: `确认删除此模型吗？ [${this.form.value.name}]`,
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
