import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  X_DIALOG_DATA,
  XButtonComponent,
  XDialogModule,
  XDialogRef,
  XInputComponent,
  XLoadingComponent,
  XMessageBoxService,
  XMessageService,
  XI18nPipe
} from '@ng-nest/ui';
import { Session, SessionService } from '@ui/core';
import { finalize, forkJoin, Observable, Subject, tap } from 'rxjs';

@Component({
  selector: 'app-session',
  imports: [ReactiveFormsModule, XInputComponent, XDialogModule, XButtonComponent, XLoadingComponent, XI18nPipe],
  templateUrl: './session.html',
  styleUrl: './session.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SessionComponent {
  data = inject<{ id: number; saveSuccess: (session: Session) => void }>(X_DIALOG_DATA);
  dialogRef = inject(XDialogRef<SessionComponent>);
  message = inject(XMessageService);
  messageBox = inject(XMessageBoxService);
  service = inject(SessionService);
  fb = inject(FormBuilder);
  id = signal<number | null>(null);

  formLoading = signal(false);
  saveLoading = signal(false);

  form: FormGroup<any> = this.fb.group({
    title: ['', [Validators.required]]
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
        this.data.saveSuccess(this.form.value);
      }),
      finalize(() => {
        this.saveLoading.set(false);
      })
    ).subscribe();
  }
}
