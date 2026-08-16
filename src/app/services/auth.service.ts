import {
  Injectable,
  signal,
  computed,
  PLATFORM_ID,
  inject
} from '@angular/core';

import {
  isPlatformBrowser
} from '@angular/common';

import {
  createClient,
  SupabaseClient,
  Session
} from '@supabase/supabase-js';


@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly platformId = inject(PLATFORM_ID);

  private supabase!: SupabaseClient;


  readonly session = signal<Session | null>(null);

  readonly userRole =
    signal<'free' | 'premium'>('free');

  readonly completedMasters =
    signal<number>(0);


  // =================================================
  // PAYWALL / LIMITES
  // =================================================

  readonly remainingMasters = computed(() => {

    if (this.userRole() === 'premium') {
      return Infinity;
    }

    return Math.max(
      0,
      3 - this.completedMasters()
    );
  });


  readonly canMaster = computed(() =>
    this.userRole() === 'premium' ||
    this.remainingMasters() > 0
  );


  readonly isLoggedIn = computed(() =>
    !!this.session()?.user
  );


  readonly isPremium = computed(() =>
    this.userRole() === 'premium'
  );


  readonly maxFreeLinks = 3;


  canCreateLink(
    currentLinksCount: number
  ): boolean {

    if (this.isPremium()) {
      return true;
    }

    return currentLinksCount <
      this.maxFreeLinks;
  }


  // =================================================
  // SUPABASE CLIENT
  // =================================================

  constructor() {

    if (
      isPlatformBrowser(this.platformId)
    ) {

      const supabaseUrl =
        'https://ucearnthodrltkvkmhit.supabase.co';

      /*
       * Chave PUBLICÁVEL.
       *
       * Pode existir no frontend.
       * A proteção dos dados deve ser feita via RLS.
       */
      const supabaseKey =
        'sb_publishable_v2YYX5ksPlYxbh2Xf4HwwQ_UEc5NZyR';


      this.supabase =
        createClient(
          supabaseUrl,
          supabaseKey
        );


      this.listenToAuthChanges();
    }
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
      .then(
        ({
          data: {
            session
          }
        }) => {

          this.handleSessionUpdate(
            session
          );
        }
      );


    this.supabase.auth
      .onAuthStateChange(
        (
          _event,
          session
        ) => {

          this.handleSessionUpdate(
            session
          );
        }
      );
  }


  // =================================================
  // PERFIL / ROLE
  // =================================================

private async handleSessionUpdate(
  session: Session | null
): Promise<void> {

  this.session.set(session);

  if (session?.user) {

     const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';

    if (isLocalhost) {
      this.userRole.set('premium');
      this.completedMasters.set(0);
      return;
    }

    const {
      data: profile,
      error
    } =
      await this.supabase
        .from('profiles')
        .select('role, completed_masters')
        .eq('id', session.user.id)
        .single();

    if (
      error ||
      !profile
    ) {
      console.error(
        '[RQS AUTH] Erro ao carregar perfil:',
        error?.message ?? 'Profile not found'
      );

      this.userRole.set('free');
      this.completedMasters.set(0);

      return;
    }

    this.userRole.set(
      profile.role === 'premium'
        ? 'premium'
        : 'free'
    );

    this.completedMasters.set(
      profile.completed_masters ?? 0
    );

    return;
  }

  this.userRole.set('free');
  this.sincronizarCotaAnonimaLocal();
}

  // =================================================
  // COTA ANÔNIMA DE MASTERIZAÇÃO
  // =================================================

  private sincronizarCotaAnonimaLocal():
    void {

    if (
      !isPlatformBrowser(
        this.platformId
      )
    ) {
      return;
    }


    const agora =
      Date.now();


    const trintaDiasEmMs =
      30 *
      24 *
      60 *
      60 *
      1000;


    const dataCriacao =
      localStorage.getItem(
        'rqs_anon_quota_start_date'
      );


    const mastersLocais =
      localStorage.getItem(
        'rqs_anon_completed_masters'
      );


    let dataInicio =
      dataCriacao
        ? parseInt(
            dataCriacao,
            10
          )
        : agora;


    let completed =
      mastersLocais
        ? parseInt(
            mastersLocais,
            10
          )
        : 0;


    /*
     * Reseta a cota depois de 30 dias.
     */
    if (
      agora - dataInicio >
      trintaDiasEmMs
    ) {

      dataInicio =
        agora;

      completed =
        0;


      localStorage.setItem(
        'rqs_anon_quota_start_date',
        dataInicio.toString()
      );


      localStorage.setItem(
        'rqs_anon_completed_masters',
        '0'
      );

    } else if (
      !dataCriacao
    ) {

      localStorage.setItem(
        'rqs_anon_quota_start_date',
        dataInicio.toString()
      );


      localStorage.setItem(
        'rqs_anon_completed_masters',
        '0'
      );
    }


    this.completedMasters.set(
      completed
    );
  }


  // =================================================
  // LOGIN
  // =================================================

  async loginWithProvider(
    provider:
      'google' |
      'github'
  ): Promise<void> {

    if (!this.supabase) {
      return;
    }


    const {
      error
    } =
      await this.supabase.auth
        .signInWithOAuth({

          provider,

          options: {

            redirectTo: `${window.location.origin}/app`
          }
        });


    if (error) {

      console.error(
        '[RQS AUTH] OAuth error:',
        error.message
      );
    }
  }


  // =================================================
  // LOGOUT
  // =================================================

  async logout(): Promise<void> {
  if (!this.supabase) {
    return;
  }

  const { error } =
    await this.supabase.auth.signOut({
      scope: 'local'
    });

  if (error) {
    console.error(
      '[RQS AUTH] Logout error:',
      error.message
    );
  }

  this.session.set(null);
  this.userRole.set('free');
  this.sincronizarCotaAnonimaLocal();
}


  // =================================================
  // REGISTRO DE MASTERIZAÇÃO
  // =================================================

  async registrarNovaMaster():
    Promise<void> {

    const activeSession =
      this.session();


    const nextCount =
      this.completedMasters() +
      1;


    // ===============================================
    // LOGADO
    // ===============================================

    if (
      activeSession?.user
    ) {

      /*
       * Premium não precisa consumir cota.
       */
      if (
        this.userRole() ===
        'premium'
      ) {
        return;
      }


      const {
        error
      } =
        await this.supabase
          .from('profiles')
          .update({
            completed_masters:
              nextCount
          })
          .eq(
            'id',
            activeSession.user.id
          );


      if (error) {

        console.error(
          '[RQS AUTH] Erro ao registrar masterização:',
          error.message
        );

        return;
      }


      this.completedMasters.set(
        nextCount
      );


      return;
    }


    // ===============================================
    // ANÔNIMO
    // ===============================================

    if (
      isPlatformBrowser(
        this.platformId
      )
    ) {

      localStorage.setItem(
        'rqs_anon_completed_masters',
        nextCount.toString()
      );


      this.completedMasters.set(
        nextCount
      );
    }
  }
}
