import { Component, HostBinding, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { XScrollableComponent } from '@ng-nest/ui/scrollable';
import { XButtonComponent } from '@ng-nest/ui/button';
import { XDialogService } from '@ng-nest/ui/dialog';
import { XMenuNode } from '@ng-nest/ui/menu';
import { AppConfigService, ProjectService, Project, Session, SessionService } from '@ui/core';
import {
  History,
  ModelSwitchComponent,
  Project as ProjectComponent,
  ProjectList,
  Search,
  Settings
} from '@ui/components';
import { AppMenus } from '../app-menus';
import { XIconComponent } from '@ng-nest/ui/icon';
import { merge } from 'rxjs';
import { XRippleDirective } from '@ng-nest/ui';

// 扩展全局 Window 接口以包含你的 API
declare global {
  interface Window {
    electronAPI: any; // 这里的 any 应该替换为你 preload 中定义的精确接口
  }
}

@Component({
  selector: 'app-layout',
  imports: [
    RouterOutlet,
    XButtonComponent,
    XIconComponent,
    XScrollableComponent,
    XRippleDirective,
    ModelSwitchComponent,
    ProjectList,
    History
  ],
  templateUrl: './layout.html',
  styleUrl: './layout.scss'
})
export class Layout {
  dialogService = inject(XDialogService);
  config = inject(AppConfigService);
  sessionService = inject(SessionService);
  projectService = inject(ProjectService);
  router = inject(Router);
  visible = signal(false);
  isMaximized = signal(false);
  menuData = signal<XMenuNode[]>(AppMenus);
  selectedItem = signal<Session | Project | null>(null);
  sessionCount = signal(0);
  projectCount = signal(0);

  @HostBinding('class.collapsed') get collapsed() {
    return this.config.collapsed();
  }

  ngOnInit() {
    this.getProjectCount();
    this.getSeesionCount();
    merge(this.sessionService.added, this.sessionService.deleted).subscribe(() => {
      this.getSeesionCount();
    });
    merge(this.projectService.added, this.projectService.deleted).subscribe(() => {
      this.getProjectCount();
    });
  }

  ngAfterViewInit() {
    this.isMaximized.set(window.electronAPI.windowControls.isMaximized());
  }

  switchDevTools() {
    window.electronAPI.windowControls.openDevTools();
  }

  minimize() {
    window.electronAPI.windowControls.minimize();
    this.isMaximized.set(false);
  }

  maximize() {
    window.electronAPI.windowControls.maximize();
    this.isMaximized.set(true);
  }

  close() {
    window.electronAPI.windowControls.close();
  }

  unmaximize() {
    window.electronAPI.windowControls.unmaximize();
    this.isMaximized.set(false);
  }

  refresh() {
    window.electronAPI.windowControls.reloadPage();
  }

  onCollapsed() {
    this.config.collapsed.update((x) => !x);
  }

  settings() {
    this.dialogService.create(Settings, {
      className: 'app-no-padding-dialog',
      width: '40rem'
    });
  }

  menuClick(menu: XMenuNode) {
    if (menu.id === 'coversation') {
      this.selectedItem.set(null);
    }
    if (menu.id === 'search') {
      this.createSearch();
      return;
    }
    if (menu.id === 'project') {
      this.createProject();
      return;
    }
    this.router.navigate([menu.routerLink]);
  }

  onHistoryDeleteItem(id: number) {
    if (id === this.selectedItem()?.id) {
      this.router.navigate(['./coversation']);
    }
  }

  onProjectDeleteItem(id: number) {
    if (id === this.selectedItem()?.id) {
      this.router.navigate(['./coversation']);
    }
  }

  createSearch() {
    this.dialogService.create(Search, {
      className: 'app-no-padding-dialog',
      width: '36rem'
    });
  }

  createProject() {
    this.dialogService.create(ProjectComponent, {
      width: '30rem',
      data: {
        saveSuccess: (project: Project) => {
          this.selectedItem.set(project);
          this.router.navigate([`./project-home`], { queryParams: { projectId: project.id } });
        }
      }
    });
  }

  getSeesionCount() {
    this.sessionService.count().subscribe((count) => {
      this.sessionCount.set(count);
    });
  }

  getProjectCount() {
    this.projectService.count().subscribe((count) => {
      this.projectCount.set(count);
    });
  }
}
