import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const studioAuthGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.whenAuthStateResolved();

  if (auth.isLoggedIn()) return true;

  auth.requestSignInForPath(state.url, 'providers');
  return router.createUrlTree(['/app']);
};
