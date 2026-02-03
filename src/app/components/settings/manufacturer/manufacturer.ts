import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { form, required, FormField } from '@angular/forms/signals';
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
  XSwitchComponent,
  XI18nPipe,
  XI18nService
} from '@ng-nest/ui';
import { ManufacturerService } from '@ui/core';
import { finalize, forkJoin, Observable, Subject, tap } from 'rxjs';

@Component({
  selector: 'app-manufacturer',
  imports: [
    XInputComponent,
    XDialogModule,
    XButtonComponent,
    XLoadingComponent,
    XSwitchComponent,
    XI18nPipe,
    FormField
  ],
  templateUrl: './manufacturer.html',
  styleUrl: './manufacturer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ManufacturerComponent {
  data = inject<{ id: number; saveSuccess: () => void }>(X_DIALOG_DATA);
  dialogRef = inject(XDialogRef<ManufacturerComponent>);
  message = inject(XMessageService);
  messageBox = inject(XMessageBoxService);
  service = inject(ManufacturerService);
  i18n = inject(XI18nService);
  id = signal<number | null>(null);

  formLoading = signal(false);
  saveLoading = signal(false);

  model = signal({
    name: '',
    apiKey: '',
    baseURL: '',
    isActive: false
  });
  form = form(this.model, (schema) => {
    required(schema.name);
    required(schema.apiKey);
    required(schema.baseURL);
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
            this.form().value.set(x!);
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

  save(event: Event) {
    event.preventDefault();
    let rq!: Observable<number>;
    if (!this.id()) {
      rq = this.service.create(this.form().value());
    } else {
      rq = this.service.update(this.id()!, { ...this.form().value() });
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
      title: this.i18n.L('$manufacturer.deleteManufacturer'),
      content: `${this.i18n.L('$manufacturer.sureDeleteManufacturer')} [${this.form.name().value()}]`,
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
