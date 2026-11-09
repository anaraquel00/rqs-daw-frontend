import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminApiError, AdminApiService } from './admin-api.service';
import { AdminAuthService } from './admin-auth.service';

export const adminAccessGuard: CanActivateFn = async () => {
  const auth = inject(AdminAuthService);
  const api = inject(AdminApiService);
  const router = inject(Router);

  await auth.initialize();
  if (auth.initializationFailed()) return router.createUrlTree(['/unavailable']);
  if (!auth.session()?.user) return router.createUrlTree(['/login']);

  try {
    await api.me();
    return true;
  } catch (error) {
    if (error instanceof AdminApiError && (error.status === 401 || error.status === 403)) {
      return router.createUrlTree([error.status === 401 ? '/login' : '/forbidden']);
    }
    return router.createUrlTree(['/unavailable']);
  }
};
