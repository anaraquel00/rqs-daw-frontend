import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Footer } from '../footer/footer';
import { AnalyticsService } from '../services/analytics.service';
import { LanguageService, UiLanguage } from '../services/language.service';
import { SeoConfig, SeoService } from '../services/seo.service';
import { StudioThemePreference, ThemeService } from '../services/theme.service';

type MasterLandingCopy = {
  skip: string;
  navCta: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryCta: string;
  secondaryCta: string;
  betaNote: string;
  proofEyebrow: string;
  proofTitle: string;
  proofBody: string;
  original: string;
  preview: string;
  fullMaster: string;
  workflowEyebrow: string;
  workflowTitle: string;
  steps: readonly { number: string; title: string; body: string }[];
  freeEyebrow: string;
  freeTitle: string;
  freeBody: string;
  plannedPrice: string;
  plansLink: string;
  trustEyebrow: string;
  trustTitle: string;
  trustItems: readonly { title: string; body: string }[];
  finalTitle: string;
  finalBody: string;
};

const COPY: Record<'pt' | 'en', MasterLandingCopy> = {
  pt: {
    skip: 'Pular para o conteúdo',
    navCta: 'Masterizar agora',
    eyebrow: 'RQS MASTER // PUBLIC BETA',
    title: 'Masterização online para sua música.',
    subtitle: 'Envie sua faixa, compare Original e Preview e gere o Full Master no navegador — com análise técnica clara antes da decisão final.',
    primaryCta: 'Masterizar minha música',
    secondaryCta: 'Ver como funciona',
    betaNote: 'Comece grátis: até 3 Full Masters no beta atual.',
    proofEyebrow: 'PROVA DE PRODUTO // MASTER',
    proofTitle: 'Ouça a diferença antes de finalizar.',
    proofBody: 'O RQS MASTER analisa sua faixa, cria um Preview de 15 segundos e mantém Original, Preview e Full Master claramente identificados para comparação A/B.',
    original: 'Original',
    preview: 'Preview 15s',
    fullMaster: 'Full Master',
    workflowEyebrow: 'FLUXO // 3 ETAPAS',
    workflowTitle: 'Da faixa original ao master final.',
    steps: [
      { number: '01', title: 'Envie sua faixa', body: 'Selecione seu WAV ou MP3. O upload começa apenas quando você autoriza o processamento.' },
      { number: '02', title: 'Compare o Preview', body: 'Ouça 15 segundos processados e alterne entre Original e Preview com referência clara.' },
      { number: '03', title: 'Gere o Full Master', body: 'Quando estiver pronta, processe a faixa completa e baixe o resultado final.' }
    ],
    freeEyebrow: 'ACESSO INICIAL',
    freeTitle: 'Teste o fluxo completo sem cartão.',
    freeBody: 'A Public Beta atual inclui até 3 Full Masters para contas Free. Preview e comparação A/B ajudam você a avaliar o resultado antes de usar sua cota.',
    plannedPrice: 'Plano MASTER planejado a partir de R$ 24,90/mês. Pagamentos ainda não estão ativos.',
    plansLink: 'Ver planos planejados',
    trustEyebrow: 'CONTROLE E TRANSPARÊNCIA',
    trustTitle: 'Uma decisão de áudio, não uma caixa-preta.',
    trustItems: [
      { title: 'Comparação A/B', body: 'Original e versões processadas permanecem identificados durante o fluxo.' },
      { title: 'Métricas técnicas', body: 'LUFS, True Peak e estado do processamento aparecem com linguagem objetiva.' },
      { title: 'Processamento controlado', body: 'Nada de promessa mágica: você ouve o Preview antes de solicitar o master completo.' }
    ],
    finalTitle: 'Sua faixa está pronta para o próximo estágio?',
    finalBody: 'Abra o RQS MASTER, envie sua música e avalie o Preview no navegador.'
  },
  en: {
    skip: 'Skip to content',
    navCta: 'Master now',
    eyebrow: 'RQS MASTER // PUBLIC BETA',
    title: 'Online mastering for your music.',
    subtitle: 'Upload your track, compare Original and Preview, then generate the Full Master in your browser — with clear technical feedback before the final decision.',
    primaryCta: 'Master my music',
    secondaryCta: 'See how it works',
    betaNote: 'Start free: up to 3 Full Masters in the current beta.',
    proofEyebrow: 'PRODUCT PROOF // MASTER',
    proofTitle: 'Hear the difference before you finish.',
    proofBody: 'RQS MASTER analyzes your track, creates a 15-second Preview, and keeps Original, Preview and Full Master clearly labeled for A/B comparison.',
    original: 'Original',
    preview: '15s Preview',
    fullMaster: 'Full Master',
    workflowEyebrow: 'WORKFLOW // 3 STEPS',
    workflowTitle: 'From original track to final master.',
    steps: [
      { number: '01', title: 'Upload your track', body: 'Choose a WAV or MP3. Upload starts only when you authorize processing.' },
      { number: '02', title: 'Compare the Preview', body: 'Hear 15 processed seconds and switch between Original and Preview with a clear reference.' },
      { number: '03', title: 'Generate the Full Master', body: 'When ready, process the complete track and download the final result.' }
    ],
    freeEyebrow: 'STARTING ACCESS',
    freeTitle: 'Try the complete workflow without a card.',
    freeBody: 'The current Public Beta includes up to 3 Full Masters for Free accounts. Preview and A/B comparison help you evaluate the result before using your quota.',
    plannedPrice: 'The planned MASTER plan starts at R$ 24.90/month. Payments are not active yet.',
    plansLink: 'See planned pricing',
    trustEyebrow: 'CONTROL AND TRANSPARENCY',
    trustTitle: 'An audio decision, not a black box.',
    trustItems: [
      { title: 'A/B comparison', body: 'Original and processed versions remain clearly labeled throughout the workflow.' },
      { title: 'Technical metrics', body: 'LUFS, True Peak and processing status use direct, readable language.' },
      { title: 'Controlled processing', body: 'No magic claims: you hear the Preview before requesting the complete master.' }
    ],
    finalTitle: 'Is your track ready for its next stage?',
    finalBody: 'Open RQS MASTER, upload your music, and evaluate the Preview in your browser.'
  }
};

