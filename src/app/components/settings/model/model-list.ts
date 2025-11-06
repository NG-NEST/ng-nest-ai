import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  XButtonComponent,
  XDialogModule,
  XDialogService,
  XEmptyComponent,
  XIconComponent,
  XOrderBy,
  XSelectComponent,
  XSelectNode
} from '@ng-nest/ui';
import { ManufacturerService, Model, ModelService } from '@ui/core';
import { ModelComponent } from './model';

@Component({
  selector: 'app-model-list',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    XDialogModule,
    XButtonComponent,
    XIconComponent,
    XEmptyComponent,
    XSelectComponent
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
  manufacturerId = signal<number | null>(null);

  formGroup = this.formBuilder.group({});

  modelList = signal<Model[]>([]);
  ngOnInit() {
    this.manufacturerService.getAll().subscribe((x) => {
      const list = x.map((y) => ({ id: y.id, label: y.name, isActive: y.isActive, createdAt: y.createdAt }));
      this.manufacturerList.set(XOrderBy(list, ['isActive', 'createdAt'], ['desc', 'desc']));
      if (this.manufacturerList().length > 0) {
        this.manufacturerId.set(this.manufacturerList()[0].id);
        this.getData();
      }
    });
  }

  getData() {
    this.service.getListByManufacturerId(this.manufacturerId()!).subscribe((x) => {
      this.modelList.set(XOrderBy(x, ['isActive', 'createdAt'], ['desc', 'desc']));
    });
  }

  addModel() {
    this.dialogService.create(ModelComponent, {
      width: '30rem',
      data: {
        saveSuccess: () => this.getData(),
        manufacturerId: this.manufacturerId()
      }
    });
  }

  updateModel(item: Model) {
    this.dialogService.create(ModelComponent, {
      width: '30rem',
      data: {
        saveSuccess: () => this.getData(),
        id: item.id,
        manufacturerId: this.manufacturerId()
      }
    });
  }
}
