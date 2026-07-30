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

// 🟢 CORREÇÃO: Transforma isPremium em um sinal computado reativo legítimo
readonly isPremium = computed(() => this.userRole() === 'premium');

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // ⚠️ Substitua com as suas credenciais reais copiadas do painel do seu Supabase [1]
      const supabaseUrl = 'https://ucearnthodrltkvkmhit.supabase.co';
      const supabaseKey = 'sb_publishable_v2YYX5ksPlYxbh2Xf4HwwQ_UEc5NZyR';

      this.supabase = createClient(supabaseUrl, supabaseKey);
      this.listenToAuthChanges();
    }
  }

  // Escuta alterações de login/logout em tempo real [1]
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
      // 🟢 BACKDOOR: Mantém o bypass ativo se for localhost ou tiver a chave secreta [1.1.2]
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
      this.userRole.set('free');
      this.completedMasters.set(0);
    }
  }

  // Login Social de 1 Clique via Google ou GitHub [1.1, 1.1.9]
  async loginWithProvider(provider: 'google' | 'github') {
    if (!this.supabase) return;
    await this.supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin // Redireciona de volta para a sua DAW após logar [1]
      }
    });
  }

  async logout() {
    if (!this.supabase) return;
    await this.supabase.auth.signOut();
    localStorage.removeItem('rqs_mainframe_override'); // Limpa backdoor ao sair
  }

  // Incrementa e salva a masterização diretamente no Banco de Dados [1]
  async registrarNovaMaster() {
    const activeSession = this.session();
    if (activeSession?.user && this.userRole() !== 'premium') {
      const nextCount = this.completedMasters() + 1;

      const { error } = await this.supabase
        .from('profiles')
        .update({ completed_masters: nextCount })
        .eq('id', activeSession.user.id);

      if (!error) {
        this.completedMasters.set(nextCount);
      }
    }
  }
}
