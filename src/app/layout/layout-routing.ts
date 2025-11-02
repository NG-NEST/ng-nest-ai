import { Routes } from '@angular/router';
import { Layout } from './layout';
import { AppRoutes } from '../app-routes';

export const LayoutRoutes: Routes = [
  {
    path: '',
    component: Layout,
    children: AppRoutes
  }
];
