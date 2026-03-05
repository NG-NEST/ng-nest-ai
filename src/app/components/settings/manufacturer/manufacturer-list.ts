import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  XButtonComponent,
  XDialogModule,
  XDialogService,
  XEmptyComponent,
  XIconComponent,
  XOrderBy,
  XI18nPipe
} from '@ng-nest/ui';
import { Manufacturer, ManufacturerService } from '@ui/core';
import { ManufacturerComponent } from './manufacturer';

@Component({
  selector: 'app-manufacturer-list',
  imports: [XDialogModule, XButtonComponent, XIconComponent, XEmptyComponent, XI18nPipe],
  templateUrl: './manufacturer-list.html',
  styleUrl: './manufacturer-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ManufacturerList {
  dialogService = inject(XDialogService);
  service = inject(ManufacturerService);

  manufacturerList = signal<Manufacturer[]>([]);
  ngOnInit() {
    this.getData();
  }

  getData() {
    this.service.getAll().subscribe((x) => {
      this.manufacturerList.set(XOrderBy(x, ['isActive', 'createdAt'], ['desc', 'desc']));
    });
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
