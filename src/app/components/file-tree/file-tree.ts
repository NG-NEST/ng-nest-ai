import { Component, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Tree, TreeItem, TreeItemGroup } from '@angular/aria/tree';
import { FileNode } from './file-tree.types';
import { XIconComponent } from '@ng-nest/ui/icon';
import { AppFileIconPipe } from './file-icon.pipe';

@Component({
  selector: 'app-file-tree',
  templateUrl: 'file-tree.html',
  styleUrl: 'file-tree.scss',
  imports: [Tree, TreeItem, TreeItemGroup, NgTemplateOutlet, XIconComponent, AppFileIconPipe]
})
export class FileTreeCompoennt {
  data = input<FileNode[]>([]);
  selected = signal<string[]>([]);
}
