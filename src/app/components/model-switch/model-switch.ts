import { Component, computed, inject, signal } from '@angular/core';
import { XButtonComponent } from '@ng-nest/ui';
import { XDialogService } from '@ng-nest/ui/dialog';
import { Subject } from 'rxjs';
import { ModelSwitchBoxComponent } from './model-switch-box';
import { Manufacturer, ManufacturerService, Model, ModelService } from '@ui/core';

@Component({
  selector: 'app-model-switch',
  imports: [XButtonComponent],
  templateUrl: './model-switch.html',
  styleUrl: './model-switch.scss'
})
export class ModelSwitchComponent {
  dialogService = inject(XDialogService);
  manufacturerService = inject(ManufacturerService);
  modelService = inject(ModelService);
  model = computed(() => `${this.activeManufacturer()?.name}-${this.activeModel()?.name}`);

  activeManufacturer = signal<Manufacturer | null>(null);
  activeModel = signal<Model | null>(null);

  $destroy = new Subject<void>();

  ngOnInit(): void {
    this.manufacturerService.getActive().subscribe((x) => {
      this.setActiveManufacturer(x!);
    });
    this.manufacturerService.activeChange.subscribe((x) => {
      this.setActiveManufacturer(x!);
    });
    this.modelService.activeChange.subscribe((x) => {
      if (!x) return;
      if (x?.manufacturerId === this.activeManufacturer()?.id) {
        this.activeModel.set(x);
      }
    });
  }

  ngOnDestroy(): void {
    this.$destroy.next();
    this.$destroy.complete();
  }

  setActiveManufacturer(manufacturer: Manufacturer) {
    if (!manufacturer) return;
    this.activeManufacturer.set(manufacturer!);
    this.modelService.getActive(manufacturer!.id!).subscribe((model) => {
      if (!model) return;
      this.activeModel.set(model!);
    });
  }

  showBox() {
    this.dialogService.create(ModelSwitchBoxComponent, { className: 'app-no-padding-dialog', width: '40rem' });
  }
}
