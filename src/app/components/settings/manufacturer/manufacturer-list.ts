import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  XButtonComponent,
  XDialogModule,
  XDialogService,
  XEmptyComponent,
  XIconComponent,
  XScrollableComponent
} from '@ng-nest/ui';
import { Manufacturer, ManufacturerService } from '@ui/core';
import { ManufacturerComponent } from './manufacturer';

@Component({
  selector: 'app-manufacturer-list',
  imports: [
    ReactiveFormsModule,
    XDialogModule,
    XButtonComponent,
    XIconComponent,
    XEmptyComponent,
    XScrollableComponent
  ],
  templateUrl: './manufacturer-list.html',
  styleUrl: './manufacturer-list.scss'
})
export class ManufacturerList {
  formBuilder = inject(FormBuilder);
  dialogService = inject(XDialogService);
  service = inject(ManufacturerService);
  selectedIndex = signal(0);
  menus = [
    { label: '服务商', icon: 'icon:manufacturer' },
    { label: '模型', icon: 'icon:model' },
    { label: '关于', icon: 'icon:about' }
  ];

  formGroup = this.formBuilder.group({});

  manufacturerList = signal<Manufacturer[]>([]);
  ngOnInit() {
    this.getData();
  }

  getData() {
    this.service.getAll().subscribe((x) => {
      this.manufacturerList.set(x);
    });
  }

  selectMenu(index: number) {
    this.selectedIndex.set(index);
  }

  addManufacturer() {
    this.dialogService.create(ManufacturerComponent, {
      width: '30rem',
      data: {
        saveSuccess: () => this.getData()
      }
    });
  }

  updateManufacturer(item: Manufacturer) {
    this.dialogService.create(ManufacturerComponent, {
      width: '30rem',
      data: {
        saveSuccess: () => this.getData(),
        id: item.id
      }
    });
  }
}
