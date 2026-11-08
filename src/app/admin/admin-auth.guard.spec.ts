import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AdminSessionService } from './admin-session.service';
import { adminAuthGuard } from './admin-auth.guard';

describe('adminAuthGuard', () => {
  const requestSignInForPath = jasmine.createSpy('requestSignInForPath');
  let user: unknown;
  let verify: jasmine.Spy;

  beforeEach(() => {
    user = null;
    requestSignInForPath.calls.reset();
    verify = jasmine.createSpy('verify').and.resolveTo(false);
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      { provide: AuthService, useValue: {
        session: () => user ? { user } : null,
        whenAuthStateResolved: () => Promise.resolve(),
        requestSignInForPath,
      } },
      { provide: AdminSessionService, useValue: { verify } },
    ] });
  });

  async function runGuard(): Promise<boolean | UrlTree> {
    return TestBed.runInInjectionContext(() => adminAuthGuard({} as never, {} as never)) as Promise<boolean | UrlTree>;
  }

  it('opens existing auth UX for unauthenticated users', async () => {
    const result = await runGuard();
    expect(result instanceof UrlTree).toBeTrue();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/app');
    expect(requestSignInForPath).toHaveBeenCalledOnceWith('/admin', 'providers');
    expect(verify).not.toHaveBeenCalled();
  });

  it('requires server authorization even after authentication', async () => {
    user = { id: 'user-id' };
    expect(TestBed.inject(Router).serializeUrl(await runGuard() as UrlTree)).toBe('/app');
    verify.and.resolveTo(true);
    expect(await runGuard()).toBeTrue();
  });
});
