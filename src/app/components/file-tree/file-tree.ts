import { Component, input, signal, inject, ChangeDetectorRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Tree, TreeItem, TreeItemGroup } from '@angular/aria/tree';
import { FileNode } from './file-tree.types';
import { XIconComponent } from '@ng-nest/ui/icon';
import { AppFileIconPipe } from './file-icon.pipe';
import { FileTreeService } from './file-tree.service';
import { CdkContextMenuTrigger, CdkMenu, CdkMenuItem } from '@angular/cdk/menu';
import { XMessageBoxAction, XMessageBoxService } from '@ng-nest/ui';

@Component({
  selector: 'app-file-tree',
  templateUrl: 'file-tree.html',
  styleUrl: 'file-tree.scss',
  imports: [
    CdkMenu,
    CdkMenuItem,
    CdkContextMenuTrigger,
    Tree,
    TreeItem,
    TreeItemGroup,
    NgTemplateOutlet,
    XIconComponent,
    AppFileIconPipe
  ]
})
export class FileTreeComponent {
  data = input<FileNode[]>([]);
  selected = signal<string[]>([]);
  service = inject(FileTreeService);
  msgBox = inject(XMessageBoxService);
  cdr = inject(ChangeDetectorRef);

  onRename(node: FileNode) {
    this.msgBox.prompt({
      title: 'Rename',
      inputValue: node.name,
      callback: (action: XMessageBoxAction, message?: string) => {
        if (action === 'confirm') {
          node.name = message!;
          this.cdr.detectChanges();
        }
      }
    });
    // const newName = window.prompt('Enter new name', node.name);
    // if (newName && newName !== node.name) {
    //   const newPath = node.path.substring(0, node.path.lastIndexOf('/') + 1) + newName;
    //   this.service.rename(node.path, newPath);
    // }
  }

  onDelete(node: FileNode) {
    if (confirm(`Are you sure you want to delete ${node.name}?`)) {
      this.service.delete(node.path);
    }
  }

  onCut(node: FileNode) {
    this.service.cut(node.path);
  }

  onCopy(node: FileNode) {
    this.service.copy(node.path);
  }

  onPaste(node: FileNode) {
    if (node.type === 'dir') {
      this.service.paste(node.path);
    }
  }

  onShowInExplorer(node: FileNode) {
    this.service.showInExplorer(node.path);
  }
}
