import { Observable, concatMap } from 'rxjs';
import { inject } from '@angular/core';
import { AppLocaleService, AppIconService, AppThemeService, AppDataBaseService } from '@ui/core';
export const AppInitializer = (): Observable<boolean> => {
  const locale = inject(AppLocaleService);
  const database = inject(AppDataBaseService);
  const icon = inject(AppIconService);
  const theme = inject(AppThemeService);
  return locale.init().pipe(
    concatMap(() => database.init()),
    concatMap(() => icon.init()),
    concatMap(() => theme.init())
  );
};
