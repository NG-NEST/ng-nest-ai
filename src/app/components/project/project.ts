import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  X_DIALOG_DATA,
  XButtonComponent,
  XDialogModule,
  XDialogRef,
  XIconComponent,
  XInputComponent,
  XInputGroupComponent,
  XLoadingComponent,
  XMessageBoxAction,
  XMessageBoxService,
  XMessageService,
  XPopoverDirective
} from '@ng-nest/ui';
import { ProjectService } from '@ui/core';
import { finalize, forkJoin, Observable, Subject, tap } from 'rxjs';

@Component({
  selector: 'app-project',
  imports: [
    ReactiveFormsModule,
    XInputComponent,
    XInputGroupComponent,
    XDialogModule,
    XButtonComponent,
    XLoadingComponent,
    XPopoverDirective,
    XIconComponent
  ],
  templateUrl: './project.html',
  styleUrl: './project.scss'
})
export class Project {
  data = inject<{ id: number; saveSuccess: (project: Project) => void }>(X_DIALOG_DATA);
  dialogRef = inject(XDialogRef<Project>);
  message = inject(XMessageService);
  messageBox = inject(XMessageBoxService);
  service = inject(ProjectService);
  fb = inject(FormBuilder);
  id = signal<number | null>(null);
  visible = signal(false);

  formLoading = signal(false);
  saveLoading = signal(false);

  form: FormGroup<any> = this.fb.group({
    name: ['', [Validators.required]],
    icon: ['fto-folder'],
    iconColor: ['var(--x-text)']
  });

  colors = signal(['var(--x-text)', '#fa423e', '#fb6a22', '#ffc300', '#04b84c', '#0285ff', '#924ff7', '#ff66ad']);
  icons = signal([
    'fto-folder',
    'fto-award',
    'fto-bold',
    'fto-anchor',
    'fto-book',
    'fto-bookmark',
    'fto-camera',
    'fto-chrome',
    'fto-clipboard',
    'fto-cloud',
    'fto-coffee',
    'fto-compass',
    'fto-cpu',
    'fto-feather',
    'fto-film',
    'fto-gift',
    'fto-github',
    'fto-headphones',
    'fto-heart',
    'fto-hexagon',
    'fto-inbox',
    'fto-key',
    'fto-life-buoy',
    'fto-lock',
    'fto-music',
    'fto-package',
    'fto-percent',
    'fto-pie-chart',
    'fto-play',
    'fto-shield',
    'fto-user',
    'fto-users',
    'fto-truck',
    'fto-dollar-sign',
    'fto-layers',
    'fto-link',
    'fto-map-pin',
    'fto-smile',
    'fto-meh',
    'fto-frown'
  ]);

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
      tap((x) => {
        this.dialogRef.close();
        this.data.saveSuccess({ ...this.form.value, id: this.id() ?? x });
      }),
      finalize(() => {
        this.saveLoading.set(false);
      })
    ).subscribe();
  }

  delete() {
    this.messageBox.confirm({
      title: '删除项目',
      content: `确认删除此项目吗？ [${this.form.value.name}]`,
      type: 'warning',
      callback: (data: XMessageBoxAction) => {
        if (data !== 'confirm') return;
        this.service.delete(this.id()!).subscribe((x) => {
          this.dialogRef.close();
          this.data.saveSuccess(this.form.value);
        });
      }
    });
  }

  setIconColor(iconColor: string) {
    this.form.patchValue({ iconColor });
  }

  setIcon(icon: string) {
    this.form.patchValue({ icon });
  }
}
