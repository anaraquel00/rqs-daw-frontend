import { Injectable, signal, computed, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private supabase!: SupabaseClient;

  readonly session = signal<any | null>(null);
  readonly userRole = signal<'free' | 'premium'>('free');
  readonly completedMasters = signal<number>(0);

  readonly remainingMasters = computed(() => {
    if (this.userRole() === 'premium') return Infinity;
    return Math.max(0, 3 - this.completedMasters());
  });

  readonly canMaster = computed(() => this.userRole() === 'premium' || this.remainingMasters() > 0);
  readonly isPremium = computed(() => this.userRole() === 'premium');

  readonly maxFreeLinks = 3;

  canCreateLink(currentLinksCount: number): boolean {
    if (this.isPremium()) return true;
    return currentLinksCount < this.maxFreeLinks;
  }

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const supabaseUrl = 'https://ucearnthodrltkvkmhit.supabase.co';
      // Supabase publishable keys are intentionally browser-visible. Authorization
      // must be enforced by Supabase RLS / backend policy, never by this value.
      const supabaseKey = 'sb_publishable_v2YYX5ksPlYxbh2Xf4HwwQ_UEc5NZyR';

      this.supabase = createClient(supabaseUrl, supabaseKey);
      this.listenToAuthChanges();
    }
  }

  private listenToAuthChanges(): void {
    this.supabase.auth.getSession().then(({ data: { session } }) => {
      this.handleSessionUpdate(session);
    });

    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.handleSessionUpdate(session);
    });
  }

  private async handleSessionUpdate(session: any | null): Promise<void> {
    this.session.set(session);

    if (session?.user) {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

      // Local premium behavior exists only to support the isolated developer UI.
      // It must never be unlockable with localStorage on a deployed hostname.
      if (isLocalhost) {
        this.userRole.set('premium');
        this.completedMasters.set(0);
        return;
      }

      const { data: profile } = await this.supabase
        .from('profiles')
        .select('role, completed_masters')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        this.userRole.set(profile.role as 'free' | 'premium');
        this.completedMasters.set(this.normalizeUsageCount(profile.completed_masters));
      } else {
        this.userRole.set('free');
        this.completedMasters.set(0);
      }
    } else {
      this.userRole.set('free');
      this.sincronizarCotaAnonimaLocal();
    }
  }

  // Anonymous browser quota is UX state only. It must not be treated as a
  // server-side authorization boundary for paid resources.
  private sincronizarCotaAnonimaLocal(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    const storedStart = localStorage.getItem('rqs_anon_quota_start_date');
    const storedMasters = localStorage.getItem('rqs_anon_completed_masters');

    const parsedStart = storedStart ? Number.parseInt(storedStart, 10) : NaN;
    let start = Number.isFinite(parsedStart) && parsedStart > 0 ? parsedStart : now;
    let completed = this.normalizeUsageCount(storedMasters ? Number.parseInt(storedMasters, 10) : 0);

    if (now - start > thirtyDaysMs || now < start) {
      start = now;
      completed = 0;
    }

    localStorage.setItem('rqs_anon_quota_start_date', start.toString());
    localStorage.setItem('rqs_anon_completed_masters', completed.toString());
    this.completedMasters.set(completed);
  }

  async loginWithProvider(provider: 'google' | 'github'): Promise<void> {
    if (!this.supabase) return;
    await this.supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });
  }

  async logout(): Promise<void> {
    if (!this.supabase) return;
    await this.supabase.auth.signOut();
  }

  async registrarNovaMaster(): Promise<void> {
    const activeSession = this.session();
    const nextCount = this.completedMasters() + 1;

    if (activeSession?.user) {
      if (this.userRole() !== 'premium') {
        const { error } = await this.supabase
          .from('profiles')
          .update({ completed_masters: nextCount })
          .eq('id', activeSession.user.id);

        if (!error) this.completedMasters.set(nextCount);
      }
    } else if (isPlatformBrowser(this.platformId)) {
      const normalized = this.normalizeUsageCount(nextCount);
      localStorage.setItem('rqs_anon_completed_masters', normalized.toString());
      this.completedMasters.set(normalized);
    }
  }

  private normalizeUsageCount(value: unknown): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(3, Math.floor(parsed)));
  }
}
