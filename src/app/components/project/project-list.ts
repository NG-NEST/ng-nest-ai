import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, model, output, signal } from '@angular/core';
import { XDropdownComponent, XDropdownNode } from '@ng-nest/ui/dropdown';
import { XIconComponent } from '@ng-nest/ui/icon';
import { XMessageBoxAction, XMessageBoxService } from '@ng-nest/ui/message-box';
import { Project, ProjectService } from '@ui/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { Project as ProjectComponent } from '../project/project';
import { XDialogService } from '@ng-nest/ui/dialog';
import { XI18nPipe, XRippleDirective } from '@ng-nest/ui';

@Component({
  selector: 'app-project-list',
  imports: [XIconComponent, XDropdownComponent, XRippleDirective, XI18nPipe],
  templateUrl: './project-list.html',
  styleUrl: './project-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectList {
  project = inject(ProjectService);
  messageBox = inject(XMessageBoxService);
  dialogService = inject(XDialogService);
  cdr = inject(ChangeDetectorRef);
  router = inject(Router);
  data = signal<Project[]>([]);
  page = signal(1);
  size = signal(10);
  toggle = signal(true);
  selectedItem = model<Project | null>(null);
  delete = output<number>();

  $destroy = new Subject<void>();

  ngOnInit() {
    this.getData();

    this.project.added.pipe(takeUntil(this.$destroy)).subscribe(() => {
      this.getData();
    });
  }

  ngOnDestroy(): void {
    this.$destroy.next();
    this.$destroy.complete();
  }

  getData() {
    this.project.getByPage(this.page(), this.size()).subscribe((result) => {
      this.data.set(result.data);
    });
  }

  onToggle() {
    this.toggle.update((x) => !x);
  }

  operation(event: XDropdownNode, item: Project) {
    const { id } = event;
    if (id === 'edit') {
      this.dialogService.create(ProjectComponent, {
        width: '30rem',
        data: {
          saveSuccess: (project: Project) => {
            Object.assign(item, project);
            this.cdr.markForCheck();
          },
          id: item.id
        }
      });
    } else if (id === 'delete') {
      this.messageBox.confirm({
        title: '删除项目',
        content: `确认删除此项目吗？ [${item.name}]`,
        type: 'warning',
        callback: (data: XMessageBoxAction) => {
          if (data !== 'confirm') return;
          this.project.delete(item.id!).subscribe((x) => {
            this.getData();

            this.delete.emit(item.id!);
          });
        }
      });
    }
  }

  itemClick(item: Project) {
    this.selectedItem.set(item);
    this.router.navigate(['/project-home'], { queryParams: { projectId: item.id } });
  }
}