const ATTRIBUTION_KEYS = [
  'gclid',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term'
] as const;

export function masterLandingSeoConfig(language: UiLanguage): SeoConfig {
  const isPt = language === 'pt';
  const canonicalUrl = 'https://studio.raquelsynths.com/master/online';

  return {
    title: isPt
      ? 'Masterização Online para Música | RQS MASTER'
      : 'Online Music Mastering | RQS MASTER',
    description: isPt
      ? 'Masterize sua música online: envie a faixa, compare um Preview de 15 segundos e gere o Full Master no navegador. Até 3 Full Masters grátis no beta atual.'
      : 'Master your music online: upload a track, compare a 15-second Preview, and generate the Full Master in your browser. Up to 3 free Full Masters in the current beta.',
    url: canonicalUrl,
    image: 'https://studio.raquelsynths.com/assets/images/studio.webp',
    type: 'website',
    locale: isPt ? 'pt_BR' : 'en_US',
    siteName: 'RQS Studio',
    robots: 'index, follow',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'RQS MASTER',
      url: canonicalUrl,
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Web',
      description: isPt
        ? 'Fluxo web de masterização online com Preview de 15 segundos e comparação A/B.'
        : 'Browser-based online mastering with a 15-second Preview and A/B comparison.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'BRL',
        description: isPt
          ? 'Public Beta atual com até 3 Full Masters.'
          : 'Current Public Beta with up to 3 Full Masters.'
      }
    }
  };
}

@Component({
  selector: 'app-master-landing-page',
  standalone: true,
  imports: [CommonModule, RouterLink, Footer],
  templateUrl: './master-landing-page.html',
  styleUrls: ['./master-landing-page.scss']
})
export class MasterLandingPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);
  private readonly analytics = inject(AnalyticsService);

  readonly lang = inject(LanguageService);
  readonly theme = inject(ThemeService);
  readonly themes = this.theme.themes;
  readonly themePreference = this.theme.themePreference;
  readonly copy = computed(() => COPY[this.lang.currentLang() === 'pt' ? 'pt' : 'en']);
  readonly attributionParams = this.readAttributionParams();

  constructor() {
    effect(() => this.seo.update(masterLandingSeoConfig(this.lang.currentLang())));
  }

  setTheme(theme: StudioThemePreference): void {
    this.theme.setTheme(theme);
  }

  trackCta(position: 'header' | 'hero' | 'final'): void {
    this.analytics.trackEvent('master_landing_cta', {
      cta_position: position,
      source_page: '/master/online',
      destination: '/app/master'
    });
  }

  private readAttributionParams(): Record<string, string> {
    const params: Record<string, string> = {};
    const queryParams = this.route.snapshot.queryParamMap;

    for (const key of ATTRIBUTION_KEYS) {
      const value = queryParams.get(key)?.trim();
      if (value) params[key] = value.slice(0, 256);
    }

    return params;
  }
}
