import { Component, inject, signal } from '@angular/core';
import { Form, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
  XSwitchComponent
} from '@ng-nest/ui';
import { ManufacturerService } from '@ui/core';
import { finalize, forkJoin, Observable, Subject, tap } from 'rxjs';

@Component({
  selector: 'app-manufacturer',
  imports: [ReactiveFormsModule, XInputComponent, XDialogModule, XButtonComponent, XLoadingComponent, XSwitchComponent],
  templateUrl: './manufacturer.html',
  styleUrl: './manufacturer.scss'
})
export class ManufacturerComponent {
  data = inject<{ id: number; saveSuccess: () => void }>(X_DIALOG_DATA);
  dialogRef = inject(XDialogRef<ManufacturerComponent>);
  message = inject(XMessageService);
  messageBox = inject(XMessageBoxService);
  service = inject(ManufacturerService);
  fb = inject(FormBuilder);
  id = signal<number | null>(null);

  formLoading = signal(false);
  saveLoading = signal(false);

  form: FormGroup<any> = this.fb.group({
    name: ['', [Validators.required]],
    apiKey: ['', [Validators.required]],
    baseURL: ['', [Validators.required]],
    isActive: [false, [Validators.required]]
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
      title: '删除服务商',
      content: `确认删除此服务商吗？ [${this.form.value.name}]`,
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
