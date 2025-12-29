import { Observable, concatMap } from 'rxjs';
import { inject } from '@angular/core';
import { AppLocaleService, AppIconService, AppThemeService, AppDataBaseService, AppPrismService } from '@ui/core';
export const AppInitializer = (): Observable<boolean> => {
  const locale = inject(AppLocaleService);
  const database = inject(AppDataBaseService);
  const prism = inject(AppPrismService);
  const icon = inject(AppIconService);
  const theme = inject(AppThemeService);
  return locale.init().pipe(
    concatMap(() => prism.init()),
    concatMap(() => database.init()),
    concatMap(() => theme.init()),
    concatMap(() => icon.init())
  );
};
