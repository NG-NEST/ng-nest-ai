import {
  ApplicationConfig,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection
} from '@angular/core';
import { provideRouter, withHashLocation, withRouterConfig } from '@angular/router';

import { AppInitializer } from './app.initialezer';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { X_CONFIG } from '@ng-nest/ui';
import { NgNestConfig } from './ng-nest.config';
import { LayoutRoutes } from './app-routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withFetch()),
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideAppInitializer(AppInitializer),
    provideRouter(LayoutRoutes, withRouterConfig({ onSameUrlNavigation: 'reload' }), withHashLocation()),
    { provide: X_CONFIG, useValue: NgNestConfig }
  ]
};
