import { Component, input, signal, inject, ChangeDetectorRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Tree, TreeItem, TreeItemGroup } from '@angular/aria/tree';
import { FileNode } from './file-tree.types';
import { XIconComponent } from '@ng-nest/ui/icon';
import { AppFileIconPipe } from './file-icon.pipe';
import { FileTreeService } from './file-tree.service';
import { CdkContextMenuTrigger, CdkMenu, CdkMenuItem } from '@angular/cdk/menu';
import { XMessageBoxAction, XMessageBoxService, XI18nPipe, XI18nService } from '@ng-nest/ui';

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
    AppFileIconPipe,
    XI18nPipe
  ]
})
export class FileTreeComponent {
  data = input<FileNode[]>([]);
  selected = signal<string[]>([]);
  service = inject(FileTreeService);
  msgBox = inject(XMessageBoxService);
  i18n = inject(XI18nService);
  cdr = inject(ChangeDetectorRef);

  onRename(node: FileNode) {
    this.msgBox.prompt({
      title: this.i18n.L('$fileTree.rename'),
      inputValue: node.name,
      callback: (action: XMessageBoxAction, message?: string) => {
        if (action === 'confirm') {
          node.name = message!;
          this.cdr.detectChanges();
        }
      }
    });
  }

  onDelete(node: FileNode) {
    this.msgBox.confirm({
      title: this.i18n.L('$fileTree.delete'),
      content: this.i18n.L('$fileTree.confirmDelete').replace('{name}', node.name),
      type: 'warning',
      callback: (action: XMessageBoxAction) => {
        if (action === 'confirm') {
          this.service.delete(node.path);
        }
      }
    });
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

  onCreateFile(node: FileNode) {
    this.msgBox.prompt({
      title: this.i18n.L('$fileTree.newFile'),
      inputValue: '',
      callback: (action: XMessageBoxAction, message?: string) => {
        if (action === 'confirm' && message?.trim()) {
          const fileName = message.trim();
          const parentPath = node.type === 'dir' ? node.path : node.parent?.path;
          if (parentPath) {
            this.service.createFile(parentPath, fileName).catch(error => {
              console.error('Failed to create file:', error);
            });
          }
        }
      }
    });
  }

  onCreateFolder(node: FileNode) {
    this.msgBox.prompt({
      title: this.i18n.L('$fileTree.newFolder'),
      inputValue: '',
      callback: (action: XMessageBoxAction, message?: string) => {
        if (action === 'confirm' && message?.trim()) {
          const folderName = message.trim();
          const parentPath = node.type === 'dir' ? node.path : node.parent?.path;
          if (parentPath) {
            this.service.createFolder(parentPath, folderName).catch(error => {
              console.error('Failed to create folder:', error);
            });
          }
        }
      }
    });
  }

  onCreateFileInRoot() {
    const rootNode = this.data()[0]; // Assuming first node is root
    if (rootNode) {
      this.onCreateFile(rootNode);
    }
  }

  onCreateFolderInRoot() {
    const rootNode = this.data()[0]; // Assuming first node is root
    if (rootNode) {
      this.onCreateFolder(rootNode);
    }
  }
}
