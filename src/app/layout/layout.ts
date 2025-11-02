import { Component, Host, HostBinding, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { XScrollableComponent } from '@ng-nest/ui/scrollable';
import { XButtonComponent } from '@ng-nest/ui/button';
import { XDialogService } from '@ng-nest/ui/dialog';
import { XMenuComponent, XMenuNode } from '@ng-nest/ui/menu';
import { AppConfigService } from '@ui/core';
import { Settings } from '@ui/components';
import { AppMenus } from '../app-menus';

// 扩展全局 Window 接口以包含你的 API
declare global {
  interface Window {
    electronAPI: any; // 这里的 any 应该替换为你 preload 中定义的精确接口
  }
}

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, XButtonComponent, XMenuComponent, XScrollableComponent],
  templateUrl: './layout.html',
  styleUrl: './layout.scss'
})
export class Layout {
  dialogService = inject(XDialogService);
  config = inject(AppConfigService);
  router = inject(Router);
  visible = signal(false);
  isMaximized = signal(false);
  menuData = signal<XMenuNode[]>(AppMenus);

  @HostBinding('class.collapsed') get collapsed() {
    return this.config.collapsed();
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
      width: '36rem'
    });
  }

  newCoversation() {}
}
