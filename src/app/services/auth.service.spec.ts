import { TestBed } from '@angular/core/testing';
import { Session } from '@supabase/supabase-js';
import { AnalyticsService } from './analytics.service';
import { AuthService } from './auth.service';

describe('AuthService OAuth and Magic Link', () => {
  let service: AuthService;
  let analytics: jasmine.SpyObj<AnalyticsService>;

  beforeEach(() => {
    window.history.replaceState({}, '', '/app');
    window.sessionStorage.clear();
    window.localStorage.clear();
    analytics = jasmine.createSpyObj<AnalyticsService>('AnalyticsService', ['trackEvent']);
    TestBed.configureTestingModule({
      providers: [{ provide: AnalyticsService, useValue: analytics }],
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
    const internal = service as unknown as {
      handleAuthCallbackReturn(callback: { present: boolean; errorCode: string | null }, session: Session | null): void;
    };
    window.history.replaceState({}, '', '/app#error_code=otp_expired&access_token=secret');

    internal.handleAuthCallbackReturn({ present: true, errorCode: 'otp_expired' }, null);

    expect(service.authMessageKey()).toBe('AUTH_LINK_INVALID');
    expect(service.authPromptOpen()).toBeTrue();
    expect(window.location.hash).toBe('');
  });

  it('shows session missing when a callback returns without a session', () => {
    const internal = service as unknown as {
      handleAuthCallbackReturn(callback: { present: boolean; errorCode: string | null }, session: Session | null): void;
    };
    internal.handleAuthCallbackReturn({ present: true, errorCode: null }, null);
    expect(service.authMessageKey()).toBe('AUTH_SESSION_MISSING');
    expect(service.authPromptOpen()).toBeTrue();
  });

  it('preserves only a non-sensitive mastering intent and requests audio reselection after return', () => {
    const internal = service as unknown as {
      handleAuthCallbackReturn(callback: { present: boolean; errorCode: string | null }, session: Session | null): void;
    };
    service.requestSignIn('mastering');
    const session = { user: { id: 'test-user' } } as Session;

    internal.handleAuthCallbackReturn({ present: true, errorCode: null }, session);

    expect(service.reselectAudioRequired()).toBeTrue();
    expect(window.sessionStorage.getItem('rqs_resume_mastering')).toBeNull();
  });
});
