import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  XButtonComponent,
  XDialogModule,
  XDialogRef,
  XEmptyComponent,
  XGroupBy,
  XI18nPipe,
  XIconComponent,
  XInputComponent,
  XKeywordDirective,
  XListComponent,
  XListNode,
  XLoadingComponent,
  XOrderBy,
  XTagComponent
} from '@ng-nest/ui';
import { Manufacturer, ManufacturerService, Model, ModelService, SessionService } from '@ui/core';
import {
  debounceTime,
  delay,
  distinctUntilChanged,
  finalize,
  fromEvent,
  map,
  of,
  Subject,
  switchMap,
  takeUntil,
  tap
} from 'rxjs';

@Component({
  selector: 'app-model-switch-box',
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
    XTagComponent,
    XI18nPipe
  ],
  templateUrl: './model-switch-box.html',
  styleUrl: './model-switch-box.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModelSwitchBoxComponent {
  dialogRef = inject(XDialogRef<ModelSwitchBoxComponent>);
  manufacturerService = inject(ManufacturerService);
  modelService = inject(ModelService);
  iconCopy = signal('fto-copy');

  input = viewChild.required(XInputComponent);
  formBuilder = inject(FormBuilder);
  router = inject(Router);
  form = this.formBuilder.group({
    title: [''],
    manufacturerId: [0, [Validators.required]],
    modelId: [0, [Validators.required]]
  });
  loading = signal(false);
  saveLoading = signal(false);
  data = signal<XListNode[]>([]);
  keywordText = signal('');
  selectedManufacturer = signal<Manufacturer | null>(null);
  selectedModel = signal<Model | null>(null);
  manufacturerList = signal<Manufacturer[]>([]);
  modelList = signal<Model[]>([]);

  $destroy = new Subject<void>();

  ngOnInit() {
    this.getRelationData();
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
            return this.modelService.getListByNameOrCode(value).pipe(
              map((models: Model[]) => XGroupBy(models, 'manufacturerId')),
              switchMap((group) => {
                const ids = Object.keys(group).map((key) => Number(key));

                return this.manufacturerService.getByIds(ids).pipe(
                  tap((x) => {
                    this.manufacturerList.set(XOrderBy(x, ['isActive'], ['desc']));
                  })
                );
              }),
              finalize(() => {
                this.loading.set(false);
              })
            );
          } else {
            this.keywordText.set('');
            this.getRelationData();
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

  getRelationData() {
    this.manufacturerService.getAll().subscribe(async (x) => {
      this.manufacturerList.set(XOrderBy(x, ['isActive'], ['desc']));
      if (this.manufacturerList().length > 0) {
        const first = this.manufacturerList()[0];
        this.selectedManufacturer.set(first);
        this.form.patchValue({ manufacturerId: first.id });
        this.getModelList(this.selectedManufacturer()!);
      }
    });
  }

  getModelList(manufacturer: Manufacturer) {
    if (!manufacturer) {
      return;
    }
    this.modelService.getListByManufacturerId(manufacturer.id!).subscribe((x) => {
      this.modelList.set(XOrderBy(x, ['isActive'], ['desc']));
      if (this.modelList().length > 0) {
        const first = this.modelList()[0];
        this.selectedModel.set(first);
        this.form.patchValue({ modelId: first.id });
      }
    });
  }

  manufacturerClick(manufacturer: Manufacturer) {
    this.selectedManufacturer.set(manufacturer);
    this.form.patchValue({ manufacturerId: manufacturer.id });
    this.getModelList(manufacturer);
  }

  modelClick(model: Model) {
    this.selectedModel.set(model);
    this.form.patchValue({ modelId: model.id });
  }

  save() {
    this.saveLoading.set(true);
    this.manufacturerService
      .setActive(this.selectedManufacturer()!.id!)
      .pipe(switchMap(() => this.modelService.setActive(this.selectedModel()!.id!, this.selectedManufacturer()!.id!)))
      .pipe(
        tap(() => {
          this.dialogRef.close();
        }),
        finalize(() => {
          this.saveLoading.set(false);
        })
      )
      .subscribe();
  }

  async onCopy(event: Event, model: Model & { $icon: string }) {
    event.stopPropagation();
    model.$icon = 'fto-check';
    await navigator.clipboard.writeText(model.code!);
    of(true)
      .pipe(delay(2000))
      .subscribe(() => {
        model.$icon = 'fto-copy';
      });
  }
}
