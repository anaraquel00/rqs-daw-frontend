import {
  Injectable,
  signal,
  computed,
  PLATFORM_ID,
  inject
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  createClient,
  SupabaseClient,
  Session
} from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { AnalyticsService } from './analytics.service';

export type AuthPromptMode = 'providers' | 'email' | 'sent';
export type AuthMessageKey =
  | 'AUTH_EMAIL_REQUIRED'
  | 'AUTH_EMAIL_INVALID'
  | 'AUTH_EMAIL_SEND_ERROR'
  | 'AUTH_EMAIL_RATE_LIMIT'
  | 'AUTH_LINK_INVALID'
  | 'AUTH_CALLBACK_ERROR'
  | 'AUTH_SESSION_MISSING';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly analytics = inject(AnalyticsService);
  private supabase!: SupabaseClient;

  readonly session = signal<Session | null>(null);
  readonly userRole = signal<'free' | 'premium'>('free');
  readonly completedMasters = signal<number>(0);
  readonly authPromptOpen = signal(false);
  readonly authPromptMode = signal<AuthPromptMode>('providers');
  readonly authMessageKey = signal<AuthMessageKey | null>(null);
  readonly authEmailSending = signal(false);
  readonly reselectAudioRequired = signal(false);
  private readonly resumeMasteringKey = 'rqs_resume_mastering';

  // =================================================
  // PAYWALL / LIMITES
  // =================================================

  readonly remainingMasters = computed(() => {
    if (this.userRole() === 'premium') {
      return Infinity;
    }
    return Math.max(0, 3 - this.completedMasters());
  });

  readonly canMaster = computed(() =>
    this.userRole() === 'premium' || this.remainingMasters() > 0
  );

  readonly isLoggedIn = computed(() => !!this.session()?.user);
  readonly isPremium = computed(() => this.userRole() === 'premium');
  readonly maxFreeLinks = 3;

  canCreateLink(currentLinksCount: number): boolean {
    if (this.isPremium()) {
      return true;
    }
    return currentLinksCount < this.maxFreeLinks;
  }

  // =================================================
  // SUPABASE CLIENT
  // =================================================

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const callbackState = this.readAuthCallbackState();

    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabasePublishableKey
    );

    this.listenToAuthChanges(callbackState);
  }

  getSupabaseClient(): SupabaseClient {
    return this.supabase;
  }

  async refreshProfile(): Promise<void> {
    await this.handleSessionUpdate(this.session());
  }

  // =================================================
  // AUTH SESSION
  // =================================================

  private listenToAuthChanges(callbackState: AuthCallbackState): void {
    this.supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        void this.handleSessionUpdate(session);
        this.handleAuthCallbackReturn(callbackState, session);
      });

    this.supabase.auth
      .onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          this.analytics.trackEvent('login', {
            method: this.analyticsAuthMethod(session)
          });
        }

        void this.handleSessionUpdate(session);
      });
  }

  // =================================================
  // PERFIL / ROLE
  // =================================================

  private async handleSessionUpdate(session: Session | null): Promise<void> {
    this.session.set(session);

    if (session?.user) {
      // Pure local DSP development may keep the historical premium shortcut.
      // Staging and production explicitly disable it through their environment
      // files so they always exercise real Supabase profile/quota state.
      if (environment.localAuthProfileBypass) {
        this.userRole.set('premium');
        this.completedMasters.set(0);
        return;
      }

      const { data: profile, error } = await this.supabase
        .from('profiles')
        .select('role, completed_masters')
        .eq('id', session.user.id)
        .single();

      if (error || !profile) {
        console.error(
          '[RQS AUTH] Erro ao carregar perfil:',
          error?.message ?? 'Profile not found'
        );
        this.userRole.set('free');
        this.completedMasters.set(0);
        return;
      }

      this.userRole.set(profile.role === 'premium' ? 'premium' : 'free');
      this.completedMasters.set(profile.completed_masters ?? 0);
      return;
    }

    this.userRole.set('free');
    this.sincronizarCotaAnonimaLocal();
  }

  // =================================================
  // COTA ANÔNIMA LEGACY
  // =================================================

  private sincronizarCotaAnonimaLocal(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const agora = Date.now();
    const trintaDiasEmMs = 30 * 24 * 60 * 60 * 1000;
    const dataCriacao = localStorage.getItem('rqs_anon_quota_start_date');
    const mastersLocais = localStorage.getItem('rqs_anon_completed_masters');

    let dataInicio = dataCriacao ? parseInt(dataCriacao, 10) : agora;
    let completed = mastersLocais ? parseInt(mastersLocais, 10) : 0;

    if (agora - dataInicio > trintaDiasEmMs) {
      dataInicio = agora;
      completed = 0;
      localStorage.setItem('rqs_anon_quota_start_date', dataInicio.toString());
      localStorage.setItem('rqs_anon_completed_masters', '0');
    } else if (!dataCriacao) {
      localStorage.setItem('rqs_anon_quota_start_date', dataInicio.toString());
      localStorage.setItem('rqs_anon_completed_masters', '0');
    }

    this.completedMasters.set(completed);
  }

  // =================================================
  // LOGIN
  // =================================================

  requestSignIn(intent: 'general' | 'mastering' = 'general', mode: AuthPromptMode = 'providers'): void {
    if (!isPlatformBrowser(this.platformId)) return;

    if (intent === 'mastering') {
      window.sessionStorage.setItem(this.resumeMasteringKey, 'true');
    }

    this.authMessageKey.set(null);
    this.authPromptMode.set(mode);
    this.authPromptOpen.set(true);
  }

  closeAuthPrompt(): void {
    this.authPromptOpen.set(false);
    this.authPromptMode.set('providers');
    this.authMessageKey.set(null);
    this.authEmailSending.set(false);
  }

  showEmailSignIn(): void {
    this.authMessageKey.set(null);
    this.authPromptMode.set('email');
  }

  showAuthProviders(): void {
    this.authMessageKey.set(null);
    this.authPromptMode.set('providers');
  }

  dismissReselectAudio(): void {
    this.reselectAudioRequired.set(false);
  }

  async sendMagicLink(rawEmail: string): Promise<void> {
    if (!this.supabase || !isPlatformBrowser(this.platformId)) return;

    const email = rawEmail.trim();
    if (!email) {
      this.authMessageKey.set('AUTH_EMAIL_REQUIRED');
      return;
    }
    if (!this.isValidEmail(email)) {
      this.authMessageKey.set('AUTH_EMAIL_INVALID');
      return;
    }

    this.authMessageKey.set(null);
    this.authEmailSending.set(true);
    this.analytics.trackEvent('auth_email_started');

    try {
      const { error } = await this.supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/app`
        }
      });

      if (error) {
        this.authMessageKey.set(this.isRateLimitError(error) ? 'AUTH_EMAIL_RATE_LIMIT' : 'AUTH_EMAIL_SEND_ERROR');
        return;
      }

      this.analytics.trackEvent('auth_email_link_sent');
      this.authPromptMode.set('sent');
    } catch {
      this.authMessageKey.set('AUTH_EMAIL_SEND_ERROR');
    } finally {
      this.authEmailSending.set(false);
    }
  }

  async loginWithProvider(provider: 'google' | 'github'): Promise<void> {
    if (!this.supabase) {
      return;
    }

    const { error } = await this.supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/app`
      }
    });

    if (error) {
      console.error('[RQS AUTH] OAuth error:', error.message);
    }
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private isRateLimitError(error: { status?: number; message?: string }): boolean {
    return error.status === 429 || /rate|too many|seconds/i.test(error.message ?? '');
  }

  private readAuthCallbackState(): AuthCallbackState {
    if (!isPlatformBrowser(this.platformId)) return { present: false, errorCode: null };

    const query = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const callbackKeys = ['code', 'token_hash', 'access_token', 'error', 'error_code', 'type'];
    const present = callbackKeys.some((key) => query.has(key) || fragment.has(key));
    const errorCode = query.get('error_code') ?? fragment.get('error_code') ?? query.get('error') ?? fragment.get('error');
    return { present, errorCode };
  }

  private handleAuthCallbackReturn(callback: AuthCallbackState, session: Session | null): void {
    if (!callback.present || !isPlatformBrowser(this.platformId)) return;

    window.history.replaceState({}, document.title, window.location.pathname);
    const resumeMastering = window.sessionStorage.getItem(this.resumeMasteringKey) === 'true';

    if (callback.errorCode) {
      const invalidOrExpired = /expired|otp_expired|invalid/i.test(callback.errorCode);
      this.authMessageKey.set(invalidOrExpired ? 'AUTH_LINK_INVALID' : 'AUTH_CALLBACK_ERROR');
      this.authPromptMode.set('email');
      this.authPromptOpen.set(true);
      window.sessionStorage.removeItem(this.resumeMasteringKey);
      return;
    }

    if (!session?.user) {
      this.authMessageKey.set('AUTH_SESSION_MISSING');
      this.authPromptMode.set('email');
      this.authPromptOpen.set(true);
      window.sessionStorage.removeItem(this.resumeMasteringKey);
      return;
    }

    if (resumeMastering) {
      this.reselectAudioRequired.set(true);
      window.sessionStorage.removeItem(this.resumeMasteringKey);
    }
    this.closeAuthPrompt();
  }

  private analyticsAuthMethod(session: Session): 'google' | 'github' | 'email' | 'unknown' {
    const provider = String(session.user.app_metadata?.['provider'] || '').toLowerCase();

    if (provider === 'google' || provider === 'github' || provider === 'email') {
      return provider;
    }

    return 'unknown';
  }

  // =================================================
  // LOGOUT
  // =================================================

  async logout(): Promise<void> {
    if (!this.supabase) {
      return;
    }

    const { error } = await this.supabase.auth.signOut({ scope: 'local' });

    if (error) {
      console.error('[RQS AUTH] Logout error:', error.message);
    }

    this.session.set(null);
    this.userRole.set('free');
    this.sincronizarCotaAnonimaLocal();
  }

  // =================================================
  // LEGACY REGISTRATION COMPATIBILITY
  // =================================================

  async registrarNovaMaster(): Promise<void> {
    const activeSession = this.session();

    // Secure Mastering V2 quota is server-authoritative. If any legacy caller
    // invokes this method while authenticated, refresh the server state rather
    // than writing completed_masters from the browser.
    if (activeSession?.user) {
      await this.refreshProfile();
      return;
    }

    // Keep the old anonymous counter only for legacy/non-V2 UI compatibility.
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const nextCount = this.completedMasters() + 1;
    localStorage.setItem('rqs_anon_completed_masters', nextCount.toString());
    this.completedMasters.set(nextCount);
  }
}

interface AuthCallbackState {
  present: boolean;
  errorCode: string | null;
}
