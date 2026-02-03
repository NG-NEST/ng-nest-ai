import { ChangeDetectionStrategy, Component, effect, inject, signal, viewChild } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
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
  XKeywordDirective,
  XTagComponent,
  XI18nPipe
} from '@ng-nest/ui';
import { ManufacturerService, Model, ModelService } from '@ui/core';
import { ModelComponent } from './model';
import { debounceTime, distinctUntilChanged, fromEvent, Subject, switchMap, takeUntil, tap } from 'rxjs';
import { form, FormField } from '@angular/forms/signals';

@Component({
  selector: 'app-model-list',
  imports: [
    XDialogModule,
    XButtonComponent,
    XIconComponent,
    XEmptyComponent,
    XSelectComponent,
    XInputGroupComponent,
    XInputComponent,
    XKeywordDirective,
    XTagComponent,
    XI18nPipe,
    FormField
],
  templateUrl: './model-list.html',
  styleUrl: './model-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModelList {
  dialogService = inject(XDialogService);
  service = inject(ModelService);
  manufacturerService = inject(ManufacturerService);
  manufacturerList = signal<XSelectNode[]>([]);
  inputSearch = viewChild<XInputComponent>('inputSearch');
  inputSearchChange = toObservable(this.inputSearch);
  loading = signal(false);
  keywordText = signal('');

  model = signal({
    manufacturerId: null,
    value: ''
  });
  formGroup = form(this.model);

  modelList = signal<Model[]>([]);
  allModelList = signal<Model[]>([]);

  $destroy = new Subject<void>();

  constructor() {
    effect(() => {
      const manufacturerId = this.formGroup.manufacturerId().value();
      if (manufacturerId) {
        this.keywordText.set('');
        this.formGroup.value().value.set('');
        this.getData();
      }
    });
  }

  ngOnInit() {
    this.manufacturerService.getAll().subscribe((x) => {
      const list = x.map((y) => ({ id: y.id, label: y.name, isActive: y.isActive, createdAt: y.createdAt }));
      this.manufacturerList.set(XOrderBy(list, ['isActive', 'createdAt'], ['desc', 'desc']));
      if (this.manufacturerList().length > 0) {
        this.formGroup.manufacturerId().value.set(this.manufacturerList()[0].id);
        this.getData();
      }
    });
  }

  ngOnDestroy(): void {
    this.$destroy.next();
    this.$destroy.complete();
  }

  ngAfterViewInit() {
    this.setInputSearch();
  }

  setInputSearch() {
    const inputElement = this.inputSearch()!.inputRef().nativeElement;
    fromEvent<KeyboardEvent>(inputElement, 'keydown')
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((_event: KeyboardEvent) => {
          let { value, manufacturerId } = this.formGroup().value();
          if (manufacturerId && value && value.trim().length > 0) {
            value = value.trim();
            this.loading.set(true);
            this.keywordText.set(value);
            return this.service.getListByManufacturerAndNameOrCode(manufacturerId!, value).pipe(
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
    this.service.getListByManufacturerId(this.formGroup.manufacturerId().value()!).subscribe((x) => {
      this.modelList.set(XOrderBy(x, ['isActive', 'createdAt'], ['desc', 'desc']));
      this.allModelList.set(this.modelList());
    });
  }

  addModel() {
    this.dialogService.create(ModelComponent, {
      width: '36rem',
      data: {
        saveSuccess: () => this.getData(),
        manufacturerId: this.formGroup.manufacturerId().value()
      }
    });
  }

  updateModel(item: Model) {
    this.dialogService.create(ModelComponent, {
      width: '36rem',
      data: {
        saveSuccess: () => this.getData(),
        id: item.id,
        manufacturerId: this.formGroup.manufacturerId().value()
      }
    });
  }
}
