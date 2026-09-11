import { CommonModule } from '@angular/common';
import { Component, Input, computed, inject } from '@angular/core';
import { LanguageService, UiLanguage } from '../../services/language.service';
import {
  MasteringAnalysisState,
  MasteringDeliveryTargetCapabilities,
  MasteringV2Analysis,
} from '../../services/mastering-types';

type PolicyStatus = 'within' | 'attention' | 'info';

const COPY: Record<UiLanguage, {
  eyebrow: string;
  title: string;
  description: string;
  empty: string;
  loading: string;
  error: string;
  auth: string;
  within: string;
  attention: string;
  info: string;
  loudness: string;
  truePeak: string;
  dynamics: string;
  track: string;
  lra: string;
  crest: string;
  rms: string;
  duration: string;
  policy: string;
}> = {
  en: {
    eyebrow: 'ANALYZER SIMPLE', title: 'Delivery readiness',
    description: 'Technical measurements for the original source. No audio is changed.',
    empty: 'Analysis will begin when the source is ready.', loading: 'Measuring the source…',
    error: 'Analysis is unavailable for this source. Your mastering controls remain unchanged.',
    auth: 'Sign in to analyze this source securely.', within: 'WITHIN DELIVERY RANGE',
    attention: 'NEEDS ATTENTION', info: 'INFO', loudness: 'LOUDNESS', truePeak: 'TRUE PEAK',
    dynamics: 'DYNAMICS', track: 'TRACK', lra: 'LRA', crest: 'Crest factor', rms: 'RMS',
    duration: 'Duration', policy: 'Selected delivery policy',
  },
  pt: {
    eyebrow: 'ANALYZER SIMPLE', title: 'Prontidão para delivery',
    description: 'Medições técnicas da source original. Nenhum áudio é alterado.',
    empty: 'A análise começará quando a source estiver pronta.', loading: 'Medindo a source…',
    error: 'A análise não está disponível para esta source. Os controles de masterização permanecem inalterados.',
    auth: 'Entre na sua conta para analisar esta source com segurança.', within: 'DENTRO DA FAIXA DE DELIVERY',
    attention: 'PRECISA DE ATENÇÃO', info: 'INFO', loudness: 'LOUDNESS', truePeak: 'TRUE PEAK',
    dynamics: 'DINÂMICA', track: 'FAIXA', lra: 'LRA', crest: 'Fator de crista', rms: 'RMS',
    duration: 'Duração', policy: 'Política de delivery selecionada',
  },
  pl: {
    eyebrow: 'ANALYZER SIMPLE', title: 'Gotowość do dystrybucji',
    description: 'Pomiary techniczne oryginalnego źródła. Dźwięk nie jest zmieniany.',
    empty: 'Analiza rozpocznie się, gdy źródło będzie gotowe.', loading: 'Pomiar źródła…',
    error: 'Analiza tego źródła jest niedostępna. Ustawienia masteringu pozostają bez zmian.',
    auth: 'Zaloguj się, aby bezpiecznie przeanalizować źródło.', within: 'W ZAKRESIE DYSTRYBUCJI',
    attention: 'WYMAGA UWAGI', info: 'INFO', loudness: 'GŁOŚNOŚĆ', truePeak: 'TRUE PEAK',
    dynamics: 'DYNAMIKA', track: 'UTWÓR', lra: 'LRA', crest: 'Współczynnik szczytu', rms: 'RMS',
    duration: 'Czas trwania', policy: 'Wybrana polityka dystrybucji',
  },
  fr: {
    eyebrow: 'ANALYZER SIMPLE', title: 'Préparation à la diffusion',
    description: 'Mesures techniques de la source originale. Aucun son n’est modifié.',
    empty: 'L’analyse commencera lorsque la source sera prête.', loading: 'Mesure de la source…',
    error: 'L’analyse est indisponible pour cette source. Les réglages de mastering restent inchangés.',
    auth: 'Connectez-vous pour analyser cette source en toute sécurité.', within: 'DANS LA PLAGE DE DIFFUSION',
    attention: 'NÉCESSITE UNE ATTENTION', info: 'INFO', loudness: 'LOUDNESS', truePeak: 'TRUE PEAK',
    dynamics: 'DYNAMIQUE', track: 'PISTE', lra: 'LRA', crest: 'Facteur de crête', rms: 'RMS',
    duration: 'Durée', policy: 'Politique de diffusion sélectionnée',
  },
};

@Component({
  selector: 'app-analyzer-simple',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analyzer-simple.html',
  styleUrl: './analyzer-simple.scss',
})
export class AnalyzerSimpleComponent {
  @Input() state: MasteringAnalysisState = 'empty';
  @Input() metrics: MasteringV2Analysis | null = null;
  @Input() target: MasteringDeliveryTargetCapabilities | null = null;

  private readonly lang = inject(LanguageService);
  readonly copy = computed(() => COPY[this.lang.currentLang()]);

  lufsStatus(): PolicyStatus {
    if (!this.metrics || !this.target) return 'info';
    return this.metrics.integrated_lufs >= this.target.min_lufs
      && this.metrics.integrated_lufs <= this.target.max_lufs
      ? 'within' : 'attention';
  }

  truePeakStatus(): PolicyStatus {
    if (!this.metrics || !this.target) return 'info';
    return this.metrics.true_peak_dbtp <= this.target.true_peak_ceiling_dbtp
      ? 'within' : 'attention';
  }

  overallStatus(): PolicyStatus {
    if (!this.target) return 'info';
    return this.lufsStatus() === 'attention' || this.truePeakStatus() === 'attention'
      ? 'attention' : 'within';
  }

  statusLabel(status: PolicyStatus): string {
    return this.copy()[status];
  }

  number(value: number, suffix: string): string {
    return `${value.toFixed(1)} ${suffix}`;
  }

  duration(seconds: number): string {
    const total = Math.max(0, Math.round(seconds));
    const minutes = Math.floor(total / 60);
    return `${minutes}:${String(total % 60).padStart(2, '0')}`;
  }
}
