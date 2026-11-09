import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { AdminApiError, AdminApiService } from './admin-api.service';
import { adminAccessGuard } from './admin-access.guard';
import { AdminAuthService } from './admin-auth.service';

describe('adminAccessGuard', () => {
  const auth = {
    initialize: () => Promise.resolve(),
    initializationFailed: () => false,
    session: () => null as { user: { id: string } } | null,
  };
  const api = { me: jasmine.createSpy('me') };

  beforeEach(() => {
    api.me.calls.reset();
    auth.session = () => null;
    auth.initializationFailed = () => false;
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      { provide: AdminAuthService, useValue: auth },
      { provide: AdminApiService, useValue: api },
    ] });
  });

  async function run(): Promise<boolean | UrlTree> {
    return TestBed.runInInjectionContext(() => adminAccessGuard({} as never, {} as never)) as Promise<boolean | UrlTree>;
  }

  it('routes unauthenticated users to login without calling admin API', async () => {
    const result = await run() as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/login');
    expect(api.me).not.toHaveBeenCalled();
  });

  it('requires server authorization and preserves explicit error states', async () => {
    auth.session = () => ({ user: { id: 'user-id' } });
    api.me.and.resolveTo({ authenticated: true, role: 'owner' });
    expect(await run()).toBeTrue();

    api.me.and.rejectWith(new AdminApiError(403));
    expect(TestBed.inject(Router).serializeUrl(await run() as UrlTree)).toBe('/forbidden');

    api.me.and.rejectWith(new AdminApiError(503));
    expect(TestBed.inject(Router).serializeUrl(await run() as UrlTree)).toBe('/unavailable');
  });
});
