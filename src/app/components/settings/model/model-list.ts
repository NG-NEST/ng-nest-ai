import { Component, inject, signal, viewChild } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  XButtonComponent,
  XDialogModule,
  XDialogService,
  XEmptyComponent,
  XIconComponent,
  XOrderBy,
  XSelectComponent,
  XSelectNode,
  XInputGroupComponent,
  XInputComponent,
  XKeywordDirective
} from '@ng-nest/ui';
import { ManufacturerService, Model, ModelService } from '@ui/core';
import { ModelComponent } from './model';
import { debounceTime, distinctUntilChanged, fromEvent, Subject, Subscription, switchMap, takeUntil, tap } from 'rxjs';

@Component({
  selector: 'app-model-list',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    XDialogModule,
    XButtonComponent,
    XIconComponent,
    XEmptyComponent,
    XSelectComponent,
    XInputGroupComponent,
    XInputComponent,
    XKeywordDirective
  ],
  templateUrl: './model-list.html',
  styleUrl: './model-list.scss'
})
export class ModelList {
  formBuilder = inject(FormBuilder);
  dialogService = inject(XDialogService);
  service = inject(ModelService);
  manufacturerService = inject(ManufacturerService);
  manufacturerList = signal<XSelectNode[]>([]);
  inputSearch = viewChild<XInputComponent>('inputSearch');
  inputSearchChange = toObservable(this.inputSearch);
  inputKeydown: Subscription | null = null;
  loading = signal(false);
  keywordText = signal('');

  formGroup = this.formBuilder.group({
    manufacturerId: [],
    value: ['']
  });

  modelList = signal<Model[]>([]);
  allModelList = signal<Model[]>([]);

  $destroy = new Subject<void>();
  ngOnInit() {
    this.manufacturerService.getAll().subscribe((x) => {
      const list = x.map((y) => ({ id: y.id, label: y.name, isActive: y.isActive, createdAt: y.createdAt }));
      this.manufacturerList.set(XOrderBy(list, ['isActive', 'createdAt'], ['desc', 'desc']));
      if (this.manufacturerList().length > 0) {
        this.formGroup.patchValue({ manufacturerId: this.manufacturerList()[0].id });
        this.getData();
      }
    });
    this.inputSearchChange.pipe(takeUntil(this.$destroy)).subscribe((x) => {
      if (this.inputSearch()) {
        this.inputKeydown?.unsubscribe();
        this.setInputSearch();
      }
    });
    this.formGroup.controls.manufacturerId.valueChanges.subscribe((x) => {
      if (x) {
        this.formGroup.patchValue({ value: '' });
        this.getData();
      }
    });
  }

  ngOnDestroy(): void {
    this.$destroy.next();
    this.$destroy.complete();
  }

  setInputSearch() {
    if (!this.inputSearch() || !this.formGroup.getRawValue().manufacturerId) return;
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
            return this.service
              .getListByManufacturerAndNameOrCode(this.formGroup.getRawValue().manufacturerId!, value)
              .pipe(
                tap(() => {
                  this.loading.set(false);
                })
              );
          } else {
            this.keywordText.set('');
            this.modelList.set(this.allModelList());
          }

          return [];
        }),
        takeUntil(this.$destroy)
      )
      .subscribe((x) => {
        this.modelList.set(XOrderBy(x, ['isActive', 'createdAt'], ['desc', 'desc']));
      });
  }

  getData() {
    this.service.getListByManufacturerId(this.formGroup.getRawValue().manufacturerId!).subscribe((x) => {
      this.modelList.set(XOrderBy(x, ['isActive', 'createdAt'], ['desc', 'desc']));
      this.allModelList.set(this.modelList());
    });
  }

  addModel() {
    this.dialogService.create(ModelComponent, {
      width: '36rem',
      data: {
        saveSuccess: () => this.getData(),
        manufacturerId: this.formGroup.getRawValue().manufacturerId!
      }
    });
  }

  updateModel(item: Model) {
    this.dialogService.create(ModelComponent, {
      width: '36rem',
      data: {
        saveSuccess: () => this.getData(),
        id: item.id,
        manufacturerId: this.formGroup.getRawValue().manufacturerId!
      }
    });
  }
}
