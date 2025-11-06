import { Routes } from '@angular/router';

export const LayoutRoutes: Routes = [
  {
    path: '',
    loadChildren: () => import('./layout/layout-routing').then((x) => x.LayoutRoutes)
  }
];

export const AppRoutes: Routes = [
  { path: '', redirectTo: 'coversation', pathMatch: 'full' },
  {
    path: 'coversation',
    loadChildren: () => import('./pages/coversation/coversation-routing').then((x) => x.CoversationRoutes)
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
