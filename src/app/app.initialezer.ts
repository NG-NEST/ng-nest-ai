import { Observable, concatMap } from 'rxjs';
import { inject } from '@angular/core';
import { AppLocaleService, AppIconService, AppThemeService } from '@ui/core';
export const AppInitializer = (): Observable<boolean> => {
  const locale = inject(AppLocaleService);
  const icon = inject(AppIconService);
  const theme = inject(AppThemeService);
  return locale.init().pipe(
    concatMap(() => icon.init()),
    concatMap(() => theme.init())
  );
};
