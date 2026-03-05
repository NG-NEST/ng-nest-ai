import { Routes } from '@angular/router';

export const LayoutRoutes: Routes = [
  {
    path: '',
    loadChildren: () => import('./layout/layout-routing').then((x) => x.LayoutRoutes)
  }
];

export const AppRoutes: Routes = [
  { path: '', redirectTo: 'conversation', pathMatch: 'full' },
  {
    path: 'conversation',
    loadChildren: () => import('./pages/conversation/conversation-routing').then((x) => x.ConversationRoutes)
  },
  {
    path: 'history',
    loadChildren: () => import('./pages/history/history-routing').then((x) => x.HistoryRoutes)
  },
  {
    path: 'project-home',
    loadChildren: () => import('./pages/project-home/project-home-routing').then((x) => x.ProjectHomeRoutes)
  }
];
