import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Session } from '@supabase/supabase-js';
import { AnalyticsService } from './analytics.service';
import { AuthService } from './auth.service';

describe('AuthService OAuth and Magic Link', () => {
  let service: AuthService;
  let analytics: jasmine.SpyObj<AnalyticsService>;
  let router: jasmine.SpyObj<Router>;

  const callbackHandler = () => service as unknown as {
    handleAuthCallbackReturn(callback: { present: boolean; errorCode: string | null }, session: Session | null): void;
  };

  const authenticatedSession = { user: { id: 'test-user' } } as Session;

  beforeEach(() => {
    window.history.replaceState({}, '', '/app');
    window.sessionStorage.clear();
    window.localStorage.clear();
    analytics = jasmine.createSpyObj<AnalyticsService>('AnalyticsService', ['trackEvent']);
    router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    router.navigateByUrl.and.resolveTo(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: AnalyticsService, useValue: analytics },
        { provide: Router, useValue: router },
      ],
    });
    service = TestBed.inject(AuthService);
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/app');
    window.sessionStorage.clear();
  });

  it('keeps Google OAuth redirecting to the Studio app', async () => {
    const signIn = spyOn(service.getSupabaseClient().auth, 'signInWithOAuth').and.resolveTo({ data: {}, error: null } as never);

    await service.loginWithProvider('google');

    expect(signIn).toHaveBeenCalledOnceWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/app` },
    });
  });

  it('keeps GitHub OAuth redirecting to the Studio app', async () => {
    const signIn = spyOn(service.getSupabaseClient().auth, 'signInWithOAuth').and.resolveTo({ data: {}, error: null } as never);

    await service.loginWithProvider('github');

    expect(signIn).toHaveBeenCalledOnceWith({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/app` },
    });
  });

  it('captures /app/master and uses it as the exact OAuth return route', async () => {
    window.history.replaceState({}, '', '/app/master');
    const signIn = spyOn(service.getSupabaseClient().auth, 'signInWithOAuth').and.resolveTo({ data: {}, error: null } as never);

    service.requestSignIn('mastering');
    await service.loginWithProvider('google');

    expect(window.sessionStorage.getItem('rqs_auth_return_path')).toBe('/app/master');
    expect(signIn).toHaveBeenCalledOnceWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/app/master` },
    });
  });

  it('uses the existing Supabase client for Magic Link with the required options', async () => {
    const signIn = spyOn(service.getSupabaseClient().auth, 'signInWithOtp').and.resolveTo({ data: {}, error: null } as never);

    await service.sendMagicLink('artist@example.com');

    expect(signIn).toHaveBeenCalledOnceWith({
      email: 'artist@example.com',
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/app`,
      },
    });
    expect(service.authPromptMode()).toBe('sent');
    expect(analytics.trackEvent).toHaveBeenCalledWith('auth_email_started');
    expect(analytics.trackEvent).toHaveBeenCalledWith('auth_email_link_sent');
  });

  it('uses the captured safe route for Magic Link return', async () => {
    window.history.replaceState({}, '', '/app/uplink');
    const signIn = spyOn(service.getSupabaseClient().auth, 'signInWithOtp').and.resolveTo({ data: {}, error: null } as never);

    service.requestSignIn('general', 'email');
    await service.sendMagicLink('artist@example.com');

    expect(signIn).toHaveBeenCalledOnceWith({
      email: 'artist@example.com',
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/app/uplink`,
      },
    });
  });

  it('rejects an empty email without calling Supabase', async () => {
    const signIn = spyOn(service.getSupabaseClient().auth, 'signInWithOtp');
    await service.sendMagicLink('  ');
    expect(service.authMessageKey()).toBe('AUTH_EMAIL_REQUIRED');
    expect(signIn).not.toHaveBeenCalled();
  });

  it('rejects an invalid email without calling Supabase', async () => {
    const signIn = spyOn(service.getSupabaseClient().auth, 'signInWithOtp');
    await service.sendMagicLink('not-an-email');
    expect(service.authMessageKey()).toBe('AUTH_EMAIL_INVALID');
    expect(signIn).not.toHaveBeenCalled();
  });

  it('maps Magic Link send failures to a controlled message', async () => {
    spyOn(service.getSupabaseClient().auth, 'signInWithOtp').and.resolveTo({
      data: {}, error: { message: 'provider unavailable', status: 500 },
    } as never);
    await service.sendMagicLink('artist@example.com');
    expect(service.authMessageKey()).toBe('AUTH_EMAIL_SEND_ERROR');
  });

  it('maps rate limits to a friendly controlled message', async () => {
    spyOn(service.getSupabaseClient().auth, 'signInWithOtp').and.resolveTo({
      data: {}, error: { message: 'rate limit exceeded', status: 429 },
    } as never);
    await service.sendMagicLink('artist@example.com');
    expect(service.authMessageKey()).toBe('AUTH_EMAIL_RATE_LIMIT');
  });

  it('shows a controlled invalid-link message without retaining callback parameters', async () => {
    window.history.replaceState({}, '', '/app#error_code=otp_expired&access_token=secret');

    callbackHandler().handleAuthCallbackReturn({ present: true, errorCode: 'otp_expired' }, null);

    expect(service.authMessageKey()).toBe('AUTH_LINK_INVALID');
    expect(service.authPromptOpen()).toBeTrue();
    expect(window.location.hash).toBe('');
  });

  it('shows session missing when a callback returns without a session', () => {
    callbackHandler().handleAuthCallbackReturn({ present: true, errorCode: null }, null);
    expect(service.authMessageKey()).toBe('AUTH_SESSION_MISSING');
    expect(service.authPromptOpen()).toBeTrue();
  });

  it('preserves only a non-sensitive mastering intent and requests audio reselection after return', () => {
    service.requestSignIn('mastering');

    callbackHandler().handleAuthCallbackReturn({ present: true, errorCode: null }, authenticatedSession);

    expect(service.reselectAudioRequired()).toBeTrue();
    expect(window.sessionStorage.getItem('rqs_resume_mastering')).toBeNull();
  });

  for (const path of ['/app/master', '/app/build', '/app/uplink', '/app/split', '/app']) {
    it(`restores ${path} after a successful authentication callback`, () => {
      window.history.replaceState({}, '', path);
      service.requestSignIn(path === '/app/master' ? 'mastering' : 'general');
      window.history.replaceState({}, '', '/');

      callbackHandler().handleAuthCallbackReturn({ present: true, errorCode: null }, authenticatedSession);

      expect(router.navigateByUrl).toHaveBeenCalledOnceWith(path, { replaceUrl: true });
      expect(window.sessionStorage.getItem('rqs_auth_return_path')).toBeNull();
    });
  }

  it('keeps an already-restored safe callback path without duplicate navigation', () => {
    window.history.replaceState({}, '', '/app/master');
    window.sessionStorage.setItem('rqs_auth_return_path', '/app/master');

    callbackHandler().handleAuthCallbackReturn({ present: true, errorCode: null }, authenticatedSession);

    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem('rqs_auth_return_path')).toBeNull();
  });

  it('falls back to /app when no valid V2 return route exists', () => {
    window.history.replaceState({}, '', '/');

    callbackHandler().handleAuthCallbackReturn({ present: true, errorCode: null }, authenticatedSession);

    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/app', { replaceUrl: true });
  });

  it('rejects external, protocol-relative, executable, traversal, legacy and unknown routes', () => {
    const unsafeRoutes = [
      'https://attacker.invalid/app/master',
      '//attacker.invalid/app/master',
      'javascript:alert(1)',
      'data:text/html,unsafe',
      '/app/../legacy',
      '/legacy',
      '/',
      '/app/unknown',
    ];

    for (const unsafeRoute of unsafeRoutes) {
      router.navigateByUrl.calls.reset();
      window.sessionStorage.setItem('rqs_auth_return_path', unsafeRoute);
      window.history.replaceState({}, '', '/');

      callbackHandler().handleAuthCallbackReturn({ present: true, errorCode: null }, authenticatedSession);

      expect(router.navigateByUrl).withContext(unsafeRoute).toHaveBeenCalledOnceWith('/app', { replaceUrl: true });
      expect(window.sessionStorage.getItem('rqs_auth_return_path')).withContext(unsafeRoute).toBeNull();
    }
  });

  it('replaces an invalid initiating route with the safe /app fallback before OAuth', async () => {
    window.history.replaceState({}, '', '/legacy');
    const signIn = spyOn(service.getSupabaseClient().auth, 'signInWithOAuth').and.resolveTo({ data: {}, error: null } as never);

    await service.loginWithProvider('github');

    expect(window.sessionStorage.getItem('rqs_auth_return_path')).toBe('/app');
    expect(signIn).toHaveBeenCalledOnceWith({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/app` },
    });
  });
});
