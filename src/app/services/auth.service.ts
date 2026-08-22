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

export type MagicLinkErrorCode = 'invalid_email' | 'rate_limit' | 'send_failed';
export type MagicLinkResult =
  | { ok: true }
  | { ok: false; code: MagicLinkErrorCode };

export type AuthCallbackError = 'expired' | 'invalid' | null;

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
  readonly authCallbackError = signal<AuthCallbackError>(null);

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

    this.captureCallbackError();

    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabasePublishableKey
    );

    this.listenToAuthChanges();
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

  private listenToAuthChanges(): void {
    this.supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        void this.handleSessionUpdate(session);
      });

    this.supabase.auth
      .onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          this.authCallbackError.set(null);
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

  async loginWithProvider(provider: 'google' | 'github'): Promise<void> {
    if (!this.supabase || !isPlatformBrowser(this.platformId)) {
      return;
    }

    const { error } = await this.supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: this.buildSafeRedirectUrl()
      }
    });

    if (error) {
      console.error('[RQS AUTH] OAuth error:', error.message);
    }
  }

  async sendMagicLink(rawEmail: string): Promise<MagicLinkResult> {
    if (!this.supabase || !isPlatformBrowser(this.platformId)) {
      return { ok: false, code: 'send_failed' };
    }

    const email = rawEmail.trim();
    if (!this.isValidEmail(email)) {
      return { ok: false, code: 'invalid_email' };
    }

    this.analytics.trackEvent('auth_email_started');

    const { error } = await this.supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: this.buildSafeRedirectUrl(),
        shouldCreateUser: true
      }
    });

    if (error) {
      const status = Number((error as { status?: number }).status ?? 0);
      const message = String(error.message || '').toLowerCase();
      if (status === 429 || message.includes('rate limit') || message.includes('too many')) {
        return { ok: false, code: 'rate_limit' };
      }
      return { ok: false, code: 'send_failed' };
    }

    this.analytics.trackEvent('auth_email_link_sent');
    return { ok: true };
  }

  clearAuthCallbackError(): void {
    this.authCallbackError.set(null);
  }

  private buildSafeRedirectUrl(): string {
    const path = this.safeReturnPath(window.location.pathname);
    return `${window.location.origin}${path}`;
  }

  private safeReturnPath(path: string): string {
    if (!path.startsWith('/') || path.startsWith('//')) {
      return '/app';
    }

    // Keep route intent but never forward query strings, hashes or auth data.
    const cleanPath = path.split('?')[0].split('#')[0];
    return cleanPath || '/app';
  }

  private isValidEmail(email: string): boolean {
    if (email.length < 3 || email.length > 320) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private captureCallbackError(): void {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const code = (query.get('error_code') || hash.get('error_code') || '').toLowerCase();
    const error = (query.get('error') || hash.get('error') || '').toLowerCase();
    const description = (
      query.get('error_description') ||
      hash.get('error_description') ||
      ''
    ).toLowerCase();

    if (code.includes('expired') || description.includes('expired')) {
      this.authCallbackError.set('expired');
      return;
    }

    if (error || code || description) {
      this.authCallbackError.set('invalid');
    }
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
