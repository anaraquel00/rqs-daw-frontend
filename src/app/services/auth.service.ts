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

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private supabase!: SupabaseClient;

  readonly session = signal<Session | null>(null);
  readonly userRole = signal<'free' | 'premium'>('free');
  readonly completedMasters = signal<number>(0);

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
      .onAuthStateChange((_event, session) => {
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
