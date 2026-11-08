import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AdminSessionService } from './admin-session.service';

export const adminAuthGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const admin = inject(AdminSessionService);
  const router = inject(Router);

  await auth.whenAuthStateResolved();
  if (!auth.session()?.user) {
    auth.requestSignInForPath('/admin', 'providers');
    return router.createUrlTree(['/app']);
  }

  try {
    return await admin.verify() ? true : router.createUrlTree(['/app']);
  } catch {
    return router.createUrlTree(['/app']);
  }
};
