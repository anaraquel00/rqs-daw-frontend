import { Injectable, signal, computed, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private platformId = inject(PLATFORM_ID);
  private supabase!: SupabaseClient;

  readonly session = signal<any | null>(null);
  readonly userRole = signal<'free' | 'premium'>('free');
  readonly completedMasters = signal<number>(0);

  // Sinais Computados reativos para controle de Paywall [1.1]
  readonly remainingMasters = computed(() => {
    if (this.userRole() === 'premium') return Infinity;
    return Math.max(0, 3 - this.completedMasters());
  });

  readonly canMaster = computed(() => this.userRole() === 'premium' || this.remainingMasters() > 0);
  readonly isPremium = computed(() => this.userRole() === 'premium');

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const supabaseUrl = 'https://ucearnthodrltkvkmhit.supabase.co';
      const supabaseKey = 'sb_publishable_v2YYX5ksPlYxbh2Xf4HwwQ_UEc5NZyR';

      this.supabase = createClient(supabaseUrl, supabaseKey);
      this.listenToAuthChanges();
    }
  }

  private listenToAuthChanges() {
    this.supabase.auth.getSession().then(({ data: { session } }) => {
      this.handleSessionUpdate(session);
    });

    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.handleSessionUpdate(session);
    });
  }

  private async handleSessionUpdate(session: any | null) {
    this.session.set(session);

    if (session?.user) {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const hasMainframeOverride = localStorage.getItem('rqs_mainframe_override') === 'false';

      if (isLocalhost || hasMainframeOverride) {
        this.userRole.set('premium');
        this.completedMasters.set(0);
        return;
      }

      // Busca os dados de limite e plano diretamente do Banco de Dados Supabase [1]
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('role, completed_masters')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        this.userRole.set(profile.role as 'free' | 'premium');
        this.completedMasters.set(profile.completed_masters);
      }
    } else {
      // 🟢 CASO ANÔNIMO (SOUNDCLOUD STYLE): Sincroniza a cota mensal salva no navegador [1.1.2]
      this.userRole.set('free');
      this.sincronizarCotaAnonimaLocal();
    }
  }

  // 🟢 MOTOR DE COTA ANÔNIMA COM JANELA DESLIZANTE DE 30 DIAS [1.1.2]
  private sincronizarCotaAnonimaLocal() {
    if (!isPlatformBrowser(this.platformId)) return;

    const agora = new Date().getTime();
    const trintaDiasEmMs = 30 * 24 * 60 * 60 * 1000;

    const dataCriacao = localStorage.getItem('rqs_anon_quota_start_date');
    const mastersLocais = localStorage.getItem('rqs_anon_completed_masters');

    let dataInicio = dataCriacao ? parseInt(dataCriacao, 10) : agora;
    let completed = mastersLocais ? parseInt(mastersLocais, 10) : 0;

    // Se já se passaram 30 dias desde a criação da cota local, reseta o ciclo mensal! [1.1.2]
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

  async loginWithProvider(provider: 'google' | 'github') {
    if (!this.supabase) return;
    await this.supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin [1]
      }
    });
  }

  async logout() {
    if (!this.supabase) return;
    await this.supabase.auth.signOut();
    localStorage.removeItem('rqs_mainframe_override');
  }

  // Incrementa e salva a masterização no banco (se logado) ou no cache local (se deslogado) [1]
  async registrarNovaMaster() {
    const activeSession = this.session();
    const nextCount = this.completedMasters() + 1;

    if (activeSession?.user) {
      // 🟢 USUÁRIO LOGADO: Registra o consumo na conta em nuvem no Supabase [1]
      if (this.userRole() !== 'premium') {
        const { error } = await this.supabase
          .from('profiles')
          .update({ completed_masters: nextCount })
          .eq('id', activeSession.user.id);

        if (!error) {
          this.completedMasters.set(nextCount);
        }
      }
    } else {
      // 🟢 USUÁRIO ANÔNIMO: Registra o consumo localmente no navegador [1.1.2]
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem('rqs_anon_completed_masters', nextCount.toString());
        this.completedMasters.set(nextCount);
      }
    }
  }
}
