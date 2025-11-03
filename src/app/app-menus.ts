import { XMenuNode } from '@ng-nest/ui/menu';

export const AppMenus: XMenuNode[] = [
  { id: 'coversation', label: '新对话', icon: 'fto-plus', routerLink: './coversation' },
  { id: 'search', label: '搜索聊天', icon: 'fto-search', routerLink: './history' },
  { id: 'project', label: '新项目', icon: 'fto-briefcase', routerLink: './history' }
];
